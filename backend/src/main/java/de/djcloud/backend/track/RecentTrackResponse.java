package de.djcloud.backend.track;

import java.time.Instant;
import java.util.List;

public record RecentTrackResponse(Long id, String title, List<String> artists, Instant addedAt, boolean isNew,
                                   TrackStatus status) {

    public static RecentTrackResponse fromEntity(Track track, boolean isNew) {
        List<String> artistNames = track.getArtists().stream()
                .map(artist -> artist.getName())
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .toList();

        return new RecentTrackResponse(track.getId(), track.getTitle(), artistNames, track.getAddedAt(), isNew,
                track.getStatus());
    }
}
