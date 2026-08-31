package de.djcloud.backend.track;

import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record TrackUpdateRequest(
        @NotBlank String title,
        @Positive int durationSeconds,
        String key,
        @Positive int bpm,
        String fileFormat,
        @NotNull TrackStatus status,
        @NotNull List<Long> artistIds,
        @NotNull @Size(max = 3) List<Long> genreIds) {
}
