package de.djcloud.backend.track;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import de.djcloud.backend.artist.ArtistRepository;
import de.djcloud.backend.genre.GenreRepository;
import de.djcloud.backend.playlist.PlaylistTrackRepository;

/** Covers {@link TrackService#reanalyze} — the manual, single-track equivalent of what
 * TrackAnalysisStartupRunner does automatically for FAILED tracks on startup. */
class TrackServiceTest {

    private final TrackRepository trackRepository = mock(TrackRepository.class);
    private final TrackAnalysisQueue trackAnalysisQueue = mock(TrackAnalysisQueue.class);
    private final TrackService trackService = new TrackService(trackRepository, mock(ArtistRepository.class),
            mock(GenreRepository.class), mock(TrackStorageService.class), mock(AudioMetadataWriter.class),
            mock(PlaylistTrackRepository.class), trackAnalysisQueue);

    @Test
    void reanalyze_requeuesTheTrackRegardlessOfItsCurrentStatus() {
        Track track = new Track();
        track.setId(1L);
        track.setTitle("Some Song");
        track.setStatus(TrackStatus.READY);
        when(trackRepository.findById(1L)).thenReturn(Optional.of(track));

        trackService.reanalyze(1L);

        assertThat(track.getStatus()).isEqualTo(TrackStatus.QUEUED);
        verify(trackRepository).save(track);
        verify(trackAnalysisQueue).enqueue(1L, "Some Song");
    }

    @Test
    void reanalyze_aNonexistentTrack_throws404AndNeverEnqueues() {
        when(trackRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> trackService.reanalyze(99L))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
        verify(trackAnalysisQueue, never()).enqueue(org.mockito.ArgumentMatchers.anyLong(), org.mockito.ArgumentMatchers.anyString());
    }
}
