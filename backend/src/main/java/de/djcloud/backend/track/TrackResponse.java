package de.djcloud.backend.track;

import java.util.List;

public record TrackResponse(Long id, String title, int durationSeconds, String key, int bpm, String fileFormat,
                             TrackStatus status, List<String> artists) {

    public static TrackResponse fromEntity(Track track) {
        List<String> artistNames = track.getArtists().stream()
                .map(artist -> artist.getName())
                .toList();

        return new TrackResponse(track.getId(), track.getTitle(), track.getDurationSeconds(), track.getKey(),
                track.getBpm(), track.getFileFormat(), track.getStatus(), artistNames);
    }
}
