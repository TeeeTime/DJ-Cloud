package de.djcloud.backend.playlist;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PlaylistRepository extends JpaRepository<Playlist, Long> {

    /** Every playlist visible to a given user: public ones, plus their own private ones. */
    List<Playlist> findByIsPublicTrueOrOwnerId(Long ownerId);
}
