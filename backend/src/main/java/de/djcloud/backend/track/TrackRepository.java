package de.djcloud.backend.track;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import de.djcloud.backend.artist.Artist;

@Repository
public interface TrackRepository extends JpaRepository<Track, Long>, JpaSpecificationExecutor<Track>,
        TrackRepositoryCustom {

    List<Track> findByStatus(TrackStatus status);

    /**
     * {@code @EntityGraph} eagerly loads {@code artists}/{@code genres} in this query so
     * {@link TrackResponse#fromEntity} can read them later — the session these lazy
     * {@code @ManyToMany} collections belong to is long closed by the time
     * {@code TrackController#handleDuplicateTrack} serializes the match.
     */
    @EntityGraph(attributePaths = { "artists", "genres" })
    Optional<Track> findFirstByContentHash(String contentHash);

    @EntityGraph(attributePaths = { "artists", "genres" })
    Optional<Track> findFirstByTitleIgnoreCaseAndArtistsContaining(String title, Artist artist);

    List<Track> findByPreviewFileNameIsNullOrderById();

    List<Track> findByDateAddedIsNull();

    List<Track> findByAddedAtIsNullOrderById();

    List<Track> findBySizeBytes(long sizeBytes);

    List<Track> findAllByOrderByAddedAtDesc(Pageable pageable);

    long countByAddedAtAfter(Instant instant);
}
