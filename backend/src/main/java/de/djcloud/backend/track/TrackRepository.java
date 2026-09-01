package de.djcloud.backend.track;

import java.time.Instant;
import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface TrackRepository extends JpaRepository<Track, Long> {

    List<Track> findByStatus(TrackStatus status);

    List<Track> findByPreviewFileNameIsNullOrderById();

    List<Track> findByDateAddedIsNull();

    List<Track> findByAddedAtIsNullOrderById();

    List<Track> findAllByOrderByAddedAtDesc(Pageable pageable);

    long countByAddedAtAfter(Instant instant);

    List<Track> findByTitleContainingIgnoreCase(String title, Pageable pageable);

    /** Same substring search, but excludes tracks already in the given playlist. */
    @Query("SELECT t FROM Track t WHERE LOWER(t.title) LIKE LOWER(CONCAT('%', :query, '%')) "
            + "AND t.id NOT IN (SELECT tk.id FROM Playlist p JOIN p.tracks tk WHERE p.id = :playlistId)")
    List<Track> searchExcludingPlaylist(@Param("query") String query, @Param("playlistId") Long playlistId,
            Pageable pageable);
}
