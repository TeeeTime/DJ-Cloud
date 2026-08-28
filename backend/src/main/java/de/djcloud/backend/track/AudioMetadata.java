package de.djcloud.backend.track;

import java.util.List;

/**
 * title/artist are null when no tag was present; durationSeconds is always read from the audio
 * header; genres is never null — empty if the file has none, capped at 3.
 */
record AudioMetadata(String title, String artist, int durationSeconds, List<String> genres) {
}
