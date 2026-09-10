package de.djcloud.backend.playlist;

import java.time.Instant;
import java.util.ArrayList;
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
import de.djcloud.backend.genre.Genre;
import de.djcloud.backend.track.Track;
import de.djcloud.backend.track.TrackDownloadService;
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

    /** Spacing between adjacent {@code PlaylistTrack.position} values — leaves room to insert between two rows. */
    private static final double POSITION_GAP = 1000.0;

    /** Below this, two neighboring positions are too close to subdivide further — trigger a full re-space instead. */
    private static final double MIN_GAP = 1e-6;

    private final PlaylistRepository playlistRepository;
    private final PlaylistLastViewedRepository playlistLastViewedRepository;
    private final PlaylistSubscriptionRepository playlistSubscriptionRepository;
    private final PlaylistTrackRepository playlistTrackRepository;
    private final TrackRepository trackRepository;
    private final TrackService trackService;
    private final TrackDownloadService trackDownloadService;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<PlaylistResponse> findAll(AppUserDetails caller, boolean editableOnly) {
        List<Playlist> all = playlistRepository.findAll();
        List<Long> playlistIds = all.stream().map(Playlist::getId).toList();

        Map<Long, Instant> lastViewedByPlaylistId = playlistLastViewedRepository.findByUserId(caller.getId()).stream()
                .collect(Collectors.toMap(v -> v.getPlaylist().getId(), PlaylistLastViewed::getViewedAt));

        Set<Long> subscribedPlaylistIds = playlistSubscriptionRepository.findByUserId(caller.getId()).stream()
                .map(s -> s.getPlaylist().getId())
                .collect(Collectors.toSet());

        // Batched (not one query per playlist) so this stays two queries total regardless of how many
        // playlists exist — this is the hot path for a playlist sidebar.
        Map<Long, Integer> trackCountByPlaylistId = playlistIds.isEmpty() ? Map.of()
                : playlistTrackRepository.countGroupedByPlaylistIds(playlistIds).stream()
                        .collect(Collectors.toMap(PlaylistTrackRepository.PlaylistTrackCountRow::getPlaylistId,
                                row -> (int) row.getTrackCount()));

        Map<Long, List<String>> topGenresByPlaylistId = playlistIds.isEmpty() ? Map.of()
                : playlistTrackRepository.genreCountsGroupedByPlaylistIds(playlistIds).stream()
                        .collect(Collectors.groupingBy(PlaylistTrackRepository.PlaylistGenreCountRow::getPlaylistId,
                                Collectors.toMap(PlaylistTrackRepository.PlaylistGenreCountRow::getGenreName,
                                        PlaylistTrackRepository.PlaylistGenreCountRow::getGenreCount)))
                        .entrySet().stream()
                        .collect(Collectors.toMap(Map.Entry::getKey, e -> rankTopGenres(e.getValue())));

        Comparator<Playlist> byLastViewedThenCreated = Comparator
                .comparing((Playlist p) -> lastViewedByPlaylistId.getOrDefault(p.getId(), Instant.MIN))
                .reversed()
                .thenComparing(Playlist::getCreatedAt, Comparator.reverseOrder());

        return all.stream()
                .sorted(byLastViewedThenCreated)
                .filter(p -> !editableOnly || canEditTracks(p, caller))
                .map(p -> PlaylistResponse.fromEntity(p, subscribedPlaylistIds.contains(p.getId()),
                        trackCountByPlaylistId.getOrDefault(p.getId(), 0),
                        topGenresByPlaylistId.getOrDefault(p.getId(), List.of())))
                .toList();
    }

    /** IDs of playlists that already contain the given track. */
    @Transactional(readOnly = true)
    public Set<Long> findPlaylistIdsContainingTrack(Long trackId) {
        return Set.copyOf(playlistRepository.findPlaylistIdsContainingTrack(trackId));
    }

    @Transactional
    public PlaylistDetailResponse findById(Long id, AppUserDetails caller) {
        Playlist playlist = findOrThrow(id);

        recordView(playlist, caller);

        return PlaylistDetailResponse.fromEntity(playlist, canEditTracks(playlist, caller),
                isSubscribed(id, caller.getId()), trackCount(id));
    }

    /**
     * Paged/sorted/searched track listing for one playlist — same backend-driven search as the main
     * library ({@code GET /api/tracks}), scoped to this playlist's tracks via
     * {@link TrackSearchCriteria#scopeToPlaylistId()}.
     */
    @Transactional(readOnly = true)
    public PageResponse<TrackResponse> getTracks(Long id, AppUserDetails caller, TrackSearchCriteria criteria) {
        Playlist playlist = findOrThrow(id);

        return trackService.search(criteria.withScopeToPlaylistId(playlist.getId()));
    }

    public record PlaylistDownload(String playlistName, List<TrackDownloadService.TrackDownloadEntry> entries) {
    }

    /** Materializes everything needed to stream this playlist as a ZIP, in its current manual order. */
    @Transactional(readOnly = true)
    public PlaylistDownload getDownload(Long id, AppUserDetails caller) {
        Playlist playlist = findOrThrow(id);
        List<Track> tracks = playlistTrackRepository.findByPlaylistIdOrderByPosition(id).stream()
                .map(PlaylistTrack::getTrack)
                .toList();

        return new PlaylistDownload(playlist.getName(), trackDownloadService.toDownloadEntries(tracks));
    }

    @Transactional
    public PlaylistResponse create(PlaylistRequest request, AppUserDetails caller) {
        User owner = userRepository.findById(caller.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        Playlist playlist = createPlaylist(request.name(), request.isPublic(), owner);

        return PlaylistResponse.fromEntity(playlist, true, 0, List.of());
    }

    /**
     * Creates a brand-new playlist owned by the caller, seeded with a one-time snapshot of
     * {@code sourceId}'s current tracks (same relative order). Track rows are never duplicated (new
     * {@code PlaylistTrack} join rows just point at the same {@code Track}s), so later changes to
     * either playlist's track membership or order have zero effect on the other.
     */
    @Transactional
    public PlaylistResponse copy(Long sourceId, PlaylistRequest request, AppUserDetails caller) {
        Playlist source = findOrThrow(sourceId);
        User owner = userRepository.findById(caller.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        Playlist playlist = createPlaylist(request.name(), request.isPublic(), owner);

        List<PlaylistTrack> sourceTracks = playlistTrackRepository.findByPlaylistIdOrderByPosition(sourceId);
        List<PlaylistTrack> copiedTracks = sourceTracks.stream().map(sourceTrack -> {
            PlaylistTrack copiedTrack = new PlaylistTrack();
            copiedTrack.setPlaylist(playlist);
            copiedTrack.setTrack(sourceTrack.getTrack());
            copiedTrack.setPosition(sourceTrack.getPosition());
            return copiedTrack;
        }).toList();
        playlistTrackRepository.saveAll(copiedTracks);

        return PlaylistResponse.fromEntity(playlist, true, copiedTracks.size(), topGenresFromTracks(copiedTracks));
    }

    private Playlist createPlaylist(String name, boolean isPublic, User owner) {
        Playlist playlist = new Playlist();
        playlist.setName(name);
        playlist.setPublic(isPublic);
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

        return playlist;
    }

    @Transactional
    public PlaylistResponse update(Long id, PlaylistRequest request, AppUserDetails caller) {
        Playlist playlist = findOrThrow(id);
        assertOwner(playlist, caller);

        playlist.setName(request.name());
        playlist.setPublic(request.isPublic());
        playlistRepository.save(playlist);

        List<PlaylistTrack> tracks = playlistTrackRepository.findByPlaylistIdOrderByPosition(id);

        return PlaylistResponse.fromEntity(playlist, isSubscribed(id, caller.getId()), tracks.size(),
                topGenresFromTracks(tracks));
    }

    @Transactional
    public void delete(Long id, AppUserDetails caller) {
        Playlist playlist = findOrThrow(id);
        assertOwner(playlist, caller);

        playlistLastViewedRepository.deleteByPlaylistId(id);
        playlistSubscriptionRepository.deleteByPlaylistId(id);
        // Nothing cascades this automatically — PlaylistTrack rows aren't an owned Hibernate
        // collection on Playlist, so they'd otherwise be orphaned once the playlist itself is gone.
        playlistTrackRepository.deleteByPlaylistId(id);
        playlistRepository.delete(playlist);
    }

    @Transactional
    public PlaylistDetailResponse subscribe(Long id, AppUserDetails caller) {
        Playlist playlist = findOrThrow(id);

        if (playlistSubscriptionRepository.findByPlaylistIdAndUserId(id, caller.getId()).isEmpty()) {
            User user = userRepository.findById(caller.getId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

            PlaylistSubscription subscription = new PlaylistSubscription();
            subscription.setPlaylist(playlist);
            subscription.setUser(user);
            subscription.setSubscribedAt(Instant.now());
            playlistSubscriptionRepository.save(subscription);
        }

        return PlaylistDetailResponse.fromEntity(playlist, canEditTracks(playlist, caller), true, trackCount(id));
    }

    @Transactional
    public PlaylistDetailResponse unsubscribe(Long id, AppUserDetails caller) {
        Playlist playlist = findOrThrow(id);

        playlistSubscriptionRepository.deleteByPlaylistIdAndUserId(id, caller.getId());

        return PlaylistDetailResponse.fromEntity(playlist, canEditTracks(playlist, caller), false, trackCount(id));
    }

    @Transactional
    public PlaylistDetailResponse addTrack(Long playlistId, AddTrackRequest request, AppUserDetails caller) {
        Playlist playlist = findOrThrow(playlistId);
        assertCanEditTracks(playlist, caller);

        Track track = trackRepository.findById(request.trackId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Track not found"));

        // Mirrors the old Set<Track>.add's silent no-op when the track is already a member.
        if (playlistTrackRepository.findByPlaylistIdAndTrackId(playlistId, track.getId()).isEmpty()) {
            PlaylistTrack playlistTrack = new PlaylistTrack();
            playlistTrack.setPlaylist(playlist);
            playlistTrack.setTrack(track);
            playlistTrack.setPosition(playlistTrackRepository.findMaxPosition(playlistId) + POSITION_GAP);
            playlistTrackRepository.save(playlistTrack);
        }

        return PlaylistDetailResponse.fromEntity(playlist, true, isSubscribed(playlistId, caller.getId()),
                trackCount(playlistId));
    }

    @Transactional
    public PlaylistDetailResponse removeTrack(Long playlistId, Long trackId, AppUserDetails caller) {
        Playlist playlist = findOrThrow(playlistId);
        assertCanEditTracks(playlist, caller);

        playlistTrackRepository.deleteByPlaylistIdAndTrackId(playlistId, trackId);

        return PlaylistDetailResponse.fromEntity(playlist, true, isSubscribed(playlistId, caller.getId()),
                trackCount(playlistId));
    }

    /**
     * Moves {@code trackId} to immediately after {@code request.afterTrackId()} (or to the very front
     * if {@code null}), resolved against this playlist's authoritative DB order — not whatever subset
     * the caller happens to have loaded/paginated client-side. Uses fractional/"gap" indexing: the
     * moved track's new position is the midpoint of its new neighbors, so every other row's position is
     * left untouched; only when the gap between those neighbors gets too small to subdivide further
     * does this fall back to a full re-space of the whole playlist.
     */
    @Transactional
    public PlaylistDetailResponse reorderTrack(Long playlistId, Long trackId, ReorderTrackRequest request,
            AppUserDetails caller) {
        Playlist playlist = findOrThrow(playlistId);
        assertCanEditTracks(playlist, caller);

        Long afterTrackId = request.afterTrackId();
        if (afterTrackId != null && afterTrackId.equals(trackId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A track cannot be positioned after itself");
        }

        List<PlaylistTrack> ordered = playlistTrackRepository.findByPlaylistIdOrderByPosition(playlistId);
        PlaylistTrack moved = ordered.stream()
                .filter(playlistTrack -> playlistTrack.getTrack().getId().equals(trackId))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Track not in this playlist"));

        List<PlaylistTrack> others = ordered.stream().filter(playlistTrack -> playlistTrack != moved).toList();

        int targetIndex;
        if (afterTrackId == null) {
            targetIndex = 0;
        } else {
            int afterIndex = indexOfTrack(others, afterTrackId);
            if (afterIndex < 0) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Reference track not in this playlist");
            }
            targetIndex = afterIndex + 1;
        }

        Double before = targetIndex > 0 ? others.get(targetIndex - 1).getPosition() : null;
        Double after = targetIndex < others.size() ? others.get(targetIndex).getPosition() : null;

        if (before != null && after != null && after - before <= MIN_GAP) {
            renumberWithMovedAt(others, moved, targetIndex);
        } else {
            double newPosition = before != null && after != null ? before + (after - before) / 2.0
                    : before != null ? before + POSITION_GAP
                    : after != null ? after - POSITION_GAP
                    : POSITION_GAP;
            moved.setPosition(newPosition);
            playlistTrackRepository.save(moved);
        }

        return PlaylistDetailResponse.fromEntity(playlist, true, isSubscribed(playlistId, caller.getId()),
                trackCount(playlistId));
    }

    private static int indexOfTrack(List<PlaylistTrack> tracks, Long trackId) {
        for (int i = 0; i < tracks.size(); i++) {
            if (tracks.get(i).getTrack().getId().equals(trackId)) {
                return i;
            }
        }
        return -1;
    }

    /** Full re-space fallback for when fractional insertion has run out of room between two neighbors. */
    private void renumberWithMovedAt(List<PlaylistTrack> others, PlaylistTrack moved, int targetIndex) {
        List<PlaylistTrack> renumbered = new ArrayList<>(others);
        renumbered.add(targetIndex, moved);
        for (int i = 0; i < renumbered.size(); i++) {
            renumbered.get(i).setPosition((i + 1) * POSITION_GAP);
        }
        playlistTrackRepository.saveAll(renumbered);
    }

    private int trackCount(Long playlistId) {
        return (int) playlistTrackRepository.countByPlaylistId(playlistId);
    }

    /** Up to {@link PlaylistResponse#TOP_GENRES_LIMIT} genre names, ranked by how many of these tracks carry them. */
    private static List<String> topGenresFromTracks(List<PlaylistTrack> playlistTracks) {
        Map<String, Long> countsByGenre = playlistTracks.stream()
                .flatMap(playlistTrack -> playlistTrack.getTrack().getGenres().stream())
                .map(Genre::getName)
                .collect(Collectors.groupingBy(name -> name, Collectors.counting()));

        return rankTopGenres(countsByGenre);
    }

    private static List<String> rankTopGenres(Map<String, Long> countsByGenre) {
        return countsByGenre.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed()
                        .thenComparing(Map.Entry.comparingByKey()))
                .map(Map.Entry::getKey)
                .limit(PlaylistResponse.TOP_GENRES_LIMIT)
                .toList();
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

    private boolean canEditTracks(Playlist playlist, AppUserDetails caller) {
        boolean roleOk = caller.getRole() == Role.EDITOR || caller.getRole() == Role.ADMIN;
        boolean visibilityOk = playlist.isPublic() || playlist.getOwner().getId().equals(caller.getId());
        return roleOk && visibilityOk;
    }

    private void assertCanEditTracks(Playlist playlist, AppUserDetails caller) {
        if (!canEditTracks(playlist, caller)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not allowed to modify this playlist");
        }
    }

    /** Renaming, changing visibility, or deleting a playlist is restricted to its owner alone. */
    private void assertOwner(Playlist playlist, AppUserDetails caller) {
        if (!playlist.getOwner().getId().equals(caller.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the playlist owner can do this");
        }
    }

    private Playlist findOrThrow(Long id) {
        return playlistRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Playlist not found"));
    }
}
