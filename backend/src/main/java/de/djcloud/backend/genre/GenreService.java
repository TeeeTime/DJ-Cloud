package de.djcloud.backend.genre;

import java.time.Instant;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import de.djcloud.backend.auth.AppUserDetails;
import de.djcloud.backend.common.PageResponse;
import de.djcloud.backend.track.TrackDownloadService;
import de.djcloud.backend.track.TrackResponse;
import de.djcloud.backend.track.TrackSearchCriteria;
import de.djcloud.backend.track.TrackService;
import de.djcloud.backend.user.User;
import de.djcloud.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class GenreService {

    private final GenreRepository genreRepository;
    private final GenreSyncRepository genreSyncRepository;
    private final TrackService trackService;
    private final TrackDownloadService trackDownloadService;
    private final UserRepository userRepository;

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
     * Every genre annotated with whether the caller has sync enabled for it — mirrors
     * {@code PlaylistService.findAll}'s batching pattern (one {@code findByUserId} query into a
     * set, not one query per genre).
     */
    @Transactional(readOnly = true)
    public List<GenreSyncResponse> findAllWithSyncState(AppUserDetails caller) {
        Set<Long> syncEnabledGenreIds = genreSyncRepository.findByUserId(caller.getId()).stream()
                .map(s -> s.getGenre().getId())
                .collect(Collectors.toSet());

        return genreRepository.findAll().stream()
                .sorted(Comparator.comparing(Genre::getName))
                .map(genre -> GenreSyncResponse.fromEntity(genre, syncEnabledGenreIds.contains(genre.getId())))
                .toList();
    }

    /**
     * Marks this genre to be downloaded to the caller's local library by the desktop app —
     * genres have no owner, so this is the only way a genre ever ends up syncing. Matched
     * case-insensitively by name (not id), same lookup as {@link #getTracks}.
     */
    @Transactional
    public GenreSyncResponse enableSync(String name, AppUserDetails caller) {
        Genre genre = findOrThrowByName(name);

        if (genreSyncRepository.findByGenreIdAndUserId(genre.getId(), caller.getId()).isEmpty()) {
            User user = userRepository.findById(caller.getId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

            GenreSync sync = new GenreSync();
            sync.setGenre(genre);
            sync.setUser(user);
            sync.setSyncEnabledAt(Instant.now());
            genreSyncRepository.save(sync);
        }

        return GenreSyncResponse.fromEntity(genre, true);
    }

    @Transactional
    public GenreSyncResponse disableSync(String name, AppUserDetails caller) {
        Genre genre = findOrThrowByName(name);

        genreSyncRepository.deleteByGenreIdAndUserId(genre.getId(), caller.getId());

        return GenreSyncResponse.fromEntity(genre, false);
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

    /**
     * Materializes download-ready entries for every track tagged with this genre — the full,
     * unpaged collection (unlike {@link #getTracks}, which is paged for browsing).
     */
    @Transactional(readOnly = true)
    public List<TrackDownloadService.TrackDownloadEntry> getDownloadEntries(String name) {
        Genre genre = genreRepository.findByNameIgnoreCase(name)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Genre not found"));

        return trackDownloadService.toDownloadEntries(genre.getSongs());
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

        genreSyncRepository.deleteByGenreId(id);

        // clear the join-table rows from the owning (Track) side first, so no track is left
        // pointing at a genre id that no longer exists
        new HashSet<>(genre.getSongs()).forEach(track -> track.getGenres().remove(genre));

        genreRepository.delete(genre);
    }

    private Genre findOrThrow(Long id) {
        return genreRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Genre not found"));
    }

    private Genre findOrThrowByName(String name) {
        return genreRepository.findByNameIgnoreCase(name)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Genre not found"));
    }
}
