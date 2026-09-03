package de.djcloud.backend.playlist;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

import de.djcloud.backend.track.Track;
import de.djcloud.backend.user.User;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@Setter
@NoArgsConstructor
public class Playlist {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    private boolean isPublic;

    @ManyToOne(optional = false)
    @JoinColumn(name = "owner_id")
    private User owner;

    private Instant createdAt;

    @ManyToMany
    @JoinTable(
            name = "playlist_track",
            joinColumns = @JoinColumn(name = "playlist_id"),
            inverseJoinColumns = @JoinColumn(name = "track_id"),
            indexes = { @Index(name = "idx_playlist_track_playlist_id", columnList = "playlist_id"),
                    @Index(name = "idx_playlist_track_track_id", columnList = "track_id") }
    )
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Set<Track> tracks = new HashSet<>();
}
