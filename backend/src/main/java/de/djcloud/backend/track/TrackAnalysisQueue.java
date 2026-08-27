package de.djcloud.backend.track;

import java.util.List;
import java.util.concurrent.ConcurrentLinkedDeque;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Component;

import de.djcloud.backend.track.TrackAnalysisQueueResponse.ProcessingInfo;

/**
 * Public entry point for both submitting a track for analysis and reading live queue/progress
 * state. Backed by a single-threaded {@code ThreadPoolTaskExecutor} (see {@code AsyncConfig}), so
 * tracks are always processed one at a time, strictly in the order they were enqueued.
 */
@Component
public class TrackAnalysisQueue {

    private final ThreadPoolTaskExecutor executor;
    private final TrackAnalysisPipeline pipeline;
    private final ConcurrentLinkedDeque<Long> waiting = new ConcurrentLinkedDeque<>();
    private volatile CurrentTask current;

    public TrackAnalysisQueue(@Qualifier("trackAnalysisExecutor") ThreadPoolTaskExecutor executor,
            TrackAnalysisPipeline pipeline) {
        this.executor = executor;
        this.pipeline = pipeline;
    }

    public void enqueue(Long trackId) {
        waiting.addLast(trackId);
        executor.execute(() -> processOne(trackId));
    }

    private void processOne(Long trackId) {
        waiting.remove(trackId);
        try {
            pipeline.run(trackId, step -> current = new CurrentTask(trackId, step));
        } finally {
            current = null;
        }
    }

    public TrackAnalysisQueueResponse snapshot() {
        CurrentTask snapshot = current;
        ProcessingInfo processing = snapshot == null ? null
                : new ProcessingInfo(snapshot.trackId(), snapshot.step());
        return new TrackAnalysisQueueResponse(List.copyOf(waiting), processing);
    }

    private record CurrentTask(Long trackId, AnalysisStep step) {
    }
}
