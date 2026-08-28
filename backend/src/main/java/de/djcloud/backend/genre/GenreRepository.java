package de.djcloud.backend.genre;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GenreRepository extends JpaRepository<Genre, Long> {

    List<Genre> findByNameContainingIgnoreCaseOrderByNameAsc(String name, Pageable pageable);

    boolean existsByNameIgnoreCase(String name);

    Optional<Genre> findByNameIgnoreCase(String name);
}
