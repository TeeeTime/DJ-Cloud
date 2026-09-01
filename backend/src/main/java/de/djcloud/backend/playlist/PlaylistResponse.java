package de.djcloud.backend.playlist;

import java.time.Instant;

public record PlaylistResponse(Long id, String name, boolean isPublic, String ownerUsername, Instant createdAt,
                                int trackCount, boolean subscribed) {

    public static PlaylistResponse fromEntity(Playlist playlist, boolean subscribed) {
        return new PlaylistResponse(playlist.getId(), playlist.getName(), playlist.isPublic(),
                playlist.getOwner().getUsername(), playlist.getCreatedAt(), playlist.getTracks().size(), subscribed);
    }
}
