package de.djcloud.backend.genre;

import java.util.List;

import org.springframework.http.HttpStatus;
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

import de.djcloud.backend.common.PageResponse;
import de.djcloud.backend.track.TrackResponse;
import de.djcloud.backend.track.TrackSearchCriteria;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/genres")
@RequiredArgsConstructor
public class GenreController {

    private final GenreService genreService;

    @GetMapping("/autocomplete")
    public List<GenreResponse> autocomplete(@RequestParam String query, @RequestParam(defaultValue = "10") int limit) {
        return genreService.autocomplete(query, limit);
    }

    /** How many tracks are tagged with each genre, most-tagged first. Genres with zero tracks are omitted. */
    @GetMapping("/distribution")
    public List<GenreDistributionResponse> distribution() {
        return genreService.distribution();
    }

    /** Same backend-driven search/sort/paging as {@code GET /api/tracks}, scoped to this genre. */
    @GetMapping("/{name}/tracks")
    public PageResponse<TrackResponse> getTracks(@PathVariable String name,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "30") int size,
            @RequestParam(defaultValue = "title") String sortBy, @RequestParam(defaultValue = "asc") String direction,
            @RequestParam(required = false) String query) {
        TrackSearchCriteria criteria = TrackSearchCriteria.fromParams(query, sortBy, direction, page, size, null);

        return genreService.getTracks(name, criteria);
    }

    @PostMapping
    public GenreResponse create(@Valid @RequestBody GenreRequest request) {
        return genreService.create(request);
    }

    @PutMapping("/{id}")
    public GenreResponse update(@PathVariable Long id, @Valid @RequestBody GenreRequest request) {
        return genreService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        genreService.delete(id);
    }
}
