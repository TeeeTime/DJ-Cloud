package de.djcloud.backend.track;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.Test;

/** Only {@code FAILED} tracks get requeued on startup — see TrackAnalysisStartupRunner's javadoc
 * for why the previous "requeue everything" behavior was dropped. */
class TrackAnalysisStartupRunnerTest {

    @Test
    void onlyRequeuesFailedTracks() {
        TrackRepository trackRepository = mock(TrackRepository.class);
        TrackAnalysisQueue trackAnalysisQueue = mock(TrackAnalysisQueue.class);

        Track failed = new Track();
        failed.setId(1L);
        failed.setTitle("Broken Song");
        failed.setStatus(TrackStatus.FAILED);
        when(trackRepository.findByStatus(TrackStatus.FAILED)).thenReturn(List.of(failed));

        new TrackAnalysisStartupRunner(trackRepository, trackAnalysisQueue).run(null);

        assertThat(failed.getStatus()).isEqualTo(TrackStatus.QUEUED);
        verify(trackRepository).saveAll(anyList());
        verify(trackAnalysisQueue).enqueue(1L, "Broken Song");
        verify(trackRepository, never()).findAllByOrderById();
    }

    @Test
    void doesNothingWhenNoTrackIsFailed() {
        TrackRepository trackRepository = mock(TrackRepository.class);
        TrackAnalysisQueue trackAnalysisQueue = mock(TrackAnalysisQueue.class);
        when(trackRepository.findByStatus(TrackStatus.FAILED)).thenReturn(List.of());

        new TrackAnalysisStartupRunner(trackRepository, trackAnalysisQueue).run(null);

        verify(trackAnalysisQueue, never()).enqueue(org.mockito.ArgumentMatchers.anyLong(), org.mockito.ArgumentMatchers.anyString());
    }
}
