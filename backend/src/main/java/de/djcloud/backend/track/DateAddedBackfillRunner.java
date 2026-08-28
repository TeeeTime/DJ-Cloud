package de.djcloud.backend.track;

import java.time.LocalDate;
import java.util.List;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * One-time backfill for {@code dateAdded}: any legacy row that predates that column (added after
 * this pipeline already had tracks in it) has it {@code null} rather than its real upload date,
 * which is no longer recoverable — so it's stamped with today's date instead, once, on first
 * startup after the column was introduced. Runs before {@link TrackAnalysisStartupRunner} only by
 * convention (no ordering dependency between the two).
 */
@Component
@Order(0)
@RequiredArgsConstructor
@Slf4j
public class DateAddedBackfillRunner implements ApplicationRunner {

    private final TrackRepository trackRepository;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        List<Track> missingDateAdded = trackRepository.findByDateAddedIsNull();
        if (missingDateAdded.isEmpty()) {
            return;
        }

        LocalDate today = LocalDate.now();
        missingDateAdded.forEach(track -> track.setDateAdded(today));
        trackRepository.saveAll(missingDateAdded);

        log.info("Backfilled dateAdded ({}) for {} pre-existing track(s)", today, missingDateAdded.size());
    }
}
