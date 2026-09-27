package de.djcloud.backend.artist;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Covers {@link ArtistService#findOrCreateAllFromTag}'s splitting of multi-artist tag values. */
class ArtistServiceTest {

    private ArtistRepository artistRepository;
    private ArtistService artistService;

    @BeforeEach
    void setUp() {
        artistRepository = mock(ArtistRepository.class);
        artistService = new ArtistService(artistRepository);
        when(artistRepository.findByNameIgnoreCase(anyString())).thenReturn(Optional.empty());
        when(artistRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void splitArtistNames_handlesCommonSeparators() {
        assertThat(ArtistService.splitArtistNames("Artist1, Artist2")).containsExactly("Artist1", "Artist2");
        assertThat(ArtistService.splitArtistNames("A; B;C")).containsExactly("A", "B", "C");
        assertThat(ArtistService.splitArtistNames("A & B")).containsExactly("A", "B");
        assertThat(ArtistService.splitArtistNames("A feat. B")).containsExactly("A", "B");
        assertThat(ArtistService.splitArtistNames("A Ft B")).containsExactly("A", "B");
        assertThat(ArtistService.splitArtistNames("A featuring B, C")).containsExactly("A", "B", "C");
        assertThat(ArtistService.splitArtistNames("A vs. B")).containsExactly("A", "B");
    }

    @Test
    void splitArtistNames_leavesNamesWithSlashOrXIntactAndDropsDuplicates() {
        assertThat(ArtistService.splitArtistNames("AC/DC")).containsExactly("AC/DC");
        assertThat(ArtistService.splitArtistNames("Mr. X")).containsExactly("Mr. X");
        assertThat(ArtistService.splitArtistNames("Featherstone")).containsExactly("Featherstone");
        assertThat(ArtistService.splitArtistNames("A, a, , B")).containsExactly("A", "B");
    }

    @Test
    void findOrCreateAllFromTag_linksExistingArtistsCaseInsensitively() {
        Artist existing = new Artist();
        existing.setId(1L);
        existing.setName("Artist1");
        when(artistRepository.findByNameIgnoreCase("artist1")).thenReturn(Optional.of(existing));

        List<Artist> artists = artistService.findOrCreateAllFromTag("artist1, Artist2");

        assertThat(artists).hasSize(2);
        assertThat(artists.get(0)).isSameAs(existing);
        assertThat(artists.get(1).getName()).isEqualTo("Artist2");
    }

    @Test
    void findOrCreateAllFromTag_keepsExactExistingMatchWhole() {
        Artist duo = new Artist();
        duo.setName("Simon & Garfunkel");
        when(artistRepository.findByNameIgnoreCase("Simon & Garfunkel")).thenReturn(Optional.of(duo));

        assertThat(artistService.findOrCreateAllFromTag("Simon & Garfunkel")).containsExactly(duo);
        verify(artistRepository, never()).save(any());
    }

    @Test
    void findOrCreateAllFromTag_ignoresWholeMatchWhenValueContainsComma() {
        // a combined artist left behind by an earlier import must not keep absorbing new uploads
        Artist combined = new Artist();
        combined.setName("Artist1, Artist2");
        when(artistRepository.findByNameIgnoreCase("Artist1, Artist2")).thenReturn(Optional.of(combined));

        List<Artist> artists = artistService.findOrCreateAllFromTag("Artist1, Artist2");

        assertThat(artists).extracting(Artist::getName).containsExactly("Artist1", "Artist2");
    }

    @Test
    void findOrCreateAllFromTag_returnsEmptyForBlank() {
        assertThat(artistService.findOrCreateAllFromTag(null)).isEmpty();
        assertThat(artistService.findOrCreateAllFromTag("  ")).isEmpty();
    }
}
