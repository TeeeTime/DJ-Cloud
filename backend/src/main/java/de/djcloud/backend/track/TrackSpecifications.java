package de.djcloud.backend.track;

import java.util.ArrayList;
import java.util.List;

import org.springframework.data.jpa.domain.Specification;

import de.djcloud.backend.artist.Artist;
import de.djcloud.backend.genre.Genre;
import de.djcloud.backend.playlist.Playlist;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;

/**
 * Builds the dynamic filter (not sort — see {@link TrackRepositoryImpl} for the one sort case that
 * can't be expressed as a plain {@code Sort}) shared by every track listing: the library, a single
 * playlist's tracks, and the add-track search.
 */
final class TrackSpecifications {

    private TrackSpecifications() {
    }

    static Specification<Track> fromCriteria(TrackSearchCriteria criteria) {
        return (root, query, cb) -> {
            // Joining both artists and genres for the text search can multiply rows per track — every
            // caller of this method needs the result deduplicated, so it's set once here rather than
            // relying on each caller to remember.
            query.distinct(true);

            List<Predicate> predicates = new ArrayList<>();

            if (criteria.query() != null && !criteria.query().isBlank()) {
                predicates.add(textSearch(root, cb, criteria.query().trim()));
            }
            if (criteria.scopeToPlaylistId() != null) {
                predicates.add(inPlaylist(root, cb, criteria.scopeToPlaylistId()));
            }
            if (criteria.excludePlaylistId() != null) {
                predicates.add(notInPlaylist(root, query, cb, criteria.excludePlaylistId()));
            }

            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private static Predicate textSearch(Root<Track> root, CriteriaBuilder cb, String rawQuery) {
        String pattern = "%" + rawQuery.toLowerCase() + "%";

        Join<Track, Artist> artistJoin = root.join("artists", JoinType.LEFT);
        Join<Track, Genre> genreJoin = root.join("genres", JoinType.LEFT);

        return cb.or(
                cb.like(cb.lower(root.get("title")), pattern),
                cb.like(cb.lower(artistJoin.get("name")), pattern),
                cb.like(cb.lower(genreJoin.get("name")), pattern));
    }

    private static Predicate inPlaylist(Root<Track> root, CriteriaBuilder cb, Long playlistId) {
        Join<Track, Playlist> playlistJoin = root.join("playlists", JoinType.INNER);
        return cb.equal(playlistJoin.get("id"), playlistId);
    }

    private static Predicate notInPlaylist(Root<Track> root, CriteriaQuery<?> query, CriteriaBuilder cb,
            Long playlistId) {
        Subquery<Long> subquery = query.subquery(Long.class);
        var playlistRoot = subquery.from(Playlist.class);
        var trackInPlaylist = playlistRoot.join("tracks", JoinType.INNER);
        subquery.select(trackInPlaylist.get("id")).where(cb.equal(playlistRoot.get("id"), playlistId));

        return cb.not(root.get("id").in(subquery));
    }
}
