package de.djcloud.backend.track;

import de.djcloud.backend.artist.Artist;
import de.djcloud.backend.genre.Genre;
import de.djcloud.backend.playlist.Playlist;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(indexes = { @Index(name = "idx_track_title", columnList = "title") })
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

    /** Date the track was added to the library. Never set by the client — always the upload date. */
    private LocalDate dateAdded;

    /**
     * Exact moment the track was added — used for precise "recently added" ordering and "new" tagging;
     * {@code dateAdded}'s display in the track list is unaffected by this field.
     */
    private Instant addedAt;

    /** Name of the file as stored on disk (see app.storage.tracks-dir) — never exposed via the API directly. */
    private String fileName;

    /**
     * Name of the generated streaming preview as stored on disk (see app.storage.previews-dir) —
     * null until the analysis pipeline finishes; never exposed via the API directly.
     */
    private String previewFileName;

    @Enumerated(EnumType.STRING)
    private TrackStatus status;

    @ManyToMany
    @JoinTable(
            name = "track_artist",
            joinColumns = @JoinColumn(name = "track_id"),
            inverseJoinColumns = @JoinColumn(name = "artist_id"),
            indexes = { @Index(name = "idx_track_artist_track_id", columnList = "track_id"),
                    @Index(name = "idx_track_artist_artist_id", columnList = "artist_id") }
    )
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Set<Artist> artists = new HashSet<>();

    @ManyToMany
    @JoinTable(
            name = "track_genre",
            joinColumns = @JoinColumn(name = "track_id"),
            inverseJoinColumns = @JoinColumn(name = "genre_id"),
            indexes = { @Index(name = "idx_track_genre_track_id", columnList = "track_id"),
                    @Index(name = "idx_track_genre_genre_id", columnList = "genre_id") }
    )
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Set<Genre> genres = new HashSet<>();

    /** Inverse side of {@code Playlist.tracks} — lets a track's deletion clean up its memberships. */
    @ManyToMany(mappedBy = "tracks")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Set<Playlist> playlists = new HashSet<>();
}
