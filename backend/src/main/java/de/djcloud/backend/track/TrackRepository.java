package de.djcloud.backend.track;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TrackRepository extends JpaRepository<Track, Long> {

    List<Track> findByStatus(TrackStatus status);

    List<Track> findByPreviewFileNameIsNullOrderById();
}
