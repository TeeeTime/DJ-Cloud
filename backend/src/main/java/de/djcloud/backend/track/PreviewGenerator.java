package de.djcloud.backend.track;

import java.io.File;
import java.time.Duration;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import de.djcloud.backend.track.ExternalProcessRunner.ProcessResult;
import lombok.RequiredArgsConstructor;

/**
 * Transcodes the original upload down to a lighter-weight streaming preview via ffmpeg. Always
 * produces an MP3 at a fixed bitrate regardless of the source format — {@code -vn} drops any
 * embedded artwork stream (previews never carry cover art; {@code GET /{id}/cover} keeps reading the
 * original), and {@code -map_metadata -1} strips tags so the preview never becomes a second place
 * metadata could drift from the original.
 */
@Component
@RequiredArgsConstructor
class PreviewGenerator {

    private final ExternalProcessRunner processRunner;

    @Value("${app.analysis.ffmpeg-command}")
    private String ffmpegCommand;

    @Value("${app.analysis.preview.bitrate}")
    private String bitrate;

    @Value("${app.analysis.process-timeout-seconds}")
    private long timeoutSeconds;

    boolean generate(File input, File output) {
        List<String> command = List.of(ffmpegCommand, "-y", "-i", input.getAbsolutePath(), "-vn",
                "-map_metadata", "-1", "-ac", "2", "-codec:a", "libmp3lame", "-b:a", bitrate,
                output.getAbsolutePath());

        ProcessResult result = processRunner.run(command, Duration.ofSeconds(timeoutSeconds));
        return result.success();
    }
}
