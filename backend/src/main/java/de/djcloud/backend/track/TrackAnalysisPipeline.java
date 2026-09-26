package de.djcloud.backend.track;

import java.io.File;
import java.util.Locale;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.function.Consumer;

import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Runs the five analysis steps for one track, in order: validate the upload's integrity, remux it
 * (strip any DJ-software metadata/chunks, re-encoding to WAV for anything that isn't already
 * mp3/wav), generate a streaming preview, detect BPM, detect musical key. The first step to fail
 * (or any unexpected exception) marks the track {@code FAILED} and skips the rest — this method
 * must never let an exception escape, since it runs directly on the single analysis worker thread
 * and an uncaught exception there would silently kill and respawn that thread.
 */
@Component
@RequiredArgsConstructor
@Slf4j
class TrackAnalysisPipeline {

    private final TrackAnalysisStatusService statusService;
    private final TrackStorageService trackStorageService;
    private final AudioIntegrityValidator audioIntegrityValidator;
    private final AudioRemuxer audioRemuxer;
    private final AudioMetadataReader audioMetadataReader;
    private final AudioMetadataWriter audioMetadataWriter;
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

        File currentFile = original;
        File remuxOutput = null;
        File previewFile = null;
        File decodedWav = null;
        try {
            onStep.accept(AnalysisStep.VALIDATION);
            if (!audioIntegrityValidator.validate(original)) {
                fail(trackId, previewFile, null, "validation");
                return;
            }

            onStep.accept(AnalysisStep.REMUX);
            Optional<TrackAnalysisStatusService.RemuxMetadata> metadata = statusService.findRemuxMetadata(trackId);
            if (metadata.isEmpty()) {
                return; // track was deleted mid-pipeline; nothing created yet to clean up
            }
            CoverArt coverArt = audioMetadataReader.readArtwork(original);
            String sourceExtension = extensionOf(fileName.get());
            String targetExtension = audioRemuxer.targetExtension(sourceExtension);
            remuxOutput = trackStorageService.newTrackFile(targetExtension);

            // Passed straight to ffmpeg as -metadata flags too (see AudioRemuxer's class doc) —
            // for WAV output that's what actually lands in the RIFF INFO chunk; the jaudiotagger
            // write below only ever reaches the separate ID3 sub-chunk for WAV.
            if (!audioRemuxer.remux(original, sourceExtension, remuxOutput, metadata.get())) {
                fail(trackId, previewFile, remuxOutput, "remux");
                return;
            }
            if (!audioIntegrityValidator.validate(remuxOutput)) {
                fail(trackId, previewFile, remuxOutput, "post-remux validation");
                return;
            }

            try {
                audioMetadataWriter.write(remuxOutput, metadata.get().title(), null, 0, metadata.get().artistNames(),
                        metadata.get().genreNames());
                if (coverArt != null) {
                    audioMetadataWriter.writeArtwork(remuxOutput, coverArt.data(), coverArt.mimeType());
                }
                audioMetadataWriter.writeInternalId(remuxOutput, trackId);
            } catch (AudioMetadataException ex) {
                fail(trackId, previewFile, remuxOutput, "reapplying metadata after remux");
                return;
            }

            boolean remuxCommitted = statusService.completeRemux(trackId, remuxOutput.getName(), targetExtension,
                    remuxOutput.length());
            if (!remuxCommitted) {
                trackStorageService.delete(remuxOutput);
                return; // track was deleted mid-pipeline
            }
            trackStorageService.delete(original);
            currentFile = remuxOutput;
            remuxOutput = null; // now the track's real file — fail() below must never delete it

            onStep.accept(AnalysisStep.PREVIEW_GENERATION);
            previewFile = trackStorageService.newPreviewFile();
            if (!previewGenerator.generate(currentFile, previewFile)) {
                fail(trackId, previewFile, null, "preview generation");
                return;
            }

            // aubio's plain Windows build (and possibly other analysis tools) can't read mp3
            // directly, so decode to a plain WAV once here and hand that to both BPM and key
            // analysis instead of the (already remuxed) track file.
            decodedWav = audioDecoder.decodeToWav(currentFile);
            if (decodedWav == null) {
                fail(trackId, previewFile, null, "decoding for analysis");
                return;
            }

            onStep.accept(AnalysisStep.BPM_ANALYSIS);
            OptionalInt bpm = bpmAnalyzer.analyze(decodedWav);
            if (bpm.isEmpty()) {
                fail(trackId, previewFile, null, "BPM analysis");
                return;
            }

            onStep.accept(AnalysisStep.KEY_ANALYSIS);
            Optional<String> key = keyAnalyzer.analyze(decodedWav);
            if (key.isEmpty()) {
                fail(trackId, previewFile, null, "key analysis");
                return;
            }

            boolean stillReady = statusService.markReady(trackId, previewFile.getName(), bpm.getAsInt(), key.get());
            if (!stillReady) {
                trackStorageService.deletePreviewByFileName(previewFile.getName());
            }
        } catch (Exception ex) {
            log.error("Unexpected error analyzing track {}", trackId, ex);
            fail(trackId, previewFile, remuxOutput, "unexpected error");
        } finally {
            if (decodedWav != null) {
                decodedWav.delete();
            }
        }
    }

    /**
     * @param remuxFile a partially-produced remux output still to be cleaned up — must be {@code
     *     null} once the remux has actually been committed via {@link
     *     TrackAnalysisStatusService#completeRemux}, since after that point it IS the track's file,
     *     not a discardable artifact.
     */
    private void fail(Long trackId, File previewFile, File remuxFile, String stage) {
        log.warn("Analysis failed for track {} during {}", trackId, stage);
        if (previewFile != null) {
            trackStorageService.deletePreviewByFileName(previewFile.getName());
        }
        if (remuxFile != null) {
            trackStorageService.delete(remuxFile);
        }
        statusService.markFailed(trackId);
    }

    private static String extensionOf(String fileName) {
        int dotIndex = fileName.lastIndexOf('.');
        return dotIndex < 0 ? "" : fileName.substring(dotIndex + 1).toLowerCase(Locale.ROOT);
    }
}
