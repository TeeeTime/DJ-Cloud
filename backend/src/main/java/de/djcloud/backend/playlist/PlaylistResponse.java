package de.djcloud.backend.playlist;

import java.time.Instant;
import java.util.List;

public record PlaylistResponse(Long id, String name, boolean isPublic, String ownerUsername, Instant createdAt,
                                int trackCount, boolean subscribed, List<String> topGenres) {

    /** Package-visible so {@link PlaylistService} can size its own genre ranking the same way. */
    static final int TOP_GENRES_LIMIT = 3;

    public static PlaylistResponse fromEntity(Playlist playlist, boolean subscribed, int trackCount,
            List<String> topGenres) {
        return new PlaylistResponse(playlist.getId(), playlist.getName(), playlist.isPublic(),
                playlist.getOwner().getUsername(), playlist.getCreatedAt(), trackCount, subscribed, topGenres);
    }
}
