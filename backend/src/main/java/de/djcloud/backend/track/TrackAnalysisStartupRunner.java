package de.djcloud.backend.track;

import java.util.List;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Runs once on startup and puts every track back through the full analysis pipeline — including
 * ones already {@code READY}, so the whole library is re-validated and re-cleaned each restart, and
 * nothing can stay stuck {@code PROCESSING} from before a restart. User-editable data survives: the
 * pipeline re-embeds title/artists/genres from the DB and the cover from the current file, and keeps
 * any BPM/key already set (see {@link TrackAnalysisPipeline}).
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
        List<Track> tracks = trackRepository.findAllByOrderById();
        tracks.forEach(track -> track.setStatus(TrackStatus.QUEUED));
        trackRepository.saveAll(tracks);

        tracks.forEach(track -> trackAnalysisQueue.enqueue(track.getId(), track.getTitle()));

        log.info("Requeued all {} track(s) for analysis on startup", tracks.size());
    }
}
