package de.djcloud.backend.track;

import java.io.File;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.function.Consumer;

import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Runs the three analysis steps for one track, in order: generate a streaming preview, detect BPM,
 * detect musical key. The first step to fail (or any unexpected exception) marks the track
 * {@code FAILED} and skips the rest — this method must never let an exception escape, since it runs
 * directly on the single analysis worker thread and an uncaught exception there would silently kill
 * and respawn that thread.
 */
@Component
@RequiredArgsConstructor
@Slf4j
class TrackAnalysisPipeline {

    private final TrackAnalysisStatusService statusService;
    private final TrackStorageService trackStorageService;
    private final PreviewGenerator previewGenerator;
    private final AudioDecoder audioDecoder;
    private final BpmAnalyzer bpmAnalyzer;
    private final KeyAnalyzer keyAnalyzer;

    void run(Long trackId, Consumer<AnalysisStep> onStep) {
        Optional<String> fileName = statusService.markProcessing(trackId);
        if (fileName.isEmpty()) {
            return; // track was deleted before its turn came up
        }

        File original = fileName.get() == null ? null : trackStorageService.resolve(fileName.get());
        if (original == null || !original.exists()) {
            log.warn("Track {} has no audio file on disk; marking analysis failed", trackId);
            statusService.markFailed(trackId);
            return;
        }

        File previewFile = null;
        File decodedWav = null;
        try {
            onStep.accept(AnalysisStep.PREVIEW_GENERATION);
            previewFile = trackStorageService.newPreviewFile();
            if (!previewGenerator.generate(original, previewFile)) {
                fail(trackId, previewFile, "preview generation");
                return;
            }

            // aubio's plain Windows build (and possibly other analysis tools) can't read mp3
            // directly, so decode to a plain WAV once here and hand that to both BPM and key
            // analysis instead of the original file.
            decodedWav = audioDecoder.decodeToWav(original);
            if (decodedWav == null) {
                fail(trackId, previewFile, "decoding for analysis");
                return;
            }

            onStep.accept(AnalysisStep.BPM_ANALYSIS);
            OptionalInt bpm = bpmAnalyzer.analyze(decodedWav);
            if (bpm.isEmpty()) {
                fail(trackId, previewFile, "BPM analysis");
                return;
            }

            onStep.accept(AnalysisStep.KEY_ANALYSIS);
            Optional<String> key = keyAnalyzer.analyze(decodedWav);
            if (key.isEmpty()) {
                fail(trackId, previewFile, "key analysis");
                return;
            }

            boolean stillExists = statusService.markReady(trackId, previewFile.getName(), bpm.getAsInt(), key.get());
            if (!stillExists) {
                trackStorageService.deletePreviewByFileName(previewFile.getName());
            }
        } catch (Exception ex) {
            log.error("Unexpected error analyzing track {}", trackId, ex);
            fail(trackId, previewFile, "unexpected error");
        } finally {
            if (decodedWav != null) {
                decodedWav.delete();
            }
        }
    }

    private void fail(Long trackId, File previewFile, String stage) {
        log.warn("Analysis failed for track {} during {}", trackId, stage);
        if (previewFile != null) {
            trackStorageService.deletePreviewByFileName(previewFile.getName());
        }
        statusService.markFailed(trackId);
    }
}
