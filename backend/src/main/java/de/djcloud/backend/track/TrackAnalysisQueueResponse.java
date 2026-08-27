package de.djcloud.backend.track;

import java.util.List;

/** Live snapshot of the analysis queue: track ids waiting their turn, and what's running right now. */
public record TrackAnalysisQueueResponse(List<Long> queued, ProcessingInfo processing) {

    public record ProcessingInfo(Long trackId, AnalysisStep step) {
    }
}
