package de.djcloud.backend.playlist;

import de.djcloud.backend.genre.Genre;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public record PlaylistResponse(Long id, String name, boolean isPublic, String ownerUsername, Instant createdAt,
                                int trackCount, boolean subscribed, List<String> topGenres) {

    private static final int TOP_GENRES_LIMIT = 3;

    public static PlaylistResponse fromEntity(Playlist playlist, boolean subscribed) {
        return new PlaylistResponse(playlist.getId(), playlist.getName(), playlist.isPublic(),
                playlist.getOwner().getUsername(), playlist.getCreatedAt(), playlist.getTracks().size(), subscribed,
                topGenres(playlist));
    }

    /** Up to {@link #TOP_GENRES_LIMIT} genre names, ranked by how many of the playlist's tracks carry them. */
    private static List<String> topGenres(Playlist playlist) {
        Map<String, Long> countsByGenre = playlist.getTracks().stream()
                .flatMap(track -> track.getGenres().stream())
                .map(Genre::getName)
                .collect(Collectors.groupingBy(name -> name, Collectors.counting()));

        return countsByGenre.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed()
                        .thenComparing(Map.Entry.comparingByKey()))
                .map(Map.Entry::getKey)
                .limit(TOP_GENRES_LIMIT)
                .collect(Collectors.toList());
    }
}
