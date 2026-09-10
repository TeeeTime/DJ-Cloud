package de.djcloud.backend.playlist;

/** {@code afterTrackId == null} means "move to the very first position". */
public record ReorderTrackRequest(Long afterTrackId) {
}
