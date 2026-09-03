package de.djcloud.backend.playlist;

import java.time.Instant;

import de.djcloud.backend.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "playlist_subscription", uniqueConstraints = @UniqueConstraint(columnNames = { "playlist_id", "user_id" }))
@Getter
@Setter
@NoArgsConstructor
public class PlaylistSubscription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "playlist_id")
    private Playlist playlist;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    private Instant subscribedAt;
}
