package de.djcloud.backend.track;

import java.io.File;
import java.time.Duration;
import java.util.List;
import java.util.Objects;
import java.util.OptionalInt;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import de.djcloud.backend.track.ExternalProcessRunner.ProcessResult;
import lombok.RequiredArgsConstructor;

/**
 * Detects a track's BPM via the {@code aubiotrack} CLI (one of the command-line tools bundled with
 * aubio's precompiled binaries — see the "aubio" example programs). Run as {@code aubiotrack -i
 * <file>}, it prints one detected beat timestamp per line, in seconds (aubio's default {@code
 * --time-format}); BPM is derived from the average interval between the first and last beat. This
 * parsing is intentionally isolated here so it's easy to adjust if a different aubio build/tool is
 * used instead.
 */
@Component
@RequiredArgsConstructor
class BpmAnalyzer {

    private final ExternalProcessRunner processRunner;

    @Value("${app.analysis.bpm.command}")
    private String aubioCommand;

    @Value("${app.analysis.process-timeout-seconds}")
    private long timeoutSeconds;

    OptionalInt analyze(File input) {
        List<String> command = List.of(aubioCommand, "-i", input.getAbsolutePath());

        ProcessResult result = processRunner.run(command, Duration.ofSeconds(timeoutSeconds));
        if (!result.success()) {
            return OptionalInt.empty();
        }

        return parseBpm(result.output());
    }

    static OptionalInt parseBpm(String output) {
        List<Double> beatTimes = output.lines()
                .map(String::trim)
                .filter(line -> !line.isEmpty())
                .map(BpmAnalyzer::parseDoubleOrNull)
                .filter(Objects::nonNull)
                .toList();

        // Need at least two beats to derive an interval; a track with fewer detected beats than
        // that can't yield a meaningful BPM.
        if (beatTimes.size() < 2) {
            return OptionalInt.empty();
        }

        double durationSeconds = beatTimes.get(beatTimes.size() - 1) - beatTimes.get(0);
        if (durationSeconds <= 0) {
            return OptionalInt.empty();
        }

        double bpm = 60.0 * (beatTimes.size() - 1) / durationSeconds;
        return OptionalInt.of((int) Math.round(bpm));
    }

    private static Double parseDoubleOrNull(String value) {
        try {
            return Double.parseDouble(value);
        } catch (NumberFormatException ex) {
            return null;
        }
    }
}
