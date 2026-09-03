package de.djcloud.backend.track;

import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * Whitelist of columns {@code GET /api/tracks} (and anything built on the same search path) may sort
 * by — {@code sortBy} used to be passed straight into {@code Sort.by(...)}, so a bogus field name
 * would 500 instead of a clean {@code 400}. The wire value for each constant is the matching
 * {@code Track}/frontend field name (camelCase), not the Java enum constant name.
 */
public enum TrackSortField {

    TITLE("title", "title"),
    ARTIST("artist", null),
    BPM("bpm", "bpm"),
    ADDED_AT("addedAt", "addedAt"),
    DATE_ADDED("dateAdded", "dateAdded"),
    DURATION("durationSeconds", "durationSeconds"),
    KEY("key", "key"),
    FILE_FORMAT("fileFormat", "fileFormat");

    private static final Map<String, TrackSortField> BY_WIRE_VALUE = Stream.of(values())
            .collect(Collectors.toMap(f -> f.wireValue, f -> f));

    private final String wireValue;

    /** The real {@link Track} entity property this maps to — {@code null} for {@link #ARTIST}, which has no such property. */
    private final String property;

    TrackSortField(String wireValue, String property) {
        this.wireValue = wireValue;
        this.property = property;
    }

    public String property() {
        return property;
    }

    public static TrackSortField fromParam(String sortBy) {
        TrackSortField field = BY_WIRE_VALUE.get(sortBy.trim());
        if (field == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown sortBy value: " + sortBy);
        }
        return field;
    }
}
