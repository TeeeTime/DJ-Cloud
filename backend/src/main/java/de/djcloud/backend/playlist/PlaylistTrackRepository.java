package de.djcloud.backend.playlist;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface PlaylistTrackRepository extends JpaRepository<PlaylistTrack, PlaylistTrackId> {

    List<PlaylistTrack> findByPlaylistIdOrderByPosition(Long playlistId);

    Optional<PlaylistTrack> findByPlaylistIdAndTrackId(Long playlistId, Long trackId);

    long countByPlaylistId(Long playlistId);

    void deleteByPlaylistIdAndTrackId(Long playlistId, Long trackId);

    void deleteByPlaylistId(Long playlistId);

    void deleteByTrackId(Long trackId);

    @Query("select coalesce(max(pt.position), 0.0) from PlaylistTrack pt where pt.playlist.id = :playlistId")
    double findMaxPosition(@Param("playlistId") Long playlistId);

    /** Batched per-playlist track counts, for a listing of many playlists at once (avoids N+1). */
    @Query("select pt.playlist.id as playlistId, count(pt) as trackCount from PlaylistTrack pt "
            + "where pt.playlist.id in :playlistIds group by pt.playlist.id")
    List<PlaylistTrackCountRow> countGroupedByPlaylistIds(@Param("playlistIds") List<Long> playlistIds);

    /** Batched per-playlist, per-genre tag counts, for ranking each playlist's {@code topGenres} at once. */
    @Query("select pt.playlist.id as playlistId, g.name as genreName, count(g) as genreCount from PlaylistTrack pt "
            + "join pt.track.genres g where pt.playlist.id in :playlistIds group by pt.playlist.id, g.name")
    List<PlaylistGenreCountRow> genreCountsGroupedByPlaylistIds(@Param("playlistIds") List<Long> playlistIds);

    /**
     * Every pre-existing {@code (playlist_id, track_id)} pair still missing a {@code position}, in
     * SQLite's own physical row-insertion order ({@code rowid}) per playlist — the best available
     * stand-in for "the order tracks were added to this playlist", since the old plain
     * {@code @ManyToMany Set} mapping this replaces preserved no order at all. Feeds
     * {@link PlaylistTrackPositionBackfillRunner}.
     */
    @Query(value = "select playlist_id, track_id from playlist_track where position is null order by playlist_id, rowid",
            nativeQuery = true)
    List<Object[]> findRowsMissingPositionOrderedByInsertion();

    interface PlaylistTrackCountRow {
        Long getPlaylistId();

        long getTrackCount();
    }

    interface PlaylistGenreCountRow {
        Long getPlaylistId();

        String getGenreName();

        long getGenreCount();
    }
}
