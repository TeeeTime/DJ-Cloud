package de.djcloud.backend.playlist;

import jakarta.validation.constraints.NotNull;

public record AddTrackRequest(@NotNull Long trackId) {
}
