package de.djcloud.backend.track;

import de.djcloud.backend.artist.Artist;
import jakarta.persistence.*;
import lombok.*;

import java.util.HashSet;
import java.util.Set;

@Entity
@Getter
@Setter
@NoArgsConstructor
public class Track {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String title;
    private int durationSeconds;
    private String key;
    private int bpm;
    private String fileFormat;

    @Enumerated(EnumType.STRING)
    private TrackStatus status;

    @ManyToMany
    @JoinTable(
            name = "track_artist",
            joinColumns = @JoinColumn(name = "track_id"),
            inverseJoinColumns = @JoinColumn(name = "artist_id")
    )
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Set<Artist> artists = new HashSet<>();
}
