package de.djcloud.backend.track;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import de.djcloud.backend.artist.Artist;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Reads original (never preview) audio files off disk for download, under a human-readable
 * filename instead of the internal UUID storage name — for a single track, or bundled into a ZIP
 * for a whole playlist/genre.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TrackDownloadService {

    private final TrackService trackService;
    private final TrackStorageService trackStorageService;

    public record TrackFile(byte[] data, String fileName, String mediaType) {
    }

    /** A materialized, entity-free snapshot of one track — safe to use after the DB session has closed. */
    public record TrackDownloadEntry(String storedFileName, String downloadFileName) {
    }

    @Transactional(readOnly = true)
    public TrackFile getDownloadFile(Long trackId) {
        Track track = trackService.findEntity(trackId);
        if (track.getFileName() == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No audio file available for this track");
        }

        File file = trackStorageService.resolve(track.getFileName());
        if (!file.exists()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No audio file available for this track");
        }

        byte[] data;
        try {
            data = Files.readAllBytes(file.toPath());
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not read audio file", ex);
        }

        String fileName = DownloadFilenames.buildFileName(track.getTitle(), joinArtistNames(track), track.getFileFormat());

        return new TrackFile(data, fileName, mediaTypeFor(track.getFileFormat()));
    }

    /**
     * Materializes download-ready entries for a set of tracks, including collision-safe filenames
     * for use as ZIP entry names. MUST be called from inside the caller's own {@code @Transactional}
     * method — this reads {@code track.getArtists()} (a lazy collection) while the Hibernate session
     * is still open; the returned list is a flat, detached snapshot with no further entity access.
     */
    @Transactional(readOnly = true)
    public List<TrackDownloadEntry> toDownloadEntries(Collection<Track> tracks) {
        Map<String, Integer> usedNames = new HashMap<>();
        List<TrackDownloadEntry> entries = new ArrayList<>();

        for (Track track : tracks) {
            if (track.getFileName() == null) {
                continue;
            }

            String baseName = DownloadFilenames.buildFileName(track.getTitle(), joinArtistNames(track), track.getFileFormat());
            entries.add(new TrackDownloadEntry(track.getFileName(), uniquify(baseName, usedNames)));
        }

        return entries;
    }

    /**
     * Builds a ZIP of the given entries in memory. Pure I/O — touches only the filesystem and the
     * already-materialized entry list, never the database. Buffered (rather than streamed straight
     * to the HTTP response) because a playlist/genre is a bounded, curated set of tracks, not the
     * whole library, and buffering sidesteps chunked-transfer-encoding issues observed with {@code
     * StreamingResponseBody} in this environment.
     */
    public byte[] buildZip(List<TrackDownloadEntry> entries) {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();

        try (ZipOutputStream zip = new ZipOutputStream(buffer)) {
            for (TrackDownloadEntry entry : entries) {
                File file = trackStorageService.resolve(entry.storedFileName());
                if (!file.exists()) {
                    log.warn("Skipping missing track file during zip download: {}", entry.storedFileName());
                    continue;
                }

                zip.putNextEntry(new ZipEntry(entry.downloadFileName()));
                Files.copy(file.toPath(), zip);
                zip.closeEntry();
            }
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not build zip download", ex);
        }

        return buffer.toByteArray();
    }

    private String uniquify(String fileName, Map<String, Integer> usedNames) {
        int count = usedNames.merge(fileName, 1, Integer::sum);
        if (count == 1) {
            return fileName;
        }

        int dotIndex = fileName.lastIndexOf('.');
        String base = dotIndex < 0 ? fileName : fileName.substring(0, dotIndex);
        String extension = dotIndex < 0 ? "" : fileName.substring(dotIndex);
        return base + " (" + count + ")" + extension;
    }

    private String joinArtistNames(Track track) {
        return track.getArtists().stream()
                .map(Artist::getName)
                .sorted()
                .collect(Collectors.joining(", "));
    }

    /** Sanitizes an arbitrary display name (e.g. a playlist or genre name) for use as a ZIP filename. */
    public String sanitizeName(String raw) {
        return DownloadFilenames.sanitize(raw);
    }

    private String mediaTypeFor(String fileFormat) {
        if (fileFormat != null && fileFormat.equalsIgnoreCase("wav")) {
            return "audio/wav";
        }
        return "audio/mpeg";
    }
}
