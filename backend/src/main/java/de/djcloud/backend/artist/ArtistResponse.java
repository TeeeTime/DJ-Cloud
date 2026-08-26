package de.djcloud.backend.artist;

public record ArtistResponse(Long id, String name) {

    public static ArtistResponse fromEntity(Artist artist) {
        return new ArtistResponse(artist.getId(), artist.getName());
    }
}
