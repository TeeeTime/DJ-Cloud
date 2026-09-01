package de.djcloud.backend.playlist;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import de.djcloud.backend.auth.AppUserDetails;
import de.djcloud.backend.common.PageResponse;
import de.djcloud.backend.track.Track;
import de.djcloud.backend.track.TrackRepository;
import de.djcloud.backend.track.TrackResponse;
import de.djcloud.backend.track.TrackSearchCriteria;
import de.djcloud.backend.track.TrackService;
import de.djcloud.backend.user.Role;
import de.djcloud.backend.user.User;
import de.djcloud.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PlaylistService {

    private final PlaylistRepository playlistRepository;
    private final PlaylistLastViewedRepository playlistLastViewedRepository;
    private final PlaylistSubscriptionRepository playlistSubscriptionRepository;
    private final TrackRepository trackRepository;
    private final TrackService trackService;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<PlaylistResponse> findAllVisible(AppUserDetails caller, boolean editableOnly) {
        List<Playlist> visible = playlistRepository.findByIsPublicTrueOrOwnerId(caller.getId());

        Map<Long, Instant> lastViewedByPlaylistId = playlistLastViewedRepository.findByUserId(caller.getId()).stream()
                .collect(Collectors.toMap(v -> v.getPlaylist().getId(), PlaylistLastViewed::getViewedAt));

        Set<Long> subscribedPlaylistIds = playlistSubscriptionRepository.findByUserId(caller.getId()).stream()
                .map(s -> s.getPlaylist().getId())
                .collect(Collectors.toSet());

        Comparator<Playlist> byLastViewedThenCreated = Comparator
                .comparing((Playlist p) -> lastViewedByPlaylistId.getOrDefault(p.getId(), Instant.MIN))
                .reversed()
                .thenComparing(Playlist::getCreatedAt, Comparator.reverseOrder());

        return visible.stream()
                .sorted(byLastViewedThenCreated)
                .filter(p -> !editableOnly || canEditTracks(p, caller))
                .map(p -> PlaylistResponse.fromEntity(p, subscribedPlaylistIds.contains(p.getId())))
                .toList();
    }

    @Transactional
    public PlaylistDetailResponse findById(Long id, AppUserDetails caller) {
        Playlist playlist = findOrThrow(id);
        assertCanView(playlist, caller);

        recordView(playlist, caller);

        return PlaylistDetailResponse.fromEntity(playlist, canEditTracks(playlist, caller),
                isSubscribed(id, caller.getId()));
    }

    /**
     * Paged/sorted/searched track listing for one playlist — same backend-driven search as the main
     * library ({@code GET /api/tracks}), scoped to this playlist's tracks via
     * {@link TrackSearchCriteria#scopeToPlaylistId()}.
     */
    @Transactional(readOnly = true)
    public PageResponse<TrackResponse> getTracks(Long id, AppUserDetails caller, TrackSearchCriteria criteria) {
        Playlist playlist = findOrThrow(id);
        assertCanView(playlist, caller);

        return trackService.search(criteria.withScopeToPlaylistId(playlist.getId()));
    }

    @Transactional
    public PlaylistResponse create(PlaylistRequest request, AppUserDetails caller) {
        User owner = userRepository.findById(caller.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        Playlist playlist = new Playlist();
        playlist.setName(request.name());
        playlist.setPublic(request.isPublic());
        playlist.setOwner(owner);
        playlist.setCreatedAt(Instant.now());
        playlist = playlistRepository.save(playlist);

        // Creating a playlist implicitly subscribes its owner, so it shows up in their own sidebar
        // right away without an extra step.
        PlaylistSubscription subscription = new PlaylistSubscription();
        subscription.setPlaylist(playlist);
        subscription.setUser(owner);
        subscription.setSubscribedAt(Instant.now());
        playlistSubscriptionRepository.save(subscription);

        return PlaylistResponse.fromEntity(playlist, true);
    }

    @Transactional
    public PlaylistResponse update(Long id, PlaylistRequest request, AppUserDetails caller) {
        Playlist playlist = findOrThrow(id);
        assertOwner(playlist, caller);

        playlist.setName(request.name());
        playlist.setPublic(request.isPublic());
        playlistRepository.save(playlist);

        return PlaylistResponse.fromEntity(playlist, isSubscribed(id, caller.getId()));
    }

    @Transactional
    public void delete(Long id, AppUserDetails caller) {
        Playlist playlist = findOrThrow(id);
        assertOwner(playlist, caller);

        playlistLastViewedRepository.deleteByPlaylistId(id);
        playlistSubscriptionRepository.deleteByPlaylistId(id);
        playlistRepository.delete(playlist);
    }

    @Transactional
    public PlaylistDetailResponse subscribe(Long id, AppUserDetails caller) {
        Playlist playlist = findOrThrow(id);
        assertCanView(playlist, caller);

        if (playlistSubscriptionRepository.findByPlaylistIdAndUserId(id, caller.getId()).isEmpty()) {
            User user = userRepository.findById(caller.getId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

            PlaylistSubscription subscription = new PlaylistSubscription();
            subscription.setPlaylist(playlist);
            subscription.setUser(user);
            subscription.setSubscribedAt(Instant.now());
            playlistSubscriptionRepository.save(subscription);
        }

        return PlaylistDetailResponse.fromEntity(playlist, canEditTracks(playlist, caller), true);
    }

    @Transactional
    public PlaylistDetailResponse unsubscribe(Long id, AppUserDetails caller) {
        Playlist playlist = findOrThrow(id);
        assertCanView(playlist, caller);

        playlistSubscriptionRepository.deleteByPlaylistIdAndUserId(id, caller.getId());

        return PlaylistDetailResponse.fromEntity(playlist, canEditTracks(playlist, caller), false);
    }

    @Transactional
    public PlaylistDetailResponse addTrack(Long playlistId, AddTrackRequest request, AppUserDetails caller) {
        Playlist playlist = findOrThrow(playlistId);
        assertCanEditTracks(playlist, caller);

        Track track = trackRepository.findById(request.trackId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Track not found"));

        playlist.getTracks().add(track);
        playlistRepository.save(playlist);

        return PlaylistDetailResponse.fromEntity(playlist, true, isSubscribed(playlistId, caller.getId()));
    }

    @Transactional
    public PlaylistDetailResponse removeTrack(Long playlistId, Long trackId, AppUserDetails caller) {
        Playlist playlist = findOrThrow(playlistId);
        assertCanEditTracks(playlist, caller);

        playlist.getTracks().removeIf(t -> t.getId().equals(trackId));
        playlistRepository.save(playlist);

        return PlaylistDetailResponse.fromEntity(playlist, true, isSubscribed(playlistId, caller.getId()));
    }

    private boolean isSubscribed(Long playlistId, Long userId) {
        return playlistSubscriptionRepository.findByPlaylistIdAndUserId(playlistId, userId).isPresent();
    }

    private void recordView(Playlist playlist, AppUserDetails caller) {
        PlaylistLastViewed view = playlistLastViewedRepository
                .findByPlaylistIdAndUserId(playlist.getId(), caller.getId())
                .orElseGet(() -> {
                    PlaylistLastViewed v = new PlaylistLastViewed();
                    v.setPlaylist(playlist);
                    User user = userRepository.findById(caller.getId())
                            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
                    v.setUser(user);
                    return v;
                });
        view.setViewedAt(Instant.now());
        playlistLastViewedRepository.save(view);
    }

    /**
     * A private playlist must not even reveal its existence to a non-owner — so an access check
     * failure here is a 404, never a 403.
     */
    private void assertCanView(Playlist playlist, AppUserDetails caller) {
        if (!playlist.isPublic() && !playlist.getOwner().getId().equals(caller.getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Playlist not found");
        }
    }

    private boolean canEditTracks(Playlist playlist, AppUserDetails caller) {
        boolean roleOk = caller.getRole() == Role.EDITOR || caller.getRole() == Role.ADMIN;
        boolean visibilityOk = playlist.isPublic() || playlist.getOwner().getId().equals(caller.getId());
        return roleOk && visibilityOk;
    }

    private void assertCanEditTracks(Playlist playlist, AppUserDetails caller) {
        assertCanView(playlist, caller);
        if (!canEditTracks(playlist, caller)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not allowed to modify this playlist");
        }
    }

    /** Renaming, changing visibility, or deleting a playlist is restricted to its owner alone. */
    private void assertOwner(Playlist playlist, AppUserDetails caller) {
        assertCanView(playlist, caller);
        if (!playlist.getOwner().getId().equals(caller.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the playlist owner can do this");
        }
    }

    private Playlist findOrThrow(Long id) {
        return playlistRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Playlist not found"));
    }
}
