package de.djcloud.backend.playlist;

import java.time.Instant;

public record PlaylistDetailResponse(Long id, String name, boolean isPublic, String ownerUsername,
                                      Instant createdAt, boolean canEditTracks, boolean subscribed,
                                      int trackCount) {

    /**
     * Track membership is no longer embedded here — see {@code GET /api/playlists/{id}/tracks}, which
     * supports the same backend-driven search/sort/paging as the main library.
     */
    public static PlaylistDetailResponse fromEntity(Playlist playlist, boolean canEditTracks, boolean subscribed) {
        return new PlaylistDetailResponse(playlist.getId(), playlist.getName(), playlist.isPublic(),
                playlist.getOwner().getUsername(), playlist.getCreatedAt(), canEditTracks, subscribed,
                playlist.getTracks().size());
    }
}
