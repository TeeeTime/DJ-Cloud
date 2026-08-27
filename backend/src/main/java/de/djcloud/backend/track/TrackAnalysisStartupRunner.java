package de.djcloud.backend.track;

import java.util.List;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Runs once on startup so tracks never get stuck: any row still {@code PROCESSING} from before a
 * restart is reset to {@code QUEUED} (nothing is actually running for it anymore), and every track
 * without a preview file yet — freshly queued, reset above, previously {@code FAILED}, or a legacy
 * row that predates this pipeline entirely — is (re)queued for analysis.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TrackAnalysisStartupRunner implements ApplicationRunner {

    private final TrackRepository trackRepository;
    private final TrackAnalysisQueue trackAnalysisQueue;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        List<Track> stuck = trackRepository.findByStatus(TrackStatus.PROCESSING);
        stuck.forEach(track -> track.setStatus(TrackStatus.QUEUED));
        trackRepository.saveAll(stuck);

        List<Track> needsAnalysis = trackRepository.findByPreviewFileNameIsNullOrderById();
        needsAnalysis.forEach(track -> track.setStatus(TrackStatus.QUEUED));
        trackRepository.saveAll(needsAnalysis);

        needsAnalysis.forEach(track -> trackAnalysisQueue.enqueue(track.getId()));

        log.info("Requeued {} track(s) for analysis on startup", needsAnalysis.size());
    }
}
