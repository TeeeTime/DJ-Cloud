package de.djcloud.backend.genre;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

@Repository
public interface GenreRepository extends JpaRepository<Genre, Long> {

    List<Genre> findByNameContainingIgnoreCaseOrderByNameAsc(String name, Pageable pageable);

    boolean existsByNameIgnoreCase(String name);

    Optional<Genre> findByNameIgnoreCase(String name);

    /** Genres with zero tagged tracks are naturally excluded by the inner join. */
    @Query("SELECT new de.djcloud.backend.genre.GenreDistributionResponse(g.name, COUNT(t)) " +
            "FROM Genre g JOIN g.songs t GROUP BY g.name ORDER BY COUNT(t) DESC")
    List<GenreDistributionResponse> distribution();
}
