package de.djcloud.backend.track;

import java.util.List;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Runs once on startup and puts every {@code FAILED} track back through the full analysis
 * pipeline, so a track that failed before a crash/restart gets another chance without anyone
 * having to notice and retry it manually. {@code READY}/{@code QUEUED}/{@code PROCESSING} tracks
 * are left alone — re-validating the whole library on every restart was wasteful once a manual
 * per-track retry existed (see {@code POST /api/tracks/{id}/reanalyze}). User-editable data
 * survives a re-analysis either way: the pipeline re-embeds title/artists/genres from the DB and
 * the cover from the current file, and keeps any BPM/key already set (see
 * {@link TrackAnalysisPipeline}).
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
        List<Track> tracks = trackRepository.findByStatus(TrackStatus.FAILED);
        tracks.forEach(track -> track.setStatus(TrackStatus.QUEUED));
        trackRepository.saveAll(tracks);

        tracks.forEach(track -> trackAnalysisQueue.enqueue(track.getId(), track.getTitle()));

        log.info("Requeued {} failed track(s) for analysis on startup", tracks.size());
    }
}
