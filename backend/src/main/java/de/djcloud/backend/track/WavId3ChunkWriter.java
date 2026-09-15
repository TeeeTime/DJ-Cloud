package de.djcloud.backend.track;

import java.io.File;
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.channels.FileChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;

import org.jaudiotagger.audio.wav.WavTagWriter;
import org.jaudiotagger.tag.id3.AbstractID3v2Tag;
import org.jaudiotagger.tag.wav.WavTag;
import org.springframework.stereotype.Component;

/**
 * Writes a WAV file's ID3 tag by appending a fresh "id3 " RIFF chunk and patching only the outer
 * RIFF size header, instead of letting jaudiotagger rewrite the whole LIST/INFO/ID3 chunk region
 * via {@code AudioFile#commit()}. That whole-region rewrite has been observed to corrupt unrelated
 * binary chunks it re-serializes along the way — notably Traktor Pro's proprietary "NITR" cue/grid
 * chunk, whose bytes get mangled (invalid UTF-8 byte sequences replaced with U+FFFD), shifting
 * offsets inside it and crashing Traktor on load. This writer never parses or touches any chunk
 * other than a pre-existing "id3 " one (which it excises before appending the replacement) —
 * everything else in the file, foreign chunks included, is copied byte-for-byte, unchanged.
 */
@Component
class WavId3ChunkWriter {

    private static final byte[] ID3_CHUNK_ID = "id3 ".getBytes(StandardCharsets.US_ASCII);
    private static final int RIFF_SIZE_OFFSET = 4;

    /**
     * Requires {@code wavTag} to have come from {@code AudioFileIO.read(file)} on this same file,
     * with its ID3 sub-tag ({@link WavTag#getID3Tag()}) already holding the fields to write.
     */
    void writeId3Chunk(File file, WavTag wavTag) throws IOException {
        long existingChunkStart = -1;
        long existingChunkEnd = -1;

        // wavTag.isExistingId3Tag() reflects whether ID3 should be treated as the "active" tag for
        // field routing, not whether the ID3 sub-tag actually came from a chunk on disk — a freshly
        // created default tag (no prior "id3 " chunk in the file) has isExistingId3Tag() true too,
        // but no real file location, so WavTag's start/end getters would NPE for it. The tag's own
        // start-location field is null exactly when it was never read from a file, which is the
        // reliable signal for "is there a chunk on disk to excise".
        AbstractID3v2Tag id3Tag = wavTag.getID3Tag();
        if (id3Tag != null && id3Tag.getStartLocationInFile() != null) {
            existingChunkStart = wavTag.getStartLocationInFileOfId3Chunk();
            existingChunkEnd = wavTag.getEndLocationInFileOfId3Chunk();
        }

        ByteBuffer id3Payload;
        try {
            id3Payload = new WavTagWriter("djcloud").convertID3Chunk(wavTag, wavTag);
        } catch (UnsupportedEncodingException ex) {
            throw new IOException("Could not serialize WAV ID3 chunk", ex);
        }

        File tmpFile = File.createTempFile(file.getName(), ".tmp", file.getParentFile());
        try {
            try (FileChannel in = FileChannel.open(file.toPath(), StandardOpenOption.READ);
                    FileChannel out = FileChannel.open(tmpFile.toPath(), StandardOpenOption.WRITE,
                            StandardOpenOption.TRUNCATE_EXISTING)) {

                long fileSize = in.size();
                if (existingChunkStart < 0) {
                    transfer(in, out, 0, fileSize);
                } else {
                    transfer(in, out, 0, existingChunkStart);
                    transfer(in, out, existingChunkEnd, fileSize - existingChunkEnd);
                }

                writeChunk(out, id3Payload);
                patchRiffSize(out);
            }

            move(tmpFile, file);
        } finally {
            Files.deleteIfExists(tmpFile.toPath());
        }
    }

    private void transfer(FileChannel in, FileChannel out, long position, long count) throws IOException {
        long remaining = count;
        long pos = position;
        while (remaining > 0) {
            long transferred = in.transferTo(pos, remaining, out);
            if (transferred <= 0) {
                break;
            }
            pos += transferred;
            remaining -= transferred;
        }
    }

    private void writeChunk(FileChannel out, ByteBuffer payload) throws IOException {
        int dataSize = payload.remaining();
        boolean needsPad = dataSize % 2 != 0;

        ByteBuffer header = ByteBuffer.allocate(8).order(ByteOrder.LITTLE_ENDIAN);
        header.put(ID3_CHUNK_ID);
        header.putInt(dataSize);
        header.flip();

        out.position(out.size());
        out.write(header);
        out.write(payload);
        if (needsPad) {
            out.write(ByteBuffer.wrap(new byte[] { 0 }));
        }
    }

    private void patchRiffSize(FileChannel out) throws IOException {
        ByteBuffer riffSize = ByteBuffer.allocate(4).order(ByteOrder.LITTLE_ENDIAN);
        riffSize.putInt((int) (out.size() - 8));
        riffSize.flip();
        out.write(riffSize, RIFF_SIZE_OFFSET);
    }

    private void move(File source, File target) throws IOException {
        Path sourcePath = source.toPath();
        Path targetPath = target.toPath();
        try {
            Files.move(sourcePath, targetPath, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (AtomicMoveNotSupportedException ex) {
            Files.move(sourcePath, targetPath, StandardCopyOption.REPLACE_EXISTING);
        }
    }
}
