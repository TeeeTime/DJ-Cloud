package de.djcloud.backend.track;

import lombok.Getter;

/** Thrown by {@link TrackUploadService} when an upload looks like a duplicate and wasn't confirmed. */
@Getter
class DuplicateTrackException extends RuntimeException {

    enum Reason {
        EXACT_FILE,
        TITLE_AND_ARTIST
    }

    private final Reason reason;
    private final Track existingTrack;

    DuplicateTrackException(Reason reason, Track existingTrack) {
        super("Possible duplicate of track " + existingTrack.getId());
        this.reason = reason;
        this.existingTrack = existingTrack;
    }
}
