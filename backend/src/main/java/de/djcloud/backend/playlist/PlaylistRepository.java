package de.djcloud.backend.playlist;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface PlaylistRepository extends JpaRepository<Playlist, Long> {

    /** Every playlist visible to a given user: public ones, plus their own private ones. */
    List<Playlist> findByIsPublicTrueOrOwnerId(Long ownerId);

    /** IDs of playlists containing the given track, restricted to those visible to the caller. */
    @Query("select p.id from Playlist p join p.tracks t where t.id = :trackId and (p.isPublic = true or p.owner.id = :ownerId)")
    List<Long> findPlaylistIdsContainingTrack(@Param("trackId") Long trackId, @Param("ownerId") Long ownerId);
}
