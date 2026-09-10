package de.djcloud.backend.playlist;

import de.djcloud.backend.track.Track;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A track's membership in a playlist, plus its manual sort {@link #position} within that playlist —
 * replaces the old {@code Playlist.tracks}/{@code Track.playlists} plain {@code @ManyToMany} mapping,
 * which had no room for per-membership data. Reuses the same physical table and the same two FK
 * columns that mapping already created ({@code playlist_track(playlist_id, track_id)}, which already
 * carries a composite primary key on those two columns) — the only schema change this introduces is
 * one new nullable {@code position} column.
 */
@Entity
@Table(name = "playlist_track", indexes = { @Index(name = "idx_playlist_track_playlist_id", columnList = "playlist_id"),
        @Index(name = "idx_playlist_track_track_id", columnList = "track_id") })
@IdClass(PlaylistTrackId.class)
@Getter
@Setter
@NoArgsConstructor
public class PlaylistTrack {

    @Id
    @ManyToOne(optional = false)
    @JoinColumn(name = "playlist_id")
    private Playlist playlist;

    @Id
    @ManyToOne(optional = false)
    @JoinColumn(name = "track_id")
    private Track track;

    /**
     * Manual sort position within the playlist, ascending. Nullable — deliberately not backed by a
     * {@code NOT NULL}/{@code @ColumnDefault} column, since a nullable {@code ADD COLUMN} is the only
     * kind SQLite accepts on an already-populated table (see {@code Track.sizeBytes}'s javadoc for the
     * NOT-NULL case this avoids). Pre-existing rows are backfilled once by
     * {@link PlaylistTrackPositionBackfillRunner}. New rows always get a real value at creation time
     * (see {@code PlaylistService.addTrack}), so {@code null} should only ever be transiently true,
     * right after this column was introduced.
     */
    private Double position;
}
