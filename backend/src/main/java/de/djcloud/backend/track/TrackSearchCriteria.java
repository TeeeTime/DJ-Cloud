package de.djcloud.backend.track;

import java.util.List;

import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * Parameters shared by every backend-driven track listing: the main library ({@code GET /api/tracks}),
 * a single playlist's track list, and the "add track to playlist" search — all three now go through
 * {@link TrackService#search(TrackSearchCriteria)} instead of each having their own query logic.
 */
public record TrackSearchCriteria(String query, TrackSortField sortBy, Sort.Direction direction, int page, int size,
                                   Long scopeToPlaylistId, Long scopeToGenreId, Long excludePlaylistId,
                                   Integer minBpm, Integer maxBpm, Integer minDurationSeconds,
                                   Integer maxDurationSeconds, List<String> genres) {

    /** Parses the raw request params shared by every controller endpoint backed by this criteria. */
    public static TrackSearchCriteria fromParams(String query, String sortBy, String direction, int page, int size,
            Long excludePlaylistId, Integer minBpm, Integer maxBpm, Integer minDurationSeconds,
            Integer maxDurationSeconds, List<String> genres) {
        return new TrackSearchCriteria(query, TrackSortField.fromParam(sortBy), parseDirection(direction), page,
                size, null, null, excludePlaylistId, minBpm, maxBpm, minDurationSeconds, maxDurationSeconds,
                genres == null ? List.of() : genres);
    }

    public TrackSearchCriteria withScopeToPlaylistId(Long playlistId) {
        return new TrackSearchCriteria(query, sortBy, direction, page, size, playlistId, scopeToGenreId,
                excludePlaylistId, minBpm, maxBpm, minDurationSeconds, maxDurationSeconds, genres);
    }

    public TrackSearchCriteria withScopeToGenreId(Long genreId) {
        return new TrackSearchCriteria(query, sortBy, direction, page, size, scopeToPlaylistId, genreId,
                excludePlaylistId, minBpm, maxBpm, minDurationSeconds, maxDurationSeconds, genres);
    }

    private static Sort.Direction parseDirection(String direction) {
        try {
            return Sort.Direction.fromString(direction);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown direction value: " + direction);
        }
    }
}
