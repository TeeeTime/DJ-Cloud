package de.djcloud.backend.track;

import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record TrackUpdateRequest(
        @NotBlank String title,
        @Positive int durationSeconds,
        String key,
        @Positive int bpm,
        String fileFormat,
        @NotNull TrackStatus status,
        @NotNull List<Long> artistIds) {
}
