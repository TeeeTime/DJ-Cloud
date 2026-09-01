package de.djcloud.backend.genre;

import java.util.HashSet;
import java.util.List;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import de.djcloud.backend.common.PageResponse;
import de.djcloud.backend.track.TrackResponse;
import de.djcloud.backend.track.TrackSearchCriteria;
import de.djcloud.backend.track.TrackService;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class GenreService {

    private final GenreRepository genreRepository;
    private final TrackService trackService;

    @Transactional(readOnly = true)
    public List<GenreResponse> autocomplete(String query, int limit) {
        if (query == null || query.isBlank()) {
            return List.of();
        }

        Pageable pageable = PageRequest.of(0, limit);

        return genreRepository.findByNameContainingIgnoreCaseOrderByNameAsc(query.trim(), pageable).stream()
                .map(GenreResponse::fromEntity)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<GenreDistributionResponse> distribution() {
        return genreRepository.distribution();
    }

    /**
     * Same backend-driven search/sort/paging as {@code GET /api/tracks}, scoped to tracks tagged
     * with this genre — mirrors {@code PlaylistService.getTracks}.
     */
    @Transactional(readOnly = true)
    public PageResponse<TrackResponse> getTracks(String name, TrackSearchCriteria criteria) {
        Genre genre = genreRepository.findByNameIgnoreCase(name)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Genre not found"));

        return trackService.search(criteria.withScopeToGenreId(genre.getId()));
    }

    @Transactional
    public GenreResponse create(GenreRequest request) {
        if (genreRepository.existsByNameIgnoreCase(request.name())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Genre already exists");
        }

        Genre genre = new Genre();
        genre.setName(request.name());

        return GenreResponse.fromEntity(genreRepository.save(genre));
    }

    @Transactional
    public GenreResponse update(Long id, GenreRequest request) {
        Genre genre = findOrThrow(id);
        genre.setName(request.name());

        return GenreResponse.fromEntity(genreRepository.save(genre));
    }

    /** Looks up a genre by name (case-insensitive), creating one if none exists yet. */
    @Transactional
    public Genre findOrCreateByName(String name) {
        return genreRepository.findByNameIgnoreCase(name)
                .orElseGet(() -> {
                    Genre genre = new Genre();
                    genre.setName(name);
                    return genreRepository.save(genre);
                });
    }

    @Transactional
    public void delete(Long id) {
        Genre genre = findOrThrow(id);

        // clear the join-table rows from the owning (Track) side first, so no track is left
        // pointing at a genre id that no longer exists
        new HashSet<>(genre.getSongs()).forEach(track -> track.getGenres().remove(genre));

        genreRepository.delete(genre);
    }

    private Genre findOrThrow(Long id) {
        return genreRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Genre not found"));
    }
}
