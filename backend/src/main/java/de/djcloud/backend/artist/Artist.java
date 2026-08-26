package de.djcloud.backend.artist;

import de.djcloud.backend.track.Track;
import jakarta.persistence.*;
import lombok.*;

import java.util.HashSet;
import java.util.Set;

@Entity
@Getter
@Setter
@NoArgsConstructor
public class Artist {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    @ManyToMany(mappedBy = "artists")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Set<Track> songs = new HashSet<>();
}
