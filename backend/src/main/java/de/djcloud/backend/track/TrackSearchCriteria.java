package de.djcloud.backend.track;

import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * Parameters shared by every backend-driven track listing: the main library ({@code GET /api/tracks}),
 * a single playlist's track list, and the "add track to playlist" search — all three now go through
 * {@link TrackService#search(TrackSearchCriteria)} instead of each having their own query logic.
 */
public record TrackSearchCriteria(String query, TrackSortField sortBy, Sort.Direction direction, int page, int size,
                                   Long scopeToPlaylistId, Long excludePlaylistId) {

    /** Parses the raw request params shared by every controller endpoint backed by this criteria. */
    public static TrackSearchCriteria fromParams(String query, String sortBy, String direction, int page, int size,
            Long excludePlaylistId) {
        return new TrackSearchCriteria(query, TrackSortField.fromParam(sortBy), parseDirection(direction), page,
                size, null, excludePlaylistId);
    }

    public TrackSearchCriteria withScopeToPlaylistId(Long playlistId) {
        return new TrackSearchCriteria(query, sortBy, direction, page, size, playlistId, excludePlaylistId);
    }

    private static Sort.Direction parseDirection(String direction) {
        try {
            return Sort.Direction.fromString(direction);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown direction value: " + direction);
        }
    }
}
