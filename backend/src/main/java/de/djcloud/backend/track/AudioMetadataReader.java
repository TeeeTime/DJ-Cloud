package de.djcloud.backend.track;

import java.io.File;

import org.jaudiotagger.audio.AudioFile;
import org.jaudiotagger.audio.AudioFileIO;
import org.jaudiotagger.audio.AudioHeader;
import org.jaudiotagger.tag.FieldKey;
import org.jaudiotagger.tag.Tag;
import org.springframework.stereotype.Component;

/** Thin wrapper so the rest of the app never touches jaudiotagger's types (or its exception zoo) directly. */
@Component
class AudioMetadataReader {

    AudioMetadata read(File file) {
        AudioFile audioFile;

        try {
            audioFile = AudioFileIO.read(file);
        } catch (Exception ex) {
            // jaudiotagger throws several checked exceptions (CannotReadException, TagException,
            // ReadOnlyFileException, InvalidAudioFrameException, IOException) for a malformed or
            // unsupported upload; caller only needs to know "this wasn't readable as audio"
            throw new AudioMetadataException("Uploaded file could not be read as audio", ex);
        }

        AudioHeader header = audioFile.getAudioHeader();
        Tag tag = audioFile.getTag();

        return new AudioMetadata(readField(tag, FieldKey.TITLE), readField(tag, FieldKey.ARTIST),
                header.getTrackLength());
    }

    private String readField(Tag tag, FieldKey key) {
        if (tag == null) {
            return null;
        }

        String value = tag.getFirst(key);
        return (value == null || value.isBlank()) ? null : value.trim();
    }
}
