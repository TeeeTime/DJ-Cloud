package de.djcloud.backend.track;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import de.djcloud.backend.artist.ArtistService;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class TrackUploadService {

    private final TrackStorageService trackStorageService;
    private final AudioMetadataReader audioMetadataReader;
    private final ArtistService artistService;
    private final TrackRepository trackRepository;

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

        try {
            Track track = new Track();
            track.setTitle(resolveTitle(metadata.title(), file.getOriginalFilename()));
            track.setDurationSeconds(metadata.durationSeconds());
            track.setKey(null);
            track.setBpm(0);
            track.setFileFormat(storedFile.extension());
            track.setFileName(storedFile.file().getName());
            track.setStatus(TrackStatus.QUEUED);

            if (metadata.artist() != null) {
                // findOrCreateByName and trackRepository.save() below are each independently
                // transactional (ArtistService / Spring Data JPA) rather than wrapped in one
                // shared transaction here, since the file I/O above must never run inside one
                track.getArtists().add(artistService.findOrCreateByName(metadata.artist()));
            }

            return TrackResponse.fromEntity(trackRepository.save(track));
        } catch (RuntimeException ex) {
            trackStorageService.delete(storedFile.file());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Track could not be saved", ex);
        }
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
