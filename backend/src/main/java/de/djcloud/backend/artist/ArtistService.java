package de.djcloud.backend.artist;

import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ArtistService {

    private final ArtistRepository artistRepository;

    @Transactional(readOnly = true)
    public List<ArtistResponse> autocomplete(String query, int limit) {
        if (query == null || query.isBlank()) {
            return List.of();
        }

        Pageable pageable = PageRequest.of(0, limit);

        return artistRepository.findByNameContainingIgnoreCaseOrderByNameAsc(query.trim(), pageable).stream()
                .map(ArtistResponse::fromEntity)
                .toList();
    }

    @Transactional
    public ArtistResponse create(ArtistRequest request) {
        if (artistRepository.existsByNameIgnoreCase(request.name())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Artist already exists");
        }

        Artist artist = new Artist();
        artist.setName(request.name());

        return ArtistResponse.fromEntity(artistRepository.save(artist));
    }

    @Transactional
    public ArtistResponse update(Long id, ArtistRequest request) {
        Artist artist = findOrThrow(id);
        artist.setName(request.name());

        return ArtistResponse.fromEntity(artistRepository.save(artist));
    }

    /** Looks up an artist by name (case-insensitive), creating one if none exists yet. */
    @Transactional
    public Artist findOrCreateByName(String name) {
        return artistRepository.findByNameIgnoreCase(name)
                .orElseGet(() -> {
                    Artist artist = new Artist();
                    artist.setName(name);
                    return artistRepository.save(artist);
                });
    }

    /**
     * Separators taggers use to pack several artists into one ARTIST field: ',' / ';' (and the
     * "; " this app itself writes back, see {@code AudioMetadataWriter}), " & ", and
     * feat./ft./featuring/vs. — deliberately not '/' or " x ", which show up inside real names
     * (AC/DC, "Mr. X").
     */
    private static final Pattern ARTIST_SEPARATOR = Pattern
            .compile("\\s*(?:[,;]|\\s&\\s|\\s(?:feat\\.?|ft\\.?|featuring|vs\\.?)\\s)\\s*", Pattern.CASE_INSENSITIVE);

    /**
     * Resolves a raw ARTIST tag value (possibly several artists in one string) to artist entities,
     * linking to existing ones case-insensitively and creating the rest. A value that exactly
     * matches an existing artist is kept whole, so a name like "Simon & Garfunkel" isn't split
     * apart — except when it contains ',' or ';', which never belong in a single artist name.
     */
    @Transactional
    public List<Artist> findOrCreateAllFromTag(String rawArtists) {
        if (rawArtists == null || rawArtists.isBlank()) {
            return List.of();
        }

        String trimmed = rawArtists.trim();
        if (!trimmed.contains(",") && !trimmed.contains(";")) {
            Optional<Artist> wholeMatch = artistRepository.findByNameIgnoreCase(trimmed);
            if (wholeMatch.isPresent()) {
                return List.of(wholeMatch.get());
            }
        }

        return splitArtistNames(trimmed).stream().map(this::findOrCreateByName).toList();
    }

    /** Splits on {@link #ARTIST_SEPARATOR}, dropping blanks and case-insensitive duplicates. */
    static List<String> splitArtistNames(String rawArtists) {
        Map<String, String> byLowerCase = new LinkedHashMap<>();
        for (String part : ARTIST_SEPARATOR.split(rawArtists)) {
            String name = part.trim();
            if (!name.isEmpty()) {
                byLowerCase.putIfAbsent(name.toLowerCase(Locale.ROOT), name);
            }
        }
        return List.copyOf(byLowerCase.values());
    }

    @Transactional
    public void delete(Long id) {
        Artist artist = findOrThrow(id);

        // clear the join-table rows from the owning (Track) side first, so no track is left
        // pointing at an artist id that no longer exists
        new HashSet<>(artist.getSongs()).forEach(track -> track.getArtists().remove(artist));

        artistRepository.delete(artist);
    }

    private Artist findOrThrow(Long id) {
        return artistRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Artist not found"));
    }
}
