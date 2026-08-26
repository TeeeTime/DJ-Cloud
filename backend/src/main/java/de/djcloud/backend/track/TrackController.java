package de.djcloud.backend.track;

import java.io.File;
import java.io.IOException;
import java.util.List;

import org.springframework.core.io.UrlResource;
import org.springframework.core.io.support.ResourceRegion;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpRange;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/tracks")
@RequiredArgsConstructor
public class TrackController {

    private final TrackService trackService;
    private final TrackUploadService trackUploadService;
    private final TrackStorageService trackStorageService;

    @GetMapping
    public Page<TrackResponse> getTracks(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "30") int size, @RequestParam(defaultValue = "title") String sortBy) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(sortBy));

        return trackService.findAll(pageable);
    }

    @GetMapping("/{id}")
    public TrackResponse getTrack(@PathVariable Long id) {
        return trackService.findById(id);
    }

    /**
     * Streams the original uploaded audio file (no compressed/analyzed preview exists yet — see
     * API.md). Supports HTTP range requests so browsers can seek and start playback without
     * downloading the whole file first.
     */
    @GetMapping("/{id}/audio")
    public ResponseEntity<ResourceRegion> getAudio(@PathVariable Long id, @RequestHeader HttpHeaders headers)
            throws IOException {
        Track track = trackService.findEntity(id);
        if (track.getFileName() == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No audio file stored for this track");
        }

        File file = trackStorageService.resolve(track.getFileName());
        if (!file.exists()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No audio file stored for this track");
        }

        UrlResource resource = new UrlResource(file.toURI());
        long contentLength = resource.contentLength();
        List<HttpRange> ranges = headers.getRange();

        // A ResourceRegion body always makes Spring write a Content-Range header, which is only
        // valid on a 206 — so this always responds 206, capping the chunk size on the first,
        // range-less request so the browser naturally follows up with further range requests
        // instead of receiving (and choking on) the whole file as "partial" content.
        ResourceRegion region;
        if (ranges.isEmpty()) {
            long rangeLength = Math.min(1_000_000, contentLength);
            region = new ResourceRegion(resource, 0, rangeLength);
        } else {
            HttpRange range = ranges.get(0);
            long start = range.getRangeStart(contentLength);
            long end = range.getRangeEnd(contentLength);
            long rangeLength = Math.min(1_000_000, end - start + 1);
            region = new ResourceRegion(resource, start, rangeLength);
        }

        MediaType mediaType = "wav".equalsIgnoreCase(track.getFileFormat())
                ? MediaType.parseMediaType("audio/wav")
                : MediaType.parseMediaType("audio/mpeg");

        return ResponseEntity.status(HttpStatus.PARTIAL_CONTENT)
                .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                .contentType(mediaType)
                .body(region);
    }

    /** Reads title/artist/duration from the file's tags, with placeholders for anything not yet analyzed. */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public TrackResponse uploadTrack(@RequestParam("file") MultipartFile file) {
        return trackUploadService.upload(file);
    }

    @PutMapping("/{id}")
    public TrackResponse updateTrack(@PathVariable Long id, @Valid @RequestBody TrackUpdateRequest request) {
        return trackService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTrack(@PathVariable Long id) {
        trackService.delete(id);
    }
}
