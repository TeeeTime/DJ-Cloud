package de.djcloud.backend.track;

import java.util.List;

/** Query logic that can't be expressed as a plain Spring Data derived query or {@code Sort}. */
interface TrackRepositoryCustom {

    /**
     * Ids of tracks matching {@code criteria}, ordered by each track's alphabetically-first artist
     * name (tracks with no artists sort last regardless of direction), for the one page requested.
     * "Sort by artist" can't be expressed as a plain JPA {@code Sort} since {@code artists} is a
     * {@code @ManyToMany} collection — a track can have several — so this aggregates instead.
     */
    List<Long> findIdsSortedByArtist(TrackSearchCriteria criteria);

    /**
     * Ids of tracks in {@code criteria.scopeToPlaylistId()}'s manual playlist order — can't be a plain
     * JPA {@code Sort} since {@code position} lives on the {@code PlaylistTrack} join row, not on
     * {@code Track} itself. Throws {@code 400} if {@code scopeToPlaylistId()} is null; "position" only
     * means something within one specific playlist.
     */
    List<Long> findIdsSortedByPosition(TrackSearchCriteria criteria);
}
