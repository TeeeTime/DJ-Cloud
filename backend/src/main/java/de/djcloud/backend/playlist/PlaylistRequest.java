package de.djcloud.backend.playlist;

import jakarta.validation.constraints.NotBlank;

public record PlaylistRequest(@NotBlank String name, boolean isPublic) {
}
