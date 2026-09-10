package de.djcloud.backend.playlist;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * One-time backfill for {@code PlaylistTrack.position}: any legacy join-table row that predates this
 * column has it {@code null}. Since the old plain {@code @ManyToMany Set} mapping this replaces
 * preserved no order at all, the best available stand-in for "the order tracks were added to a
 * playlist" is that join table's own physical row-insertion order (SQLite {@code rowid}) — see
 * {@link PlaylistTrackRepository#findRowsMissingPositionOrderedByInsertion()}. Mirrors {@code
 * AddedAtBackfillRunner}'s shape for the analogous {@code Track.addedAt} backfill.
 */
@Component
@Order(0)
@RequiredArgsConstructor
@Slf4j
public class PlaylistTrackPositionBackfillRunner implements ApplicationRunner {

    private static final double POSITION_GAP = 1000.0;

    private final PlaylistTrackRepository playlistTrackRepository;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        List<Object[]> rows = playlistTrackRepository.findRowsMissingPositionOrderedByInsertion();
        if (rows.isEmpty()) {
            return;
        }

        Map<Long, List<Long>> trackIdsByPlaylistId = new LinkedHashMap<>();
        for (Object[] row : rows) {
            Long playlistId = ((Number) row[0]).longValue();
            Long trackId = ((Number) row[1]).longValue();
            trackIdsByPlaylistId.computeIfAbsent(playlistId, id -> new ArrayList<>()).add(trackId);
        }

        int updated = 0;
        for (Map.Entry<Long, List<Long>> entry : trackIdsByPlaylistId.entrySet()) {
            List<Long> trackIds = entry.getValue();
            for (int i = 0; i < trackIds.size(); i++) {
                PlaylistTrack playlistTrack = playlistTrackRepository
                        .findByPlaylistIdAndTrackId(entry.getKey(), trackIds.get(i))
                        .orElseThrow();
                playlistTrack.setPosition((i + 1) * POSITION_GAP);
                playlistTrackRepository.save(playlistTrack);
                updated++;
            }
        }

        log.info("Backfilled position for {} pre-existing playlist_track row(s) across {} playlist(s)", updated,
                trackIdsByPlaylistId.size());
    }
}
