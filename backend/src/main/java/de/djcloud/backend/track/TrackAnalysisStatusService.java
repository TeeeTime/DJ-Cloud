package de.djcloud.backend.track;

import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import de.djcloud.backend.artist.Artist;
import de.djcloud.backend.genre.Genre;
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

    /** Plain artist/genre names for re-embedding into a remuxed file — see {@link
     * AudioMetadataWriter}'s name-collection {@code write} overload for why these are extracted
     * here, inside the transaction, rather than handed out as entities. */
    record RemuxMetadata(String title, Set<String> artistNames, Set<String> genreNames) {
    }

    @Transactional(readOnly = true)
    Optional<RemuxMetadata> findRemuxMetadata(Long trackId) {
        return trackRepository.findById(trackId).map(track -> new RemuxMetadata(track.getTitle(),
                track.getArtists().stream().map(Artist::getName).collect(Collectors.toCollection(LinkedHashSet::new)),
                track.getGenres().stream().map(Genre::getName).collect(Collectors.toCollection(LinkedHashSet::new))));
    }

    /** Swaps a track's stored file over to the remux step's output. Returns false (a safe no-op
     * for the caller) if the track was deleted mid-pipeline. */
    @Transactional
    boolean completeRemux(Long trackId, String newFileName, String newFileFormat, long newSizeBytes) {
        return trackRepository.findById(trackId).map(track -> {
            track.setFileName(newFileName);
            track.setFileFormat(newFileFormat);
            track.setSizeBytes(newSizeBytes);
            trackRepository.save(track);
            return true;
        }).orElse(false);
    }
}
