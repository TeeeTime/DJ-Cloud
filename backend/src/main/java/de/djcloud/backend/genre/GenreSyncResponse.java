package de.djcloud.backend.genre;

public record GenreSyncResponse(Long id, String name, boolean syncEnabled) {

    public static GenreSyncResponse fromEntity(Genre genre, boolean syncEnabled) {
        return new GenreSyncResponse(genre.getId(), genre.getName(), syncEnabled);
    }
}
