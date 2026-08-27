package de.djcloud.backend.track;

import java.io.File;
import java.time.Duration;
import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import de.djcloud.backend.track.ExternalProcessRunner.ProcessResult;
import lombok.RequiredArgsConstructor;

/**
 * Detects a track's musical key via {@code keyfinder-cli}, requesting Camelot Wheel notation
 * directly (e.g. {@code "8A"}) so the result needs no further conversion — it's already the
 * convention this app's {@code key} field uses.
 */
@Component
@RequiredArgsConstructor
class KeyAnalyzer {

    private final ExternalProcessRunner processRunner;

    @Value("${app.analysis.key.command}")
    private String keyfinderCommand;

    @Value("${app.analysis.process-timeout-seconds}")
    private long timeoutSeconds;

    Optional<String> analyze(File input) {
        List<String> command = List.of(keyfinderCommand, "-n", "camelot", input.getAbsolutePath());

        ProcessResult result = processRunner.run(command, Duration.ofSeconds(timeoutSeconds));
        if (!result.success()) {
            return Optional.empty();
        }

        String key = result.output().trim();
        return key.isEmpty() ? Optional.empty() : Optional.of(key);
    }
}
