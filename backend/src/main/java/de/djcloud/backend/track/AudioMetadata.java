package de.djcloud.backend.track;

/** title/artist are null when no tag was present; durationSeconds is always read from the audio header. */
record AudioMetadata(String title, String artist, int durationSeconds) {
}
