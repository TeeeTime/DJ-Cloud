package de.djcloud.backend.genre;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GenreSyncRepository extends JpaRepository<GenreSync, Long> {

    Optional<GenreSync> findByGenreIdAndUserId(Long genreId, Long userId);

    List<GenreSync> findByUserId(Long userId);

    void deleteByGenreIdAndUserId(Long genreId, Long userId);

    void deleteByGenreId(Long genreId);
}
