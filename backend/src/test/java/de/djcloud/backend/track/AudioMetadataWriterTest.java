package de.djcloud.backend.track;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.RandomAccessFile;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Set;

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

    private final AudioMetadataWriter writer = new AudioMetadataWriter(new WavId3ChunkWriter());
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

    /**
     * The core regression test for the bug this class exists to fix: a foreign binary chunk
     * elsewhere in the file (standing in for Traktor Pro's proprietary "NITR" cue/grid chunk,
     * which contains bytes that are invalid UTF-8) must survive {@code writeInternalId}
     * byte-for-byte. jaudiotagger's {@code AudioFile#commit()} rewrites the whole LIST/INFO/ID3
     * chunk region and has been observed to corrupt exactly this kind of chunk; the raw
     * append/replace path in {@link WavId3ChunkWriter} must never touch it.
     */
    @Test
    void foreignChunkSurvivesWriteInternalId(@TempDir Path tempDir) throws Exception {
        File wav = tempDir.resolve("test-foreign-chunk.wav").toFile();
        writeSilentWav(wav);
        byte[] foreignChunkBefore = appendForeignChunk(wav);

        writer.writeInternalId(wav, 12345L);

        assertThat(readChunk(wav, "NITR", foreignChunkBefore.length - 8)).isEqualTo(foreignChunkBefore);
        assertThat(reader.readInternalId(wav)).isEqualTo(12345L);
    }

    /** Same foreign-chunk-survival guarantee, but for the general title/key/bpm/artist/genre write path. */
    @Test
    void foreignChunkSurvivesGeneralFieldWrite(@TempDir Path tempDir) throws Exception {
        File wav = tempDir.resolve("test-foreign-chunk-general.wav").toFile();
        writeSilentWav(wav);
        byte[] foreignChunkBefore = appendForeignChunk(wav);

        writer.write(wav, "Test Title", "Am", 128, Set.of(), Set.of());

        assertThat(readChunk(wav, "NITR", foreignChunkBefore.length - 8)).isEqualTo(foreignChunkBefore);
    }

    /** Same foreign-chunk-survival guarantee, but for cover art writes (PUT /{id}/cover). */
    @Test
    void foreignChunkSurvivesArtworkWrite(@TempDir Path tempDir) throws Exception {
        File wav = tempDir.resolve("test-foreign-chunk-artwork.wav").toFile();
        writeSilentWav(wav);
        byte[] foreignChunkBefore = appendForeignChunk(wav);

        writer.writeArtwork(wav, new byte[] { 1, 2, 3, 4 }, "image/png");

        assertThat(readChunk(wav, "NITR", foreignChunkBefore.length - 8)).isEqualTo(foreignChunkBefore);
    }

    /** Same foreign-chunk-survival guarantee, but for cover art removal (DELETE /{id}/cover). */
    @Test
    void foreignChunkSurvivesArtworkRemoval(@TempDir Path tempDir) throws Exception {
        File wav = tempDir.resolve("test-foreign-chunk-artwork-removal.wav").toFile();
        writeSilentWav(wav);
        writer.writeArtwork(wav, new byte[] { 1, 2, 3, 4 }, "image/png");
        byte[] foreignChunkBefore = appendForeignChunk(wav);

        writer.removeArtwork(wav);

        assertThat(readChunk(wav, "NITR", foreignChunkBefore.length - 8)).isEqualTo(foreignChunkBefore);
    }

    /**
     * {@code writeInternalId} can run more than once on the same file over its lifetime (e.g.
     * {@link CustomIdBackfillRunner} re-runs it whenever the on-file id doesn't match the DB id).
     * A second write must replace, not duplicate, the "id3 " chunk from the first write.
     */
    @Test
    void writeInternalIdReplacesRatherThanDuplicatesId3Chunk(@TempDir Path tempDir) throws Exception {
        File wav = tempDir.resolve("test-overwrite.wav").toFile();
        writeSilentWav(wav);

        writer.writeInternalId(wav, 11111L);
        writer.writeInternalId(wav, 22222L);

        assertThat(countChunkOccurrences(wav, "id3 ")).isEqualTo(1);
        assertThat(reader.readInternalId(wav)).isEqualTo(22222L);
    }

    /**
     * The outer RIFF size header (bytes 4-7, little-endian) must always equal the file length
     * minus 8, and the file must remain fully parseable, after a raw WAV write.
     */
    @Test
    void riffSizeHeaderStaysConsistentAfterWrite(@TempDir Path tempDir) throws Exception {
        File wav = tempDir.resolve("test-riff-size.wav").toFile();
        writeSilentWav(wav);

        writer.writeInternalId(wav, 12345L);

        byte[] bytes = Files.readAllBytes(wav.toPath());
        long riffSize = Integer.toUnsignedLong(readLittleEndianInt(bytes, 4));
        assertThat(riffSize).isEqualTo(bytes.length - 8);

        assertThat(AudioFileIO.read(wav)).isNotNull();
        assertThat(AudioSystem.getAudioFileFormat(wav)).isNotNull();
    }

    /**
     * Appends a synthetic top-level RIFF chunk with id "NITR" and binary content that is invalid
     * UTF-8 (standing in for Traktor's proprietary chunk), patching the outer RIFF size header to
     * account for it. Returns the appended chunk's bytes (header included) for later comparison.
     */
    private byte[] appendForeignChunk(File file) throws Exception {
        byte[] payload = new byte[40];
        for (int i = 0; i < payload.length; i++) {
            payload[i] = (byte) (0x80 + i); // invalid as standalone UTF-8 continuation bytes
        }

        byte[] chunk = new byte[8 + payload.length];
        System.arraycopy("NITR".getBytes("US-ASCII"), 0, chunk, 0, 4);
        writeLittleEndianInt(chunk, 4, payload.length);
        System.arraycopy(payload, 0, chunk, 8, payload.length);

        try (RandomAccessFile raf = new RandomAccessFile(file, "rw")) {
            raf.seek(raf.length());
            raf.write(chunk);

            raf.seek(4);
            byte[] riffSize = new byte[4];
            writeLittleEndianInt(riffSize, 0, (int) (raf.length() - 8));
            raf.write(riffSize);
        }

        return chunk;
    }

    /** Locates a top-level chunk by its 4-byte id and returns its bytes (header included). */
    private byte[] readChunk(File file, String chunkId, int expectedDataLength) throws Exception {
        byte[] bytes = Files.readAllBytes(file.toPath());
        byte[] idBytes = chunkId.getBytes("US-ASCII");
        int offset = indexOf(bytes, idBytes);
        assertThat(offset).as("chunk '%s' not found in file", chunkId).isNotNegative();
        return Arrays.copyOfRange(bytes, offset, offset + 8 + expectedDataLength);
    }

    private int countChunkOccurrences(File file, String chunkId) throws Exception {
        byte[] bytes = Files.readAllBytes(file.toPath());
        byte[] idBytes = chunkId.getBytes("US-ASCII");
        int count = 0;
        int offset = 0;
        while ((offset = indexOf(bytes, idBytes, offset)) >= 0) {
            count++;
            offset++;
        }
        return count;
    }

    private int indexOf(byte[] haystack, byte[] needle) {
        return indexOf(haystack, needle, 0);
    }

    private int indexOf(byte[] haystack, byte[] needle, int fromIndex) {
        outer:
        for (int i = fromIndex; i <= haystack.length - needle.length; i++) {
            for (int j = 0; j < needle.length; j++) {
                if (haystack[i + j] != needle[j]) {
                    continue outer;
                }
            }
            return i;
        }
        return -1;
    }

    private int readLittleEndianInt(byte[] bytes, int offset) {
        return (bytes[offset] & 0xFF) | ((bytes[offset + 1] & 0xFF) << 8) | ((bytes[offset + 2] & 0xFF) << 16)
                | ((bytes[offset + 3] & 0xFF) << 24);
    }

    private void writeLittleEndianInt(byte[] bytes, int offset, int value) {
        bytes[offset] = (byte) value;
        bytes[offset + 1] = (byte) (value >> 8);
        bytes[offset + 2] = (byte) (value >> 16);
        bytes[offset + 3] = (byte) (value >> 24);
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
