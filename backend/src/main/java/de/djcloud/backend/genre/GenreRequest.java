package de.djcloud.backend.genre;

import jakarta.validation.constraints.NotBlank;

public record GenreRequest(@NotBlank String name) {
}
