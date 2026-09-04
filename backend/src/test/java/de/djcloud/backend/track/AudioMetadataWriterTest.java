package de.djcloud.backend.track;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.nio.file.Path;

import javax.sound.sampled.AudioFileFormat;
import javax.sound.sampled.AudioFormat;
import javax.sound.sampled.AudioInputStream;
import javax.sound.sampled.AudioSystem;

import org.jaudiotagger.audio.AudioFile;
import org.jaudiotagger.audio.AudioFileIO;
import org.jaudiotagger.audio.wav.WavOptions;
import org.jaudiotagger.tag.FieldKey;
import org.jaudiotagger.tag.Tag;
import org.jaudiotagger.tag.TagOptionSingleton;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * Confirms the internal-id tag (written via {@code FieldKey.CUSTOM1}) round-trips on a WAV file,
 * not just MP3 — WAV falls back to jaudiotagger's RIFF INFO chunk when there's no ID3 chunk, and
 * that chunk has no slot for KEY/BPM (see {@link AudioMetadataWriter#setField}), so it was an open
 * question whether it has a slot for a custom field either.
 */
class AudioMetadataWriterTest {

    private final AudioMetadataWriter writer = new AudioMetadataWriter();
    private final AudioMetadataReader reader = new AudioMetadataReader();

    @Test
    void internalIdRoundTripsOnWavFile(@TempDir Path tempDir) throws Exception {
        File wav = tempDir.resolve("test.wav").toFile();
        writeSilentWav(wav);

        writer.writeInternalId(wav, 12345L);
        Long readBack = reader.readInternalId(wav);

        assertThat(readBack).isEqualTo(12345L);
    }

    /**
     * The realistic failure case this whole WAV-specific code path exists for: a WAV that already
     * carries a populated RIFF INFO chunk (as ffmpeg and many DAWs write by default) makes
     * jaudiotagger treat INFO — which has no slot for a custom field — as the "active" tag for
     * generic field routing, silently dropping a naive {@code tag.setField(CUSTOM1, ...)}.
     */
    @Test
    void internalIdRoundTripsOnWavFileWithExistingInfoChunk(@TempDir Path tempDir) throws Exception {
        File wav = tempDir.resolve("test-with-info.wav").toFile();
        writeSilentWav(wav);
        forceExistingInfoChunk(wav);

        writer.writeInternalId(wav, 54321L);
        Long readBack = reader.readInternalId(wav);

        assertThat(readBack).isEqualTo(54321L);
    }

    /** Forces jaudiotagger to create and populate a RIFF INFO chunk, simulating a file tagged by another tool. */
    private void forceExistingInfoChunk(File file) throws Exception {
        WavOptions original = TagOptionSingleton.getInstance().getWavOptions();
        TagOptionSingleton.getInstance().setWavOptions(WavOptions.READ_INFO_ONLY);
        try {
            AudioFile audioFile = AudioFileIO.read(file);
            Tag tag = audioFile.getTagOrCreateAndSetDefault();
            tag.setField(FieldKey.ALBUM, "Existing Info Tag");
            audioFile.commit();
        } finally {
            TagOptionSingleton.getInstance().setWavOptions(original);
        }
    }

    private void writeSilentWav(File file) throws Exception {
        AudioFormat format = new AudioFormat(44100f, 8, 1, true, false);
        byte[] silence = new byte[4410]; // 0.1s of silence
        try (AudioInputStream audioInputStream = new AudioInputStream(new ByteArrayInputStream(silence), format,
                silence.length)) {
            AudioSystem.write(audioInputStream, AudioFileFormat.Type.WAVE, file);
        }
    }
}
