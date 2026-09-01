package de.djcloud.backend.playlist;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import de.djcloud.backend.auth.AppUserDetails;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/playlists")
@RequiredArgsConstructor
public class PlaylistController {

    private final PlaylistService playlistService;

    @GetMapping
    public List<PlaylistResponse> list(Authentication authentication,
            @RequestParam(defaultValue = "false") boolean editableOnly) {
        return playlistService.findAllVisible((AppUserDetails) authentication.getPrincipal(), editableOnly);
    }

    @GetMapping("/{id}")
    public PlaylistDetailResponse get(@PathVariable Long id, Authentication authentication) {
        return playlistService.findById(id, (AppUserDetails) authentication.getPrincipal());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PlaylistResponse create(@Valid @RequestBody PlaylistRequest request, Authentication authentication) {
        return playlistService.create(request, (AppUserDetails) authentication.getPrincipal());
    }

    @PutMapping("/{id}")
    public PlaylistResponse update(@PathVariable Long id, @Valid @RequestBody PlaylistRequest request,
            Authentication authentication) {
        return playlistService.update(id, request, (AppUserDetails) authentication.getPrincipal());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, Authentication authentication) {
        playlistService.delete(id, (AppUserDetails) authentication.getPrincipal());
    }

    @PostMapping("/{id}/subscription")
    public PlaylistDetailResponse subscribe(@PathVariable Long id, Authentication authentication) {
        return playlistService.subscribe(id, (AppUserDetails) authentication.getPrincipal());
    }

    @DeleteMapping("/{id}/subscription")
    public PlaylistDetailResponse unsubscribe(@PathVariable Long id, Authentication authentication) {
        return playlistService.unsubscribe(id, (AppUserDetails) authentication.getPrincipal());
    }

    @PostMapping("/{id}/tracks")
    public PlaylistDetailResponse addTrack(@PathVariable Long id, @Valid @RequestBody AddTrackRequest request,
            Authentication authentication) {
        return playlistService.addTrack(id, request, (AppUserDetails) authentication.getPrincipal());
    }

    @DeleteMapping("/{id}/tracks/{trackId}")
    public PlaylistDetailResponse removeTrack(@PathVariable Long id, @PathVariable Long trackId,
            Authentication authentication) {
        return playlistService.removeTrack(id, trackId, (AppUserDetails) authentication.getPrincipal());
    }
}
