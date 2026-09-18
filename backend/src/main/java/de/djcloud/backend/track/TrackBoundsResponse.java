package de.djcloud.backend.track;

public record TrackBoundsResponse(
    Integer minBpm,
    Integer maxBpm,
    Integer minDurationSeconds,
    Integer maxDurationSeconds
) {}
