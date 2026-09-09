package de.djcloud.backend.track;

import java.util.List;
import java.util.concurrent.ConcurrentLinkedDeque;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Component;

import de.djcloud.backend.track.TrackAnalysisQueueResponse.ProcessingInfo;
import de.djcloud.backend.track.TrackAnalysisQueueResponse.QueuedTrackInfo;

/**
 * Public entry point for both submitting a track for analysis and reading live queue/progress
 * state. Backed by a single-threaded {@code ThreadPoolTaskExecutor} (see {@code AsyncConfig}), so
 * tracks are always processed one at a time, strictly in the order they were enqueued.
 */
@Component
public class TrackAnalysisQueue {

    private final ThreadPoolTaskExecutor executor;
    private final TrackAnalysisPipeline pipeline;
    private final ConcurrentLinkedDeque<QueuedTrack> waiting = new ConcurrentLinkedDeque<>();
    private volatile CurrentTask current;

    public TrackAnalysisQueue(@Qualifier("trackAnalysisExecutor") ThreadPoolTaskExecutor executor,
            TrackAnalysisPipeline pipeline) {
        this.executor = executor;
        this.pipeline = pipeline;
    }

    /**
     * The title is captured here rather than looked up from the DB in {@link #snapshot()} so
     * every polling client (uploader and viewers alike) sees the same denormalized value without
     * a repository round-trip on every poll.
     */
    public void enqueue(Long trackId, String title) {
        waiting.addLast(new QueuedTrack(trackId, title));
        executor.execute(() -> processOne(trackId, title));
    }

    private void processOne(Long trackId, String title) {
        waiting.removeIf(t -> t.trackId().equals(trackId));
        try {
            pipeline.run(trackId, step -> current = new CurrentTask(trackId, title, step));
        } finally {
            current = null;
        }
    }

    public TrackAnalysisQueueResponse snapshot() {
        CurrentTask snapshot = current;
        ProcessingInfo processing = snapshot == null ? null
                : new ProcessingInfo(snapshot.trackId(), snapshot.title(), snapshot.step());
        List<QueuedTrackInfo> queued = waiting.stream()
                .map(t -> new QueuedTrackInfo(t.trackId(), t.title()))
                .toList();
        return new TrackAnalysisQueueResponse(queued, processing);
    }

    private record QueuedTrack(Long trackId, String title) {
    }

    private record CurrentTask(Long trackId, String title, AnalysisStep step) {
    }
}
