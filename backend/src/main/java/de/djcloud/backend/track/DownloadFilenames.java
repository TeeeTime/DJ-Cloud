package de.djcloud.backend.track;

import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/** Turns track/playlist/genre metadata into filesystem-safe download names (Windows + macOS). */
final class DownloadFilenames {

    private static final Pattern ILLEGAL_CHARS = Pattern.compile("[<>:\"/\\\\|?*\\x00-\\x1F]");
    private static final Pattern TRAILING_DOTS_SPACES = Pattern.compile("[. ]+$");
    private static final Pattern LEADING_DOTS = Pattern.compile("^\\.+");
    private static final Pattern REPEATED_SEPARATORS = Pattern.compile("[-\\s]{2,}");
    private static final Set<String> RESERVED_NAMES = Set.of(
            "CON", "PRN", "AUX", "NUL",
            "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
            "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9");
    private static final int MAX_COMPONENT_LENGTH = 150;

    private DownloadFilenames() {
    }

    /** "{Title} - {Artist(s)}.{ext}", sanitized for both Windows and macOS. */
    static String buildFileName(String title, String artistsJoined, String extension) {
        String safeTitle = sanitize(title, "Untitled");
        String safeArtists = sanitize(artistsJoined, "Unknown Artist");
        return safeTitle + " - " + safeArtists + "." + extension.toLowerCase(Locale.ROOT);
    }

    static String sanitize(String raw) {
        return sanitize(raw, "Untitled");
    }

    private static String sanitize(String raw, String fallback) {
        String value = raw == null ? "" : raw.trim();
        value = ILLEGAL_CHARS.matcher(value).replaceAll("-");
        value = LEADING_DOTS.matcher(value).replaceAll("");
        value = TRAILING_DOTS_SPACES.matcher(value).replaceAll("");
        value = REPEATED_SEPARATORS.matcher(value).replaceAll(m -> m.group().contains("-") ? "-" : " ");
        value = value.trim();

        if (value.length() > MAX_COMPONENT_LENGTH) {
            value = value.substring(0, MAX_COMPONENT_LENGTH).trim();
        }

        if (value.isEmpty()) {
            return fallback;
        }

        if (RESERVED_NAMES.contains(value.toUpperCase(Locale.ROOT))) {
            return value + "_";
        }

        return value;
    }
}
