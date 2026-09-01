package de.djcloud.backend.playlist;

import java.time.Instant;
import java.util.List;

import de.djcloud.backend.track.TrackResponse;

public record PlaylistDetailResponse(Long id, String name, boolean isPublic, String ownerUsername,
                                      Instant createdAt, boolean canEditTracks, boolean subscribed,
                                      List<TrackResponse> tracks) {

    public static PlaylistDetailResponse fromEntity(Playlist playlist, boolean canEditTracks, boolean subscribed) {
        List<TrackResponse> tracks = playlist.getTracks().stream().map(TrackResponse::fromEntity).toList();

        return new PlaylistDetailResponse(playlist.getId(), playlist.getName(), playlist.isPublic(),
                playlist.getOwner().getUsername(), playlist.getCreatedAt(), canEditTracks, subscribed, tracks);
    }
}
