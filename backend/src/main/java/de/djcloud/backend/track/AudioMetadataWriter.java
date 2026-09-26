package de.djcloud.backend.track;

import java.io.File;
import java.util.Collection;
import java.util.Set;

import org.jaudiotagger.audio.AudioFile;
import org.jaudiotagger.audio.AudioFileIO;
import org.jaudiotagger.tag.FieldKey;
import org.jaudiotagger.tag.Tag;
import org.jaudiotagger.tag.id3.AbstractID3v2Tag;
import org.jaudiotagger.tag.images.Artwork;
import org.jaudiotagger.tag.images.ArtworkFactory;
import org.jaudiotagger.tag.wav.WavTag;
import org.springframework.stereotype.Component;

import de.djcloud.backend.artist.Artist;
import de.djcloud.backend.genre.Genre;
import lombok.RequiredArgsConstructor;

/**
 * Writes edited track fields back into the original audio file's own tags, so editing a track via
 * the API never leaves the file on disk holding stale metadata.
 *
 * <p>For WAV files, every write in this class goes through {@link WavId3ChunkWriter} rather than
 * jaudiotagger's {@code AudioFile#commit()}.
 * jaudiotagger's WAV commit rewrites the whole LIST/INFO/ID3 chunk region from its own in-memory
 * model, which has been observed to corrupt unrelated binary chunks it re-serializes along the way
 * (e.g. Traktor Pro's proprietary "NITR" cue/grid chunk). {@link WavId3ChunkWriter} instead only
 * ever touches a pre-existing "id3 " chunk (excising it) and appends the replacement, leaving every
 * other chunk — including any pre-existing RIFF INFO chunk — untouched. One consequence: unlike
 * before, a WAV's RIFF INFO chunk is never written to by this app, even if one already exists —
 * only the ID3 sub-tag is. Tools that read WAV metadata exclusively via RIFF INFO (not ID3, which
 * is the more common convention among DJ/tagging tools) will keep showing whatever was there
 * before, not edits made through this app. Accepted tradeoff to eliminate the corruption risk.
 */
@Component
@RequiredArgsConstructor
class AudioMetadataWriter {

    private final WavId3ChunkWriter wavId3ChunkWriter;

    void write(File file, String title, String key, int bpm, Set<Artist> artists, Set<Genre> genres) {
        write(file, title, key, bpm, artists.stream().map(Artist::getName).toList(),
                genres.stream().map(Genre::getName).toList());
    }

    /**
     * Same as {@link #write(File, String, String, int, Set, Set)}, for callers that already have
     * plain artist/genre names rather than entities — namely the analysis pipeline, which runs on
     * a background thread with no open Hibernate session ({@code open-in-view: false}) and so
     * can't safely touch a {@link Track}'s lazy {@code artists}/{@code genres} collections
     * directly; it fetches plain names inside one of {@link TrackAnalysisStatusService}'s short
     * transactions instead.
     */
    void write(File file, String title, String key, int bpm, Collection<String> artistNames,
            Collection<String> genreNames) {
        try {
            AudioFile audioFile = AudioFileIO.read(file);
            Tag tag = audioFile.getTagOrCreateAndSetDefault();

            String artistValue = String.join("; ", artistNames);
            String genreValue = String.join("; ", genreNames);
            String bpmValue = bpm > 0 ? String.valueOf(bpm) : null;

            if (tag instanceof WavTag wavTag) {
                AbstractID3v2Tag id3Tag = getOrCreateId3Tag(wavTag);

                setField(id3Tag, FieldKey.TITLE, title);
                setField(id3Tag, FieldKey.KEY, key);
                setField(id3Tag, FieldKey.BPM, bpmValue);
                setField(id3Tag, FieldKey.ARTIST, artistValue);
                setField(id3Tag, FieldKey.GENRE, genreValue);

                wavId3ChunkWriter.writeId3Chunk(file, wavTag);
            } else {
                setField(tag, FieldKey.TITLE, title);
                setField(tag, FieldKey.KEY, key);
                setField(tag, FieldKey.BPM, bpmValue);
                setField(tag, FieldKey.ARTIST, artistValue);
                setField(tag, FieldKey.GENRE, genreValue);

                audioFile.commit();
            }
        } catch (Exception ex) {
            // jaudiotagger throws several checked exceptions here (CannotReadException,
            // TagException, ReadOnlyFileException, InvalidAudioFrameException,
            // CannotWriteException, ...); callers only need to know the write failed
            throw new AudioMetadataException("Could not update audio file metadata", ex);
        }
    }

    /**
     * Embeds the track's own database id into the file's tags (a custom/user field, since no
     * standard tag has a slot for this) so a client with a local copy of the file can identify
     * which track it corresponds to without relying on the filename.
     *
     * <p>For WAV, this deliberately writes straight into the ID3 sub-tag ({@link
     * WavTag#getID3Tag()}) rather than going through the generic {@code Tag} field API used
     * elsewhere in this class. A WAV file that already carries a RIFF INFO chunk (common —
     * ffmpeg and many DAWs write one automatically) makes jaudiotagger treat that INFO tag as
     * the "active" one for generic field routing, and INFO has no slot for a custom field —
     * confirmed by writing to a real ffmpeg-generated WAV with a pre-existing INFO chunk, where
     * a generic {@code tag.setField(CUSTOM1, ...)} threw {@code UnsupportedOperationException}.
     * Targeting the ID3 sub-tag directly (creating one if absent) sidesteps that INFO-vs-ID3
     * routing entirely, leaving the INFO chunk and every other field's routing untouched. This
     * can run more than once on the same file over its lifetime (see {@link
     * CustomIdBackfillRunner}), so {@link WavId3ChunkWriter} must — and does — replace rather
     * than duplicate a previously-written "id3 " chunk.
     */
    void writeInternalId(File file, Long id) {
        try {
            AudioFile audioFile = AudioFileIO.read(file);
            Tag tag = audioFile.getTagOrCreateAndSetDefault();

            if (tag instanceof WavTag wavTag) {
                AbstractID3v2Tag id3Tag = getOrCreateId3Tag(wavTag);
                id3Tag.setField(FieldKey.CUSTOM1, String.valueOf(id));

                wavId3ChunkWriter.writeId3Chunk(file, wavTag);
            } else {
                setField(tag, FieldKey.CUSTOM1, String.valueOf(id));

                audioFile.commit();
            }
        } catch (Exception ex) {
            throw new AudioMetadataException("Could not write internal id tag", ex);
        }
    }

    /** Replaces the file's embedded cover art wholesale — there's only ever one artwork per file. */
    void writeArtwork(File file, byte[] imageData, String mimeType) {
        try {
            AudioFile audioFile = AudioFileIO.read(file);
            Tag tag = audioFile.getTagOrCreateAndSetDefault();

            Artwork artwork = ArtworkFactory.getNew();
            artwork.setBinaryData(imageData);
            artwork.setMimeType(mimeType);
            artwork.setDescription("");

            if (tag instanceof WavTag wavTag) {
                AbstractID3v2Tag id3Tag = getOrCreateId3Tag(wavTag);
                id3Tag.deleteArtworkField();
                id3Tag.addField(artwork);

                wavId3ChunkWriter.writeId3Chunk(file, wavTag);
            } else {
                tag.deleteArtworkField();
                tag.addField(artwork);

                audioFile.commit();
            }
        } catch (Exception ex) {
            throw new AudioMetadataException("Could not update audio file metadata", ex);
        }
    }

    /** Clears the file's embedded cover art, if any — idempotent, a no-op if there was none. */
    void removeArtwork(File file) {
        try {
            AudioFile audioFile = AudioFileIO.read(file);
            Tag tag = audioFile.getTagOrCreateAndSetDefault();

            if (tag instanceof WavTag wavTag) {
                AbstractID3v2Tag id3Tag = getOrCreateId3Tag(wavTag);
                id3Tag.deleteArtworkField();

                wavId3ChunkWriter.writeId3Chunk(file, wavTag);
            } else {
                tag.deleteArtworkField();

                audioFile.commit();
            }
        } catch (Exception ex) {
            throw new AudioMetadataException("Could not update audio file metadata", ex);
        }
    }

    /**
     * Returns the WAV's existing ID3 sub-tag, creating and attaching a fresh one if absent.
     *
     * <p>Deliberately does <em>not</em> call {@code wavTag.setExistingId3Tag(true)} for a freshly
     * created tag: that flag is what jaudiotagger itself (via {@code WavTag#getSizeOfID3TagOnly()},
     * consulted by {@code WavTagWriter#convertID3Chunk}) trusts to decide whether the tag's
     * file-location fields are meaningful — forcing it true for a tag that was never actually read
     * from a chunk on disk (no location data) throws an NPE deep inside jaudiotagger. When a chunk
     * genuinely exists on disk, {@code AudioFileIO.read} already marked this true during parsing.
     */
    private AbstractID3v2Tag getOrCreateId3Tag(WavTag wavTag) {
        AbstractID3v2Tag id3Tag = wavTag.getID3Tag();
        if (id3Tag == null) {
            id3Tag = WavTag.createDefaultID3Tag();
            wavTag.setID3Tag(id3Tag);
        }
        return id3Tag;
    }

    /**
     * Some tag formats only support a fixed, narrow field set — e.g. an MP3's ID3v1 fallback tag
     * has no slot for a custom field. jaudiotagger signals that with an unchecked
     * UnsupportedOperationException rather than one of its usual checked exceptions, so it's
     * swallowed here per-field instead of aborting the whole write — fields the format can't hold
     * are skipped rather than blocking the ones it can (TITLE/ARTIST). Not expected to trigger for
     * the WAV+ID3v2 path above, since ID3v2 supports all fields written here; kept defensively.
     */
    private void setField(Tag tag, FieldKey key, String value) throws Exception {
        try {
            if (value == null || value.isBlank()) {
                tag.deleteField(key);
            } else {
                tag.setField(key, value);
            }
        } catch (UnsupportedOperationException ex) {
            // field not supported by this tag format — nothing to do
        }
    }
}
