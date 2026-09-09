package de.djcloud.backend.track;

import java.util.List;

/** Live snapshot of the analysis queue: tracks waiting their turn, and what's running right now. */
public record TrackAnalysisQueueResponse(List<QueuedTrackInfo> queued, ProcessingInfo processing) {

    public record QueuedTrackInfo(Long trackId, String title) {
    }

    public record ProcessingInfo(Long trackId, String title, AnalysisStep step) {
    }
}
