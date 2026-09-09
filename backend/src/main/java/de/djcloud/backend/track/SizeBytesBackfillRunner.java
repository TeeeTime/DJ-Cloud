package de.djcloud.backend.track;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * One-time (and self-healing, since it re-checks every startup) backfill for {@code sizeBytes}:
 * any legacy row that predates that column has it default to {@code 0} rather than its real file
 * size. Each such row's stored file is resolved on disk and re-measured here.
 */
@Component
@Order(0)
@RequiredArgsConstructor
@Slf4j
public class SizeBytesBackfillRunner implements ApplicationRunner {

    private final TrackRepository trackRepository;
    private final TrackStorageService trackStorageService;

    @Override
    public void run(ApplicationArguments args) {
        List<Track> missingSizeBytes = trackRepository.findBySizeBytes(0);
        if (missingSizeBytes.isEmpty()) {
            return;
        }

        List<Track> updated = new ArrayList<>();
        for (Track track : missingSizeBytes) {
            if (track.getFileName() == null) {
                continue;
            }

            File file = trackStorageService.resolve(track.getFileName());
            if (!file.exists()) {
                continue;
            }

            track.setSizeBytes(file.length());
            updated.add(track);
        }

        trackRepository.saveAll(updated);

        log.info("Backfilled sizeBytes for {} pre-existing track(s)", updated.size());
    }
}
