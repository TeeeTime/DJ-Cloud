package de.djcloud.backend.track;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.TimeUnit;

import org.springframework.stereotype.Component;

import lombok.extern.slf4j.Slf4j;

/**
 * Thin, reusable wrapper around {@link ProcessBuilder} for the external CLI tools the analysis
 * pipeline shells out to (ffmpeg, aubio, keyfinder-cli). A failure to even start the process (e.g.
 * the binary isn't on PATH) is reported the same way as a non-zero exit — callers only ever need to
 * check {@link ProcessResult#success()}.
 */
@Component
@Slf4j
class ExternalProcessRunner {

    /** Combined stdout+stderr output is always captured, since these tools vary in which they use. */
    record ProcessResult(int exitCode, String output, boolean timedOut) {
        boolean success() {
            return !timedOut && exitCode == 0;
        }
    }

    ProcessResult run(List<String> command, Duration timeout) {
        Process process;
        try {
            process = new ProcessBuilder(command).redirectErrorStream(true).start();
        } catch (IOException ex) {
            log.warn("Could not start process {}", command, ex);
            return new ProcessResult(-1, String.valueOf(ex.getMessage()), false);
        }

        // Drain the output pipe on a separate thread while we wait — reading it after waitFor()
        // returns risks a deadlock if the process fills its output buffer before exiting.
        ByteArrayOutputStream captured = new ByteArrayOutputStream();
        Thread reader = new Thread(() -> {
            try {
                process.getInputStream().transferTo(captured);
            } catch (IOException ignored) {
                // The stream simply closes when the process ends or is destroyed.
            }
        }, "external-process-reader");
        reader.start();

        boolean finished;
        try {
            finished = process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            process.destroyForcibly();
            return new ProcessResult(-1, "Interrupted while waiting for: " + command, true);
        }

        if (!finished) {
            process.destroyForcibly();
        }

        try {
            reader.join(TimeUnit.SECONDS.toMillis(5));
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
        }

        String output = captured.toString(StandardCharsets.UTF_8);
        return finished ? new ProcessResult(process.exitValue(), output, false)
                : new ProcessResult(-1, output, true);
    }
}
