package de.djcloud.backend.track;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * Covers {@link TrackAnalysisPipeline#run}'s control flow around the two new steps — in
 * particular the failure-cleanup guarantee that the pre-remux original file is only ever deleted
 * once the remux output has passed re-validation AND the DB swap has committed.
 */
class TrackAnalysisPipelineTest {

    private static final Long TRACK_ID = 42L;
    private static final TrackAnalysisStatusService.RemuxMetadata METADATA = new TrackAnalysisStatusService.RemuxMetadata(
            "Title", Set.of(), Set.of());

    private TrackAnalysisStatusService statusService;
    private TrackStorageService trackStorageService;
    private AudioIntegrityValidator audioIntegrityValidator;
    private AudioRemuxer audioRemuxer;
    private PreviewGenerator previewGenerator;
    private AudioDecoder audioDecoder;
    private BpmAnalyzer bpmAnalyzer;
    private KeyAnalyzer keyAnalyzer;
    private TrackAnalysisPipeline pipeline;

    private File original;
    private File remuxOutput;
    private File previewFile;
    private File decodedWav;

    @BeforeEach
    void setUp(@TempDir File tempDir) throws IOException {
        statusService = mock(TrackAnalysisStatusService.class);
        trackStorageService = mock(TrackStorageService.class);
        audioIntegrityValidator = mock(AudioIntegrityValidator.class);
        audioRemuxer = mock(AudioRemuxer.class);
        AudioMetadataReader audioMetadataReader = mock(AudioMetadataReader.class);
        AudioMetadataWriter audioMetadataWriter = mock(AudioMetadataWriter.class);
        previewGenerator = mock(PreviewGenerator.class);
        audioDecoder = mock(AudioDecoder.class);
        bpmAnalyzer = mock(BpmAnalyzer.class);
        keyAnalyzer = mock(KeyAnalyzer.class);
        pipeline = new TrackAnalysisPipeline(statusService, trackStorageService, audioIntegrityValidator,
                audioRemuxer, audioMetadataReader, audioMetadataWriter, previewGenerator, audioDecoder, bpmAnalyzer,
                keyAnalyzer);

        original = new File(tempDir, "original.mp3");
        Files.write(original.toPath(), new byte[] { 1 });
        remuxOutput = new File(tempDir, "remux-output.mp3");
        Files.write(remuxOutput.toPath(), new byte[] { 2 });
        previewFile = new File(tempDir, "preview.mp3");
        decodedWav = new File(tempDir, "decoded.wav");

        when(statusService.markProcessing(TRACK_ID)).thenReturn(Optional.of("original.mp3"));
        when(trackStorageService.resolve("original.mp3")).thenReturn(original);
        when(audioRemuxer.targetExtension("mp3")).thenReturn("mp3");
        when(trackStorageService.newTrackFile("mp3")).thenReturn(remuxOutput);
        when(trackStorageService.newPreviewFile()).thenReturn(previewFile);
        when(audioIntegrityValidator.validate(original)).thenReturn(true);
        when(statusService.findRemuxMetadata(TRACK_ID)).thenReturn(Optional.of(METADATA));
    }

    @Test
    void happyPath_runsAllFiveStepsInOrderAndDeletesOriginalOnlyAfterCommit() {
        when(audioRemuxer.remux(original, "mp3", remuxOutput, METADATA)).thenReturn(true);
        when(audioIntegrityValidator.validate(remuxOutput)).thenReturn(true);
        when(statusService.completeRemux(TRACK_ID, remuxOutput.getName(), "mp3", remuxOutput.length()))
                .thenReturn(true);
        when(previewGenerator.generate(remuxOutput, previewFile)).thenReturn(true);
        when(audioDecoder.decodeToWav(remuxOutput)).thenReturn(decodedWav);
        when(bpmAnalyzer.analyze(decodedWav)).thenReturn(OptionalInt.of(128));
        when(keyAnalyzer.analyze(decodedWav)).thenReturn(Optional.of("Am"));
        when(statusService.markReady(TRACK_ID, previewFile.getName(), 128, "Am")).thenReturn(true);

        List<AnalysisStep> steps = new ArrayList<>();
        pipeline.run(TRACK_ID, steps::add);

        assertThat(steps).containsExactly(AnalysisStep.VALIDATION, AnalysisStep.REMUX,
                AnalysisStep.PREVIEW_GENERATION, AnalysisStep.BPM_ANALYSIS, AnalysisStep.KEY_ANALYSIS);
        verify(trackStorageService).delete(original);
        verify(trackStorageService, never()).delete(remuxOutput);
        verify(statusService, never()).markFailed(TRACK_ID);
    }

    @Test
    void validationFailure_neverInvokesRemuxerAndTouchesNoFiles() {
        when(audioIntegrityValidator.validate(original)).thenReturn(false);

        List<AnalysisStep> steps = new ArrayList<>();
        pipeline.run(TRACK_ID, steps::add);

        assertThat(steps).containsExactly(AnalysisStep.VALIDATION);
        verify(audioRemuxer, never()).remux(any(), any(), any(), any());
        verify(trackStorageService, never()).delete(any());
        verify(statusService).markFailed(TRACK_ID);
    }

    @Test
    void metadataMissingBeforeRemux_stopsWithoutTouchingFilesOrFailingTrack() {
        when(statusService.findRemuxMetadata(TRACK_ID)).thenReturn(Optional.empty());

        pipeline.run(TRACK_ID, step -> {
        });

        verify(audioRemuxer, never()).remux(any(), any(), any(), any());
        verify(trackStorageService, never()).delete(any());
        // the track was deleted mid-pipeline — not an analysis failure, so it must not be marked FAILED
        verify(statusService, never()).markFailed(TRACK_ID);
    }

    @Test
    void remuxFailure_deletesOnlyTheNewFileAndLeavesOriginalInPlace() {
        when(audioRemuxer.remux(original, "mp3", remuxOutput, METADATA)).thenReturn(false);

        pipeline.run(TRACK_ID, step -> {
        });

        verify(trackStorageService).delete(remuxOutput);
        verify(trackStorageService, never()).delete(original);
        verify(statusService).markFailed(TRACK_ID);
        verify(previewGenerator, never()).generate(any(), any());
    }

    @Test
    void postRemuxValidationFailure_deletesOnlyTheNewFileAndLeavesOriginalInPlace() {
        when(audioRemuxer.remux(original, "mp3", remuxOutput, METADATA)).thenReturn(true);
        when(audioIntegrityValidator.validate(remuxOutput)).thenReturn(false);

        pipeline.run(TRACK_ID, step -> {
        });

        verify(trackStorageService).delete(remuxOutput);
        verify(trackStorageService, never()).delete(original);
        verify(statusService).markFailed(TRACK_ID);
    }

    @Test
    void completeRemuxReturningFalse_cleansUpNewFileAndStopsWithoutFailingTrack() {
        when(audioRemuxer.remux(original, "mp3", remuxOutput, METADATA)).thenReturn(true);
        when(audioIntegrityValidator.validate(remuxOutput)).thenReturn(true);
        when(statusService.completeRemux(TRACK_ID, remuxOutput.getName(), "mp3", remuxOutput.length()))
                .thenReturn(false);

        pipeline.run(TRACK_ID, step -> {
        });

        verify(trackStorageService).delete(remuxOutput);
        verify(trackStorageService, never()).delete(original);
        verify(previewGenerator, never()).generate(any(), any());
        // the track was deleted mid-pipeline — not an analysis failure, so it must not be marked FAILED
        verify(statusService, never()).markFailed(TRACK_ID);
    }
}
