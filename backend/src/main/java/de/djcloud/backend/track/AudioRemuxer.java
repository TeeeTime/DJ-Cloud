package de.djcloud.backend.track;

import java.io.File;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import de.djcloud.backend.track.ExternalProcessRunner.ProcessResult;
import de.djcloud.backend.track.TrackAnalysisStatusService.RemuxMetadata;
import lombok.RequiredArgsConstructor;

/**
 * Rebuilds an audio file's container from scratch via ffmpeg, dropping every tag and any
 * non-standard chunk/frame DJ software may have embedded (hotcues, Traktor's "NITR" chunk, Serato
 * marker frames, ...) — {@code -map_metadata -1} strips known tags, and simply muxing into a
 * fresh container drops anything the muxer doesn't itself know how to write, even for chunks
 * {@code -map_metadata} never touches.
 *
 * <p>mp3/wav sources are never recompressed: {@code -c:a copy} rebuilds only the container,
 * leaving the encoded audio bytes untouched (lossless, and still enough to strip the container-
 * level cruft above). Every other accepted source is re-encoded to WAV, since it isn't natively
 * compatible, using a PCM codec matched to the source's own bit depth via {@link AudioStreamProbe}
 * rather than ffmpeg's 16-bit WAV default — and no {@code -ar} flag, so the sample rate is
 * likewise left at the source's own rate rather than being resampled.
 *
 * <p>Title/artist/genre are passed straight to ffmpeg as {@code -metadata} flags in the same
 * command, in addition to being written again afterward via {@link AudioMetadataWriter} (which
 * also handles cover art and the internal id tag, neither of which a simple {@code -metadata}
 * flag can carry). This isn't redundant for WAV output specifically: ffmpeg's WAV muxer maps
 * {@code -metadata} to the RIFF {@code LIST/INFO} chunk (title→INAM, artist→IART, genre→IGNR),
 * while {@link AudioMetadataWriter}'s WAV path deliberately only ever writes the separate "id3 "
 * sub-chunk (see its class doc for why). Without both, a freshly remuxed WAV would carry title/
 * artist only in ID3 — invisible to any tool (Explorer, some DJ software) that reads WAV metadata
 * via RIFF INFO instead of ID3.
 */
@Component
@RequiredArgsConstructor
class AudioRemuxer {

    private static final Set<String> STREAM_COPY_EXTENSIONS = Set.of("mp3", "wav");

    private final ExternalProcessRunner processRunner;
    private final AudioStreamProbe audioStreamProbe;

    @Value("${app.analysis.ffmpeg-command}")
    private String ffmpegCommand;

    @Value("${app.analysis.process-timeout-seconds}")
    private long timeoutSeconds;

    /** mp3/wav sources keep their extension; every other accepted source becomes wav. */
    String targetExtension(String sourceExtension) {
        String extension = sourceExtension.toLowerCase(Locale.ROOT);
        return STREAM_COPY_EXTENSIONS.contains(extension) ? extension : "wav";
    }

    boolean remux(File input, String sourceExtension, File output, RemuxMetadata metadata) {
        List<String> command = new ArrayList<>();
        command.add(ffmpegCommand);
        command.add("-y");
        command.add("-i");
        command.add(input.getAbsolutePath());
        command.add("-vn");
        command.add("-map_metadata");
        command.add("-1");
        addMetadataFlag(command, "title", metadata.title());
        addMetadataFlag(command, "artist", String.join("; ", metadata.artistNames()));
        addMetadataFlag(command, "genre", String.join("; ", metadata.genreNames()));

        if (STREAM_COPY_EXTENSIONS.contains(sourceExtension.toLowerCase(Locale.ROOT))) {
            command.add("-c:a");
            command.add("copy");
        } else {
            command.add("-c:a");
            command.add(audioStreamProbe.selectPcmCodec(input));
        }
        command.add(output.getAbsolutePath());

        ProcessResult result = processRunner.run(command, Duration.ofSeconds(timeoutSeconds));
        return result.success();
    }

    private void addMetadataFlag(List<String> command, String key, String value) {
        if (value != null && !value.isBlank()) {
            command.add("-metadata");
            command.add(key + "=" + value);
        }
    }
}
