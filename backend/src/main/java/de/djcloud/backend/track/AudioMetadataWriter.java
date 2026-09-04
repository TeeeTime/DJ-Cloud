package de.djcloud.backend.track;

import java.io.File;
import java.util.Set;
import java.util.stream.Collectors;

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

/**
 * Writes edited track fields back into the original audio file's own tags, so editing a track via
 * the API never leaves the file on disk holding stale metadata.
 */
@Component
class AudioMetadataWriter {

    void write(File file, String title, String key, int bpm, Set<Artist> artists, Set<Genre> genres) {
        try {
            AudioFile audioFile = AudioFileIO.read(file);
            Tag tag = audioFile.getTagOrCreateAndSetDefault();

            setField(tag, FieldKey.TITLE, title);
            setField(tag, FieldKey.KEY, key);
            setField(tag, FieldKey.BPM, bpm > 0 ? String.valueOf(bpm) : null);
            setField(tag, FieldKey.ARTIST, artists.stream()
                    .map(Artist::getName)
                    .collect(Collectors.joining("; ")));
            setField(tag, FieldKey.GENRE, genres.stream()
                    .map(Genre::getName)
                    .collect(Collectors.joining("; ")));

            audioFile.commit();
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
     * routing entirely, leaving the INFO chunk and every other field's routing untouched.
     */
    void writeInternalId(File file, Long id) {
        try {
            AudioFile audioFile = AudioFileIO.read(file);
            Tag tag = audioFile.getTagOrCreateAndSetDefault();

            if (tag instanceof WavTag wavTag) {
                AbstractID3v2Tag id3Tag = wavTag.getID3Tag();
                if (id3Tag == null) {
                    id3Tag = WavTag.createDefaultID3Tag();
                    wavTag.setID3Tag(id3Tag);
                }
                id3Tag.setField(FieldKey.CUSTOM1, String.valueOf(id));
                wavTag.setExistingId3Tag(true);
            } else {
                setField(tag, FieldKey.CUSTOM1, String.valueOf(id));
            }

            audioFile.commit();
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

            tag.deleteArtworkField();
            tag.addField(artwork);

            audioFile.commit();
        } catch (Exception ex) {
            throw new AudioMetadataException("Could not update audio file metadata", ex);
        }
    }

    /**
     * Some tag formats only support a fixed, narrow field set — e.g. a WAV file with no ID3 chunk
     * falls back to jaudiotagger's RIFF INFO tag, which has no slot for KEY or BPM. jaudiotagger
     * signals that with an unchecked UnsupportedOperationException rather than one of its usual
     * checked exceptions, so it's swallowed here per-field instead of aborting the whole write —
     * fields the format can't hold are skipped rather than blocking the ones it can (TITLE/ARTIST).
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
