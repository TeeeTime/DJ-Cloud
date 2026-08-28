package de.djcloud.backend.track;

import java.time.Instant;
import java.util.List;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * One-time backfill for {@code addedAt}: any legacy row that predates that column has it {@code null}
 * rather than its real upload instant, which is no longer recoverable. Unlike {@link
 * DateAddedBackfillRunner} — where the exact same value for every legacy row is harmless since only the
 * date is ever displayed — {@code addedAt} directly drives "recently added" ordering, so stamping every
 * row with the identical {@code Instant.now()} would leave their relative order among each other
 * undefined. Instead each row gets a slightly earlier instant than the next, in ascending-id order, so
 * existing insertion order (id) is preserved as a reasonable stand-in for real chronological order.
 */
@Component
@Order(0)
@RequiredArgsConstructor
@Slf4j
public class AddedAtBackfillRunner implements ApplicationRunner {

    private final TrackRepository trackRepository;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        List<Track> missingAddedAt = trackRepository.findByAddedAtIsNullOrderById();
        if (missingAddedAt.isEmpty()) {
            return;
        }

        Instant now = Instant.now();
        for (int i = 0; i < missingAddedAt.size(); i++) {
            missingAddedAt.get(i).setAddedAt(now.minusSeconds(missingAddedAt.size() - i));
        }
        trackRepository.saveAll(missingAddedAt);

        log.info("Backfilled addedAt for {} pre-existing track(s)", missingAddedAt.size());
    }
}
