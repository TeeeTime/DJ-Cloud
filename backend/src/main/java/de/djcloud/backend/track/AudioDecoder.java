package de.djcloud.backend.track;

import java.io.File;
import java.io.IOException;
import java.time.Duration;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import de.djcloud.backend.track.ExternalProcessRunner.ProcessResult;
import lombok.RequiredArgsConstructor;

/**
 * Decodes the original upload down to a plain WAV via ffmpeg before handing it to the BPM/key
 * analysis tools. This exists because aubio's plain Windows build can only read formats libsndfile
 * understands (not mp3 — it fails with "could not find RIFF header"), and getting an mp3-capable
 * aubio build on Windows would mean pairing it with a specific old ffmpeg "dev" package that's no
 * longer available (its former host, Zeranoe, shut down years ago). Decoding through the ffmpeg
 * already relied on for preview generation sidesteps that entirely, for every analysis tool.
 */
@Component
@RequiredArgsConstructor
class AudioDecoder {

    private final ExternalProcessRunner processRunner;

    @Value("${app.analysis.ffmpeg-command}")
    private String ffmpegCommand;

    @Value("${app.analysis.process-timeout-seconds}")
    private long timeoutSeconds;

    /** Returns null on failure. Caller owns the returned file and must delete it once done. */
    File decodeToWav(File input) {
        File output;
        try {
            output = File.createTempFile("track-analysis-", ".wav");
        } catch (IOException ex) {
            return null;
        }

        List<String> command = List.of(ffmpegCommand, "-y", "-i", input.getAbsolutePath(), "-ar", "44100", "-ac",
                "2", output.getAbsolutePath());

        ProcessResult result = processRunner.run(command, Duration.ofSeconds(timeoutSeconds));
        if (!result.success()) {
            output.delete();
            return null;
        }
        return output;
    }
}
