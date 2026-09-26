package de.djcloud.backend.track;

import java.io.File;
import java.time.Duration;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import de.djcloud.backend.track.ExternalProcessRunner.ProcessResult;
import lombok.RequiredArgsConstructor;

/**
 * Verifies an audio file is actually intact by decoding it end to end via ffmpeg and discarding
 * the output ({@code -f null -}) — a full decode pass rather than a header/stream check, so
 * corruption partway through the file (not just a malformed header) is caught. Used both on the
 * freshly uploaded file and again on the remuxed replacement produced from it, since a bad remux
 * must never silently become the track's file.
 */
@Component
@RequiredArgsConstructor
class AudioIntegrityValidator {

    private final ExternalProcessRunner processRunner;

    @Value("${app.analysis.ffmpeg-command}")
    private String ffmpegCommand;

    @Value("${app.analysis.process-timeout-seconds}")
    private long timeoutSeconds;

    boolean validate(File file) {
        List<String> command = List.of(ffmpegCommand, "-v", "error", "-xerror", "-i",
                file.getAbsolutePath(), "-f", "null", "-");

        ProcessResult result = processRunner.run(command, Duration.ofSeconds(timeoutSeconds));
        return result.success();
    }
}
