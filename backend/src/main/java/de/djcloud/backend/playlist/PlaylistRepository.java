package de.djcloud.backend.playlist;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface PlaylistRepository extends JpaRepository<Playlist, Long> {

    /** IDs of playlists containing the given track. */
    @Query("select pt.playlist.id from PlaylistTrack pt where pt.track.id = :trackId")
    List<Long> findPlaylistIdsContainingTrack(@Param("trackId") Long trackId);
}
