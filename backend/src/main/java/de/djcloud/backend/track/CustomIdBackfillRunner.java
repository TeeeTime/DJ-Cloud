package de.djcloud.backend.track;

import java.io.File;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * One-time (and self-healing, since it re-checks every startup) backfill for the internal-id tag
 * introduced after tracks already existed: any track uploaded before {@link TrackUploadService}
 * started writing it — or whose write failed at upload time — gets it written here instead.
 * Idempotent: already-correctly-tagged files are skipped without any write.
 */
@Component
@Order(1)
@RequiredArgsConstructor
@Slf4j
public class CustomIdBackfillRunner implements ApplicationRunner {

    private final TrackRepository trackRepository;
    private final TrackStorageService trackStorageService;
    private final AudioMetadataReader audioMetadataReader;
    private final AudioMetadataWriter audioMetadataWriter;

    @Override
    public void run(ApplicationArguments args) {
        int written = 0;
        int failed = 0;

        for (Track track : trackRepository.findAll()) {
            if (track.getFileName() == null) {
                continue;
            }

            File file = trackStorageService.resolve(track.getFileName());
            if (!file.exists()) {
                continue;
            }

            Long existing = audioMetadataReader.readInternalId(file);
            if (existing != null && existing.equals(track.getId())) {
                continue;
            }

            try {
                audioMetadataWriter.writeInternalId(file, track.getId());
                written++;
            } catch (AudioMetadataException ex) {
                failed++;
                log.warn("Could not backfill internal id tag for track {}: {}", track.getId(), ex.getMessage());
            }
        }

        if (written > 0 || failed > 0) {
            log.info("Backfilled internal id tag for {} track(s) ({} failed)", written, failed);
        }
    }
}
