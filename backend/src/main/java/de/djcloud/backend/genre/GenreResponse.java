package de.djcloud.backend.genre;

public record GenreResponse(Long id, String name) {

    public static GenreResponse fromEntity(Genre genre) {
        return new GenreResponse(genre.getId(), genre.getName());
    }
}
