package de.djcloud.backend.track;

import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import de.djcloud.backend.artist.Artist;
import de.djcloud.backend.artist.ArtistRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class TrackService {

    private final TrackRepository trackRepository;
    private final ArtistRepository artistRepository;

    @Transactional(readOnly = true)
    public Page<TrackResponse> findAll(Pageable pageable) {
        return trackRepository.findAll(pageable).map(TrackResponse::fromEntity);
    }

    @Transactional(readOnly = true)
    public TrackResponse findById(Long id) {
        return TrackResponse.fromEntity(findOrThrow(id));
    }

    @Transactional
    public TrackResponse update(Long id, TrackUpdateRequest request) {
        Track track = findOrThrow(id);

        track.setTitle(request.title());
        track.setDurationSeconds(request.durationSeconds());
        track.setKey(request.key());
        track.setBpm(request.bpm());
        track.setFileFormat(request.fileFormat());
        track.setStatus(request.status());

        Set<Artist> artists = request.artistIds().stream()
                .map(artistId -> artistRepository.findById(artistId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                "Unknown artist id: " + artistId)))
                .collect(Collectors.toSet());
        track.setArtists(artists);

        return TrackResponse.fromEntity(trackRepository.save(track));
    }

    @Transactional
    public void delete(Long id) {
        Track track = findOrThrow(id);
        trackRepository.delete(track);
    }

    private Track findOrThrow(Long id) {
        return trackRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Track not found"));
    }
}
