package de.djcloud.backend.track;

import java.util.List;

/**
 * {@code newCount} is the *total* number of tracks newer than the caller's last-seen instant — it can
 * exceed {@code tracks.size()} when there are more new tracks than the requested {@code limit}, in which
 * case every entry in {@code tracks} is still guaranteed to be one of the newest tracks overall (and so
 * still correctly flagged {@code isNew}), just not all of them.
 */
public record RecentTracksResponse(List<RecentTrackResponse> tracks, long newCount) {
}
