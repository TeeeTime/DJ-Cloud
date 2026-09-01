package de.djcloud.backend.track;

import java.util.List;

import org.springframework.data.domain.Sort;

import de.djcloud.backend.artist.Artist;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Root;

class TrackRepositoryCustomImpl implements TrackRepositoryCustom {

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public List<Long> findIdsSortedByArtist(TrackSearchCriteria criteria) {
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<Long> query = cb.createQuery(Long.class);
        Root<Track> root = query.from(Track.class);

        query.where(TrackSpecifications.fromCriteria(criteria).toPredicate(root, query, cb));

        Join<Track, Artist> artistJoin = root.join("artists", JoinType.LEFT);
        Path<String> artistName = artistJoin.get("name");
        boolean ascending = criteria.direction() == Sort.Direction.ASC;
        Expression<String> aggregatedArtistName = ascending ? cb.least(artistName) : cb.greatest(artistName);

        // Tracks with no artists must sort last regardless of direction, so a "has no artist" flag
        // is always the primary (ascending) sort key, ahead of the actual name comparison.
        Expression<Integer> hasNoArtist = cb.<Integer>selectCase().when(aggregatedArtistName.isNull(), 1)
                .otherwise(0);

        query.select(root.get("id"))
                .groupBy(root.get("id"))
                .orderBy(cb.asc(hasNoArtist), ascending ? cb.asc(aggregatedArtistName) : cb.desc(aggregatedArtistName));

        return entityManager.createQuery(query)
                .setFirstResult(criteria.page() * criteria.size())
                .setMaxResults(criteria.size())
                .getResultList();
    }
}
