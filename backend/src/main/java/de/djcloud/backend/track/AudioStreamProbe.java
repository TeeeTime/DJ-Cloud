package de.djcloud.backend.track;

import java.io.File;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import de.djcloud.backend.track.ExternalProcessRunner.ProcessResult;
import lombok.RequiredArgsConstructor;

/**
 * Picks the ffmpeg PCM codec that matches a source file's own sample format/bit depth, via
 * ffprobe, so re-encoding a lossless source (e.g. a 24-bit FLAC) down to WAV during the remux
 * step doesn't silently downgrade it to ffmpeg's WAV default of 16-bit.
 */
@Component
@RequiredArgsConstructor
class AudioStreamProbe {

    private final ExternalProcessRunner processRunner;

    @Value("${app.analysis.ffprobe-command}")
    private String ffprobeCommand;

    @Value("${app.analysis.process-timeout-seconds}")
    private long timeoutSeconds;

    /** Falls back to {@code pcm_s16le} if the file can't be probed or reports nothing usable. */
    String selectPcmCodec(File input) {
        List<String> command = List.of(ffprobeCommand, "-v", "error", "-select_streams", "a:0",
                "-show_entries", "stream=sample_fmt,bits_per_raw_sample,bits_per_sample",
                "-of", "default=noprint_wrappers=1", input.getAbsolutePath());

        ProcessResult result = processRunner.run(command, Duration.ofSeconds(timeoutSeconds));
        if (!result.success()) {
            return "pcm_s16le";
        }

        return mapToPcmCodec(parseFields(result.output()));
    }

    /**
     * @param fields raw {@code key=value} pairs as printed by ffprobe's {@code default} writer —
     *     may include the literal string {@code "N/A"} for fields the source's codec doesn't
     *     report (e.g. {@code bits_per_raw_sample} on a plain 16-bit PCM stream).
     */
    static String mapToPcmCodec(Map<String, String> fields) {
        String sampleFormat = fields.getOrDefault("sample_fmt", "");

        if (sampleFormat.startsWith("dbl")) {
            return "pcm_f64le";
        }
        if (sampleFormat.startsWith("flt")) {
            return "pcm_f32le";
        }

        int bitDepth = firstPositiveInt(parseIntOrNull(fields.get("bits_per_raw_sample")),
                parseIntOrNull(fields.get("bits_per_sample")), inferBitsFromSampleFormat(sampleFormat));

        if (bitDepth >= 32) {
            return "pcm_s32le";
        }
        if (bitDepth > 16) {
            return "pcm_s24le";
        }
        return "pcm_s16le";
    }

    private static int firstPositiveInt(Integer... candidates) {
        for (Integer candidate : candidates) {
            if (candidate != null && candidate > 0) {
                return candidate;
            }
        }
        return 0;
    }

    /** Last-resort fallback: ffmpeg's integer sample formats encode their width in their name. */
    private static Integer inferBitsFromSampleFormat(String sampleFormat) {
        if (sampleFormat.startsWith("s64") || sampleFormat.startsWith("u64")) {
            return 64;
        }
        if (sampleFormat.startsWith("s32") || sampleFormat.startsWith("u32")) {
            return 32;
        }
        if (sampleFormat.startsWith("s16") || sampleFormat.startsWith("u16")) {
            return 16;
        }
        if (sampleFormat.startsWith("u8")) {
            return 8;
        }
        return null;
    }

    private static Integer parseIntOrNull(String value) {
        if (value == null) {
            return null;
        }
        try {
            return Integer.valueOf(value.trim());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static Map<String, String> parseFields(String output) {
        Map<String, String> fields = new HashMap<>();
        output.lines().map(String::trim).forEach(line -> {
            int separator = line.indexOf('=');
            if (separator > 0) {
                fields.put(line.substring(0, separator), line.substring(separator + 1));
            }
        });
        return fields;
    }
}
