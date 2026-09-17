package de.djcloud.backend.genre;

import java.time.Instant;

import de.djcloud.backend.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "genre_sync", uniqueConstraints = @UniqueConstraint(columnNames = { "genre_id", "user_id" }))
@Getter
@Setter
@NoArgsConstructor
public class GenreSync {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "genre_id")
    private Genre genre;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    private Instant syncEnabledAt;
}
