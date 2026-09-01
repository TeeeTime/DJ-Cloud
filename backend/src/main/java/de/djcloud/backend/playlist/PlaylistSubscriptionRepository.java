package de.djcloud.backend.playlist;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PlaylistSubscriptionRepository extends JpaRepository<PlaylistSubscription, Long> {

    Optional<PlaylistSubscription> findByPlaylistIdAndUserId(Long playlistId, Long userId);

    List<PlaylistSubscription> findByUserId(Long userId);

    void deleteByPlaylistIdAndUserId(Long playlistId, Long userId);

    void deleteByPlaylistId(Long playlistId);
}
