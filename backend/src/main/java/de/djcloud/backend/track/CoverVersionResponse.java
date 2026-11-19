package de.djcloud.backend.track;

/** Returned by {@code PUT/DELETE /api/tracks/{id}/cover} — the track's new {@link Track#getCoverVersion}. */
public record CoverVersionResponse(long coverVersion) {
}
