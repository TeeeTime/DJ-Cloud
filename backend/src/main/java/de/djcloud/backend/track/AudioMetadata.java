package de.djcloud.backend.track;

import java.util.List;

/**
 * title/artist are null when no tag was present; artist is the raw tag value and may name several
 * artists in one string (see {@code ArtistService#findOrCreateAllFromTag}); durationSeconds is always read from the audio
 * header; genres is never null — empty if the file has none, capped at 3.
 */
record AudioMetadata(String title, String artist, int durationSeconds, List<String> genres) {
}
