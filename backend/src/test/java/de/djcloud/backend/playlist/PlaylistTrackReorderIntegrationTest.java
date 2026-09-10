package de.djcloud.backend.playlist;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import de.djcloud.backend.auth.AppUserDetails;
import de.djcloud.backend.common.PageResponse;
import de.djcloud.backend.track.Track;
import de.djcloud.backend.track.TrackRepository;
import de.djcloud.backend.track.TrackResponse;
import de.djcloud.backend.track.TrackSearchCriteria;
import de.djcloud.backend.track.TrackStatus;
import de.djcloud.backend.user.Role;
import de.djcloud.backend.user.User;
import de.djcloud.backend.user.UserRepository;

/**
 * End-to-end exercise of the new manual playlist ordering: adding tracks assigns increasing
 * positions, {@code sortBy=position} reflects them, reorder does fractional-indexing moves
 * (including forcing the renumber fallback), and removing a playlist cleans up its
 * {@link PlaylistTrack} rows. Runs against the real (test) datasource via the actual repositories/
 * service — not mocked — so it also doubles as a check that the Criteria-API rewrites in
 * {@code TrackSpecifications}/{@code TrackRepositoryCustomImpl} are wired correctly.
 */
@SpringBootTest
@Transactional
class PlaylistTrackReorderIntegrationTest {

    @Autowired
    private PlaylistService playlistService;

    @Autowired
    private PlaylistRepository playlistRepository;

    @Autowired
    private PlaylistTrackRepository playlistTrackRepository;

    @Autowired
    private TrackRepository trackRepository;

    @Autowired
    private UserRepository userRepository;

    private User newUser(String username) {
        User user = new User();
        user.setUsername(username);
        user.setPassword("hash");
        user.setRole(Role.EDITOR);
        return userRepository.save(user);
    }

    private Track newTrack(String title) {
        Track track = new Track();
        track.setTitle(title);
        track.setStatus(TrackStatus.READY);
        track.setAddedAt(Instant.now());
        return trackRepository.save(track);
    }

    private List<Long> orderedTrackIds(Long playlistId) {
        return playlistTrackRepository.findByPlaylistIdOrderByPosition(playlistId).stream()
                .map(pt -> pt.getTrack().getId())
                .toList();
    }

    @Test
    void addTrackAssignsIncreasingPositionsAndReorderMovesTracksCorrectly() {
        User owner = newUser("reorder-test-owner");
        AppUserDetails caller = new AppUserDetails(owner);

        Playlist playlist = new Playlist();
        playlist.setName("Test Playlist");
        playlist.setPublic(true);
        playlist.setOwner(owner);
        playlist.setCreatedAt(Instant.now());
        playlist = playlistRepository.save(playlist);
        final Long playlistId = playlist.getId();

        Track a = newTrack("A");
        Track b = newTrack("B");
        Track c = newTrack("C");

        playlistService.addTrack(playlistId, new AddTrackRequest(a.getId()), caller);
        playlistService.addTrack(playlistId, new AddTrackRequest(b.getId()), caller);
        playlistService.addTrack(playlistId, new AddTrackRequest(c.getId()), caller);

        assertThat(orderedTrackIds(playlistId)).containsExactly(a.getId(), b.getId(), c.getId());

        // Re-adding an already-present track is a silent no-op, same as the old Set.add behavior.
        PlaylistDetailResponse afterDuplicateAdd = playlistService.addTrack(playlistId,
                new AddTrackRequest(a.getId()), caller);
        assertThat(afterDuplicateAdd.trackCount()).isEqualTo(3);
        assertThat(orderedTrackIds(playlistId)).containsExactly(a.getId(), b.getId(), c.getId());

        // Move C to the very front.
        playlistService.reorderTrack(playlistId, c.getId(), new ReorderTrackRequest(null), caller);
        assertThat(orderedTrackIds(playlistId)).containsExactly(c.getId(), a.getId(), b.getId());

        // Move A to between C and B (i.e. back to the middle).
        playlistService.reorderTrack(playlistId, a.getId(), new ReorderTrackRequest(c.getId()), caller);
        assertThat(orderedTrackIds(playlistId)).containsExactly(c.getId(), a.getId(), b.getId());

        // Moving after itself is rejected.
        org.assertj.core.api.Assertions.assertThatThrownBy(
                () -> playlistService.reorderTrack(playlistId, a.getId(), new ReorderTrackRequest(a.getId()), caller))
                .isInstanceOf(org.springframework.web.server.ResponseStatusException.class);

        // Force the renumber fallback by repeatedly bisecting the same gap until it's smaller than
        // the reorder logic's MIN_GAP epsilon, then confirm one more reorder into that same tiny gap
        // still produces a correct (if fully re-spaced) order instead of throwing or colliding.
        for (int i = 0; i < 60; i++) {
            playlistService.reorderTrack(playlistId, b.getId(), new ReorderTrackRequest(c.getId()), caller);
            playlistService.reorderTrack(playlistId, b.getId(), new ReorderTrackRequest(null), caller);
        }
        playlistService.reorderTrack(playlistId, b.getId(), new ReorderTrackRequest(c.getId()), caller);
        assertThat(orderedTrackIds(playlistId)).containsExactly(c.getId(), b.getId(), a.getId());

        // sortBy=position through the normal search path reflects the same order.
        TrackSearchCriteria criteria = TrackSearchCriteria.fromParams(null, "position", "asc", 0, 30, null, null,
                null, null, null, null);
        PageResponse<TrackResponse> page = playlistService.getTracks(playlistId, caller, criteria);
        assertThat(page.content().stream().map(TrackResponse::id).toList())
                .containsExactly(c.getId(), b.getId(), a.getId());

        // Removing one track doesn't disturb the others' relative order.
        playlistService.removeTrack(playlistId, b.getId(), caller);
        assertThat(orderedTrackIds(playlistId)).containsExactly(c.getId(), a.getId());

        // Deleting the playlist cleans up its PlaylistTrack rows (nothing cascades this automatically
        // now that Playlist.tracks is gone).
        playlistService.delete(playlistId, caller);
        assertThat(playlistTrackRepository.findByPlaylistIdOrderByPosition(playlistId)).isEmpty();
    }
}
