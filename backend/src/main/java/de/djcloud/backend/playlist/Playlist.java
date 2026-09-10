package de.djcloud.backend.playlist;

import java.time.Instant;

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
}
