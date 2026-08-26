package de.djcloud.backend.artist;

import jakarta.validation.constraints.NotBlank;

public record ArtistRequest(@NotBlank String name) {
}
