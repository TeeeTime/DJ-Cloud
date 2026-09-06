package de.djcloud.backend.track;

import java.time.Instant;
import java.time.LocalDate;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import de.djcloud.backend.artist.ArtistService;
import de.djcloud.backend.genre.GenreService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class TrackUploadService {

    private final TrackStorageService trackStorageService;
    private final AudioMetadataReader audioMetadataReader;
    private final AudioMetadataWriter audioMetadataWriter;
    private final ArtistService artistService;
    private final GenreService genreService;
    private final TrackRepository trackRepository;
    private final TrackAnalysisQueue trackAnalysisQueue;

    /**
     * Every failure path here reports a descriptive error and leaves nothing behind: no Track row
     * is ever created, and any file already written to disk is deleted first.
     */
    public TrackResponse upload(MultipartFile file) {
        StoredFile storedFile = trackStorageService.save(file);

        AudioMetadata metadata;
        try {
            metadata = audioMetadataReader.read(storedFile.file());
        } catch (AudioMetadataException ex) {
            trackStorageService.delete(storedFile.file());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage());
        }

        Track savedTrack;
        try {
            Track track = new Track();
            track.setTitle(resolveTitle(metadata.title(), file.getOriginalFilename()));
            track.setDurationSeconds(metadata.durationSeconds());
            track.setKey(null);
            track.setBpm(0);
            track.setFileFormat(storedFile.extension());
            track.setDateAdded(LocalDate.now());
            track.setAddedAt(Instant.now());
            track.setFileName(storedFile.file().getName());
            track.setStatus(TrackStatus.QUEUED);

            if (metadata.artist() != null) {
                // findOrCreateByName and trackRepository.save() below are each independently
                // transactional (ArtistService / Spring Data JPA) rather than wrapped in one
                // shared transaction here, since the file I/O above must never run inside one
                track.getArtists().add(artistService.findOrCreateByName(metadata.artist()));
            }

            metadata.genres().forEach(genreName -> track.getGenres().add(genreService.findOrCreateByName(genreName)));

            savedTrack = trackRepository.save(track);
        } catch (RuntimeException ex) {
            trackStorageService.delete(storedFile.file());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Track could not be saved", ex);
        }

        // Outside the try/catch above on purpose: once the row is safely saved, a problem writing
        // this tag or submitting the track for analysis must never trigger the "delete the upload"
        // cleanup meant for actual save failures. A missing id tag is self-healed on the next
        // backend restart by CustomIdBackfillRunner, so it's safe to just warn and move on here.
        try {
            audioMetadataWriter.writeInternalId(storedFile.file(), savedTrack.getId());
        } catch (AudioMetadataException ex) {
            log.warn("Could not embed internal id tag for track {}: {}", savedTrack.getId(), ex.getMessage());
        }

        trackAnalysisQueue.enqueue(savedTrack.getId());

        return TrackResponse.fromEntity(savedTrack);
    }

    private String resolveTitle(String tagTitle, String originalFilename) {
        if (tagTitle != null) {
            return tagTitle;
        }

        if (originalFilename == null) {
            return "Untitled";
        }

        int dotIndex = originalFilename.lastIndexOf('.');
        return dotIndex < 0 ? originalFilename : originalFilename.substring(0, dotIndex);
    }
}
