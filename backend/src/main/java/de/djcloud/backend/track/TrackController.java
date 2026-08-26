package de.djcloud.backend.track;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/tracks")
@RequiredArgsConstructor
public class TrackController {

    private final TrackService trackService;
    private final TrackUploadService trackUploadService;

    @GetMapping
    public Page<TrackResponse> getTracks(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "30") int size, @RequestParam(defaultValue = "title") String sortBy) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(sortBy));

        return trackService.findAll(pageable);
    }

    @GetMapping("/{id}")
    public TrackResponse getTrack(@PathVariable Long id) {
        return trackService.findById(id);
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
