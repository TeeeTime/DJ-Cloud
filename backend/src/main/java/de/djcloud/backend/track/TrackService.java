package de.djcloud.backend.track;

import java.io.File;
import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import de.djcloud.backend.artist.Artist;
import de.djcloud.backend.artist.ArtistRepository;
import de.djcloud.backend.common.PageResponse;
import de.djcloud.backend.genre.Genre;
import de.djcloud.backend.genre.GenreRepository;
import de.djcloud.backend.playlist.PlaylistTrackRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class TrackService {

    private final TrackRepository trackRepository;
    private final ArtistRepository artistRepository;
    private final GenreRepository genreRepository;
    private final TrackStorageService trackStorageService;
    private final AudioMetadataWriter audioMetadataWriter;
    private final PlaylistTrackRepository playlistTrackRepository;

    /**
     * Backs every backend-driven track listing — the main library ({@code GET /api/tracks}), a single
     * playlist's track list, and the add-track-to-playlist search — via {@link TrackSearchCriteria}.
     * Plain scalar sort fields go through a real database-level {@code Page} query; sorting by artist
     * or by playlist position each need their own path, since neither is a plain {@code Track}
     * property (see {@link TrackRepositoryCustom#findIdsSortedByArtist} /
     * {@link TrackRepositoryCustom#findIdsSortedByPosition}).
     */
    @Transactional(readOnly = true)
    public PageResponse<TrackResponse> search(TrackSearchCriteria criteria) {
        Specification<Track> spec = TrackSpecifications.fromCriteria(criteria);

        if (criteria.sortBy() == TrackSortField.ARTIST) {
            return searchByCustomOrder(spec, criteria, trackRepository.findIdsSortedByArtist(criteria));
        }
        if (criteria.sortBy() == TrackSortField.POSITION) {
            return searchByCustomOrder(spec, criteria, trackRepository.findIdsSortedByPosition(criteria));
        }

        Sort sort = Sort.by(criteria.direction(), criteria.sortBy().property());
        var page = trackRepository.findAll(spec, PageRequest.of(criteria.page(), criteria.size(), sort));

        return PageResponse.of(page.map(TrackResponse::fromEntity));
    }

    /** Shared by the two sort modes above that resolve an ordered id list themselves instead of a plain {@code Sort}. */
    private PageResponse<TrackResponse> searchByCustomOrder(Specification<Track> spec, TrackSearchCriteria criteria,
            List<Long> ids) {
        long total = trackRepository.count(spec);

        Map<Long, Track> byId = trackRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Track::getId, t -> t));
        List<TrackResponse> content = ids.stream()
                .map(byId::get)
                .map(TrackResponse::fromEntity)
                .toList();

        return PageResponse.of(content, criteria.page(), criteria.size(), total);
    }

    @Transactional(readOnly = true)
    public RecentTracksResponse findRecent(int limit, Instant lastSeen) {
        List<RecentTrackResponse> tracks = trackRepository.findAllByOrderByAddedAtDesc(PageRequest.of(0, limit)).stream()
                .map(track -> RecentTrackResponse.fromEntity(track,
                        lastSeen == null || track.getAddedAt().isAfter(lastSeen)))
                .toList();
        long newCount = lastSeen == null ? trackRepository.count() : trackRepository.countByAddedAtAfter(lastSeen);

        return new RecentTracksResponse(tracks, newCount);
    }

    @Transactional(readOnly = true)
    public TrackResponse findById(Long id) {
        return TrackResponse.fromEntity(findOrThrow(id));
    }

    @Transactional
    public TrackResponse update(Long id, TrackUpdateRequest request) {
        Track track = findOrThrow(id);

        track.setTitle(request.title());
        track.setDurationSeconds(request.durationSeconds());
        track.setKey(request.key());
        track.setBpm(request.bpm());
        track.setFileFormat(request.fileFormat());
        track.setStatus(request.status());

        Set<Artist> artists = request.artistIds().stream()
                .map(artistId -> artistRepository.findById(artistId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                "Unknown artist id: " + artistId)))
                .collect(Collectors.toSet());
        track.setArtists(artists);

        Set<Genre> genres = request.genreIds().stream()
                .map(genreId -> genreRepository.findById(genreId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                "Unknown genre id: " + genreId)))
                .collect(Collectors.toSet());
        track.setGenres(genres);

        writeMetadataToFile(track);

        return TrackResponse.fromEntity(trackRepository.save(track));
    }

    /**
     * Keeps the original audio file's own tags in sync with an edit made through the API, so the
     * file never drifts out of sync with what's shown here. Silently does nothing if the track has
     * no file on disk (e.g. a pre-migration row); a write failure fails the whole update, since a
     * track's metadata and its file's tags must never be allowed to diverge.
     */
    private void writeMetadataToFile(Track track) {
        if (track.getFileName() == null) {
            return;
        }

        File file = trackStorageService.resolve(track.getFileName());
        if (!file.exists()) {
            return;
        }

        try {
            audioMetadataWriter.write(file, track.getTitle(), track.getKey(), track.getBpm(), track.getArtists(),
                    track.getGenres());
        } catch (AudioMetadataException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Could not update audio file metadata", ex);
        }
    }

    private static final Set<String> ALLOWED_COVER_MIME_TYPES = Set.of("image/jpeg", "image/png");

    /**
     * Writes a new cover image straight into the track's audio file (there's no separate cover
     * storage — see `GET /{id}/cover`), replacing whatever artwork was embedded before.
     */
    @Transactional(readOnly = true)
    public void updateCover(Long id, MultipartFile file) {
        Track track = findOrThrow(id);

        if (track.getFileName() == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No audio file stored for this track");
        }

        File audioFile = trackStorageService.resolve(track.getFileName());
        if (!audioFile.exists()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No audio file stored for this track");
        }

        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Uploaded cover image is empty");
        }

        String mimeType = file.getContentType() == null ? null : file.getContentType().toLowerCase(Locale.ROOT);
        if (!ALLOWED_COVER_MIME_TYPES.contains(mimeType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Unsupported image type — only .jpg/.jpeg and .png are accepted");
        }

        byte[] imageData;
        try {
            imageData = file.getBytes();
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Uploaded cover image could not be read", ex);
        }

        try {
            audioMetadataWriter.writeArtwork(audioFile, imageData, mimeType);
        } catch (AudioMetadataException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Could not update audio file metadata", ex);
        }
    }

    /** Clears the track's embedded cover art entirely — idempotent, a no-op if there was none. */
    @Transactional(readOnly = true)
    public void removeCover(Long id) {
        Track track = findOrThrow(id);

        if (track.getFileName() == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No audio file stored for this track");
        }

        File audioFile = trackStorageService.resolve(track.getFileName());
        if (!audioFile.exists()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No audio file stored for this track");
        }

        try {
            audioMetadataWriter.removeArtwork(audioFile);
        } catch (AudioMetadataException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Could not update audio file metadata", ex);
        }
    }

    @Transactional
    public void delete(Long id) {
        Track track = findOrThrow(id);

        // clear this track's playlist memberships first, so no playlist is left pointing at a track
        // id that no longer exists
        playlistTrackRepository.deleteByTrackId(id);

        trackRepository.delete(track);
        trackStorageService.deleteByFileName(track.getFileName());
        trackStorageService.deletePreviewByFileName(track.getPreviewFileName());
    }

    @Transactional(readOnly = true)
    Track findEntity(Long id) {
        return findOrThrow(id);
    }

    private Track findOrThrow(Long id) {
        return trackRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Track not found"));
    }
}
