package de.djcloud.backend.playlist;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PlaylistLastViewedRepository extends JpaRepository<PlaylistLastViewed, Long> {

    Optional<PlaylistLastViewed> findByPlaylistIdAndUserId(Long playlistId, Long userId);

    List<PlaylistLastViewed> findByUserId(Long userId);

    void deleteByPlaylistId(Long playlistId);
}
