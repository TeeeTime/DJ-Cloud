package de.djcloud.backend.artist;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ArtistRepository extends JpaRepository<Artist, Long> {

    List<Artist> findByNameContainingIgnoreCaseOrderByNameAsc(String name, Pageable pageable);

    boolean existsByNameIgnoreCase(String name);

    Optional<Artist> findByNameIgnoreCase(String name);
}
