package de.djcloud.backend.track;

import java.io.File;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.jaudiotagger.audio.AudioFile;
import org.jaudiotagger.audio.AudioFileIO;
import org.jaudiotagger.audio.AudioHeader;
import org.jaudiotagger.tag.FieldKey;
import org.jaudiotagger.tag.Tag;
import org.jaudiotagger.tag.id3.AbstractID3v2Tag;
import org.jaudiotagger.tag.images.Artwork;
import org.jaudiotagger.tag.wav.WavTag;
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
                header.getTrackLength(), readGenres(tag));
    }

    /**
     * Reads the embedded cover art straight from the file's tag on every call — nothing is cached
     * or persisted separately, by design. Returns null if the file has no tag, or no artwork field.
     */
    CoverArt readArtwork(File file) {
        AudioFile audioFile;

        try {
            audioFile = AudioFileIO.read(file);
        } catch (Exception ex) {
            return null;
        }

        Tag tag = audioFile.getTag();
        if (tag == null) {
            return null;
        }

        Artwork artwork = tag.getFirstArtwork();
        if (artwork == null || artwork.getBinaryData() == null || artwork.getBinaryData().length == 0) {
            return null;
        }

        return new CoverArt(artwork.getBinaryData(), artwork.getMimeType());
    }

    /**
     * Reads back the track id previously embedded by {@link AudioMetadataWriter#writeInternalId}.
     * Returns null if the file is unreadable, untagged, or holds something that isn't a valid id
     * (e.g. a file never written by this app) — callers treat all of those the same way: "no id".
     *
     * <p>Mirrors {@code writeInternalId}'s WAV handling: reads the ID3 sub-tag directly rather
     * than the generic {@code Tag} field API, since a WAV with a pre-existing RIFF INFO chunk
     * would otherwise route the read through INFO (which never holds this field) instead of ID3.
     */
    Long readInternalId(File file) {
        AudioFile audioFile;

        try {
            audioFile = AudioFileIO.read(file);
        } catch (Exception ex) {
            return null;
        }

        Tag tag = audioFile.getTag();
        String raw;
        if (tag instanceof WavTag wavTag) {
            AbstractID3v2Tag id3Tag = wavTag.getID3Tag();
            raw = id3Tag == null ? null : readField(id3Tag, FieldKey.CUSTOM1);
        } else {
            raw = readField(tag, FieldKey.CUSTOM1);
        }

        if (raw == null) {
            return null;
        }

        try {
            return Long.valueOf(raw);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private String readField(Tag tag, FieldKey key) {
        if (tag == null) {
            return null;
        }

        String value = tag.getFirst(key);
        return (value == null || value.isBlank()) ? null : value.trim();
    }

    /**
     * Genre tags vary by tagger: some write one frame per genre, others write a single frame with
     * genres separated by ';', '/', or ',' (common with Serato/rekordbox/Mixed In Key). Both shapes
     * are flattened here, deduped case-insensitively, and capped at 3.
     */
    private List<String> readGenres(Tag tag) {
        if (tag == null) {
            return List.of();
        }

        List<String> rawValues = tag.getAll(FieldKey.GENRE);
        if (rawValues == null || rawValues.isEmpty()) {
            return List.of();
        }

        List<String> result = new ArrayList<>();
        Set<String> seenLowerCase = new HashSet<>();
        for (String raw : rawValues) {
            if (raw == null || raw.isBlank()) {
                continue;
            }
            for (String part : raw.split("[;/,]")) {
                String trimmed = part.trim();
                if (trimmed.isEmpty() || !seenLowerCase.add(trimmed.toLowerCase(Locale.ROOT))) {
                    continue;
                }
                result.add(trimmed);
                if (result.size() == 3) {
                    return result;
                }
            }
        }
        return result;
    }
}
