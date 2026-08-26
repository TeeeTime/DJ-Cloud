package de.djcloud.backend.track;

/** Wraps any failure jaudiotagger can throw so callers only ever deal with one exception type. */
class AudioMetadataException extends RuntimeException {

    AudioMetadataException(String message, Throwable cause) {
        super(message, cause);
    }
}
