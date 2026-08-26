package de.djcloud.backend.artist;

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

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/artists")
@RequiredArgsConstructor
public class ArtistController {

    private final ArtistService artistService;

    @GetMapping("/autocomplete")
    public List<ArtistResponse> autocomplete(@RequestParam String query, @RequestParam(defaultValue = "10") int limit) {
        return artistService.autocomplete(query, limit);
    }

    @PostMapping
    public ArtistResponse create(@Valid @RequestBody ArtistRequest request) {
        return artistService.create(request);
    }

    @PutMapping("/{id}")
    public ArtistResponse update(@PathVariable Long id, @Valid @RequestBody ArtistRequest request) {
        return artistService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        artistService.delete(id);
    }
}
