package de.djcloud.backend.track;

import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;

/**
 * The only class in the analysis pipeline that touches the database. Kept to short, separate
 * transactions — one {@code findById} + mutate + {@code save} each — so a transaction is never held
 * open across a slow external-process call, which matters given this app's SQLite connection pool is
 * capped at a single connection.
 *
 * <p>Every method re-fetches by id and is a safe no-op if the track was deleted while queued or
 * mid-processing, rather than throwing.
 */
@Service
@RequiredArgsConstructor
class TrackAnalysisStatusService {

    private final TrackRepository trackRepository;

    @Transactional
    Optional<String> markProcessing(Long trackId) {
        return trackRepository.findById(trackId).map(track -> {
            track.setStatus(TrackStatus.PROCESSING);
            trackRepository.save(track);
            return track.getFileName();
        });
    }

    @Transactional
    boolean markReady(Long trackId, String previewFileName, int bpm, String key) {
        return trackRepository.findById(trackId).map(track -> {
            track.setStatus(TrackStatus.READY);
            track.setPreviewFileName(previewFileName);
            track.setBpm(bpm);
            track.setKey(key);
            trackRepository.save(track);
            return true;
        }).orElse(false);
    }

    @Transactional
    void markFailed(Long trackId) {
        trackRepository.findById(trackId).ifPresent(track -> {
            track.setStatus(TrackStatus.FAILED);
            trackRepository.save(track);
        });
    }
}
