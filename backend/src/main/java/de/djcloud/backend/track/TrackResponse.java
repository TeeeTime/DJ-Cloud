package de.djcloud.backend.track;

import java.time.LocalDate;
import java.util.List;

public record TrackResponse(Long id, String title, int durationSeconds, String key, int bpm, String fileFormat,
                             LocalDate dateAdded, TrackStatus status, List<String> artists, List<String> genres) {

    public static TrackResponse fromEntity(Track track) {
        List<String> artistNames = track.getArtists().stream()
                .map(artist -> artist.getName())
                .toList();
        List<String> genreNames = track.getGenres().stream()
                .map(genre -> genre.getName())
                .toList();

        return new TrackResponse(track.getId(), track.getTitle(), track.getDurationSeconds(), track.getKey(),
                track.getBpm(), track.getFileFormat(), track.getDateAdded(), track.getStatus(), artistNames,
                genreNames);
    }
}
