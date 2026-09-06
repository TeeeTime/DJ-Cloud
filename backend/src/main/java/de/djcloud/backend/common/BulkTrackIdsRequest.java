package de.djcloud.backend.common;

import java.util.List;

import jakarta.validation.constraints.NotEmpty;

/** Shared request body for every bulk track operation (delete, add/remove on a playlist). */
public record BulkTrackIdsRequest(@NotEmpty List<Long> trackIds) {
}
