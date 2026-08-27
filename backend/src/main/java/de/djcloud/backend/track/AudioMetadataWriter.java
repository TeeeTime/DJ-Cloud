package de.djcloud.backend.track;

import java.io.File;
import java.util.Set;
import java.util.stream.Collectors;

import org.jaudiotagger.audio.AudioFile;
import org.jaudiotagger.audio.AudioFileIO;
import org.jaudiotagger.tag.FieldKey;
import org.jaudiotagger.tag.Tag;
import org.jaudiotagger.tag.images.Artwork;
import org.jaudiotagger.tag.images.ArtworkFactory;
import org.springframework.stereotype.Component;

import de.djcloud.backend.artist.Artist;

/**
 * Writes edited track fields back into the original audio file's own tags, so editing a track via
 * the API never leaves the file on disk holding stale metadata.
 */
@Component
class AudioMetadataWriter {

    void write(File file, String title, String key, int bpm, Set<Artist> artists) {
        try {
            AudioFile audioFile = AudioFileIO.read(file);
            Tag tag = audioFile.getTagOrCreateAndSetDefault();

            setField(tag, FieldKey.TITLE, title);
            setField(tag, FieldKey.KEY, key);
            setField(tag, FieldKey.BPM, bpm > 0 ? String.valueOf(bpm) : null);
            setField(tag, FieldKey.ARTIST, artists.stream()
                    .map(Artist::getName)
                    .collect(Collectors.joining("; ")));

            audioFile.commit();
        } catch (Exception ex) {
            // jaudiotagger throws several checked exceptions here (CannotReadException,
            // TagException, ReadOnlyFileException, InvalidAudioFrameException,
            // CannotWriteException, ...); callers only need to know the write failed
            throw new AudioMetadataException("Could not update audio file metadata", ex);
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
