package de.djcloud.backend.track;

/** Response body for a {@code 409} upload rejection — what the upload looked like a duplicate of. */
public record DuplicateTrackResponse(String reason, TrackResponse existingTrack) {

    static DuplicateTrackResponse fromException(DuplicateTrackException ex) {
        return new DuplicateTrackResponse(ex.getReason().name(), TrackResponse.fromEntity(ex.getExistingTrack()));
    }
}
