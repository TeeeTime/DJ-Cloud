package de.djcloud.backend.track;

import java.time.Instant;
import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

@Repository
public interface TrackRepository extends JpaRepository<Track, Long>, JpaSpecificationExecutor<Track>,
        TrackRepositoryCustom {

    List<Track> findByStatus(TrackStatus status);

    List<Track> findByPreviewFileNameIsNullOrderById();

    List<Track> findByDateAddedIsNull();

    List<Track> findByAddedAtIsNullOrderById();

    List<Track> findAllByOrderByAddedAtDesc(Pageable pageable);

    long countByAddedAtAfter(Instant instant);
}
