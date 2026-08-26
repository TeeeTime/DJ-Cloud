package de.djcloud.backend.artist;

import java.util.HashSet;
import java.util.List;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ArtistService {

    private final ArtistRepository artistRepository;

    @Transactional(readOnly = true)
    public List<ArtistResponse> autocomplete(String query, int limit) {
        if (query == null || query.isBlank()) {
            return List.of();
        }

        Pageable pageable = PageRequest.of(0, limit);

        return artistRepository.findByNameContainingIgnoreCaseOrderByNameAsc(query.trim(), pageable).stream()
                .map(ArtistResponse::fromEntity)
                .toList();
    }

    @Transactional
    public ArtistResponse create(ArtistRequest request) {
        if (artistRepository.existsByNameIgnoreCase(request.name())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Artist already exists");
        }

        Artist artist = new Artist();
        artist.setName(request.name());

        return ArtistResponse.fromEntity(artistRepository.save(artist));
    }

    @Transactional
    public ArtistResponse update(Long id, ArtistRequest request) {
        Artist artist = findOrThrow(id);
        artist.setName(request.name());

        return ArtistResponse.fromEntity(artistRepository.save(artist));
    }

    /** Looks up an artist by name (case-insensitive), creating one if none exists yet. */
    @Transactional
    public Artist findOrCreateByName(String name) {
        return artistRepository.findByNameIgnoreCase(name)
                .orElseGet(() -> {
                    Artist artist = new Artist();
                    artist.setName(name);
                    return artistRepository.save(artist);
                });
    }

    @Transactional
    public void delete(Long id) {
        Artist artist = findOrThrow(id);

        // clear the join-table rows from the owning (Track) side first, so no track is left
        // pointing at an artist id that no longer exists
        new HashSet<>(artist.getSongs()).forEach(track -> track.getArtists().remove(artist));

        artistRepository.delete(artist);
    }

    private Artist findOrThrow(Long id) {
        return artistRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Artist not found"));
    }
}
