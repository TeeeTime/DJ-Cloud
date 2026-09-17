package de.djcloud.backend.playlist;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PlaylistSyncRepository extends JpaRepository<PlaylistSync, Long> {

    Optional<PlaylistSync> findByPlaylistIdAndUserId(Long playlistId, Long userId);

    List<PlaylistSync> findByUserId(Long userId);

    void deleteByPlaylistIdAndUserId(Long playlistId, Long userId);

    void deleteByPlaylistId(Long playlistId);
}
