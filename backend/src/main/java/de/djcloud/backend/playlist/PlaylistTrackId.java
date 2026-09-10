package de.djcloud.backend.playlist;

import java.io.Serializable;
import java.util.Objects;

/** Composite key for {@link PlaylistTrack}, mirroring its {@code playlist}/{@code track} {@code @Id} fields. */
public class PlaylistTrackId implements Serializable {

    private Long playlist;
    private Long track;

    public PlaylistTrackId() {
    }

    public PlaylistTrackId(Long playlist, Long track) {
        this.playlist = playlist;
        this.track = track;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof PlaylistTrackId other)) {
            return false;
        }
        return Objects.equals(playlist, other.playlist) && Objects.equals(track, other.track);
    }

    @Override
    public int hashCode() {
        return Objects.hash(playlist, track);
    }
}
