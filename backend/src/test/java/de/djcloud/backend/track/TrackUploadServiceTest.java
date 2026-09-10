package de.djcloud.backend.track;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.File;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import de.djcloud.backend.artist.Artist;
import de.djcloud.backend.artist.ArtistService;
import de.djcloud.backend.genre.GenreService;

/** Covers the duplicate-detection branches added to {@link TrackUploadService#upload}. */
class TrackUploadServiceTest {

    private TrackStorageService trackStorageService;
    private AudioMetadataReader audioMetadataReader;
    private ArtistService artistService;
    private GenreService genreService;
    private TrackRepository trackRepository;
    private TrackAnalysisQueue trackAnalysisQueue;
    private TrackUploadService uploadService;

    private final StoredFile storedFile = new StoredFile(new File("stored.mp3"), "mp3");
    private final MockMultipartFile file = new MockMultipartFile("file", "song.mp3", "audio/mpeg", new byte[] { 1 });

    @BeforeEach
    void setUp() {
        trackStorageService = mock(TrackStorageService.class);
        audioMetadataReader = mock(AudioMetadataReader.class);
        AudioMetadataWriter audioMetadataWriter = mock(AudioMetadataWriter.class);
        artistService = mock(ArtistService.class);
        genreService = mock(GenreService.class);
        trackRepository = mock(TrackRepository.class);
        trackAnalysisQueue = mock(TrackAnalysisQueue.class);
        uploadService = new TrackUploadService(trackStorageService, audioMetadataReader, audioMetadataWriter,
                artistService, genreService, trackRepository, trackAnalysisQueue);

        when(trackStorageService.save(file)).thenReturn(storedFile);
        when(trackStorageService.computeHash(storedFile.file())).thenReturn("hash-123");
    }

    @Test
    void exactFileMatch_isRejectedUnlessConfirmed() {
        Track existing = new Track();
        existing.setId(1L);
        existing.setTitle("Existing Track");
        when(trackRepository.findFirstByContentHash("hash-123")).thenReturn(Optional.of(existing));

        DuplicateTrackException ex = org.junit.jupiter.api.Assertions.assertThrows(DuplicateTrackException.class,
                () -> uploadService.upload(file, false));

        assertThat(ex.getReason()).isEqualTo(DuplicateTrackException.Reason.EXACT_FILE);
        assertThat(ex.getExistingTrack()).isEqualTo(existing);
        verify(trackStorageService).delete(storedFile.file());
        verify(trackRepository, never()).save(any());
        verify(audioMetadataReader, never()).read(any());
    }

    @Test
    void exactFileMatch_proceedsWhenConfirmed() throws AudioMetadataException {
        when(audioMetadataReader.read(storedFile.file())).thenReturn(new AudioMetadata(null, null, 120, List.of()));
        when(trackRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        uploadService.upload(file, true);

        verify(trackRepository, never()).findFirstByContentHash(anyString());
        verify(trackRepository).save(any());
    }

    @Test
    void titleAndArtistMatch_isRejectedUnlessConfirmed() throws AudioMetadataException {
        when(trackRepository.findFirstByContentHash("hash-123")).thenReturn(Optional.empty());
        when(audioMetadataReader.read(storedFile.file()))
                .thenReturn(new AudioMetadata("My Song", "DJ Test", 120, List.of()));

        Artist artist = new Artist();
        artist.setId(2L);
        artist.setName("DJ Test");
        when(artistService.findOrCreateByName("DJ Test")).thenReturn(artist);

        Track existing = new Track();
        existing.setId(3L);
        existing.setTitle("My Song");
        when(trackRepository.findFirstByTitleIgnoreCaseAndArtistsContaining("My Song", artist))
                .thenReturn(Optional.of(existing));

        DuplicateTrackException ex = org.junit.jupiter.api.Assertions.assertThrows(DuplicateTrackException.class,
                () -> uploadService.upload(file, false));

        assertThat(ex.getReason()).isEqualTo(DuplicateTrackException.Reason.TITLE_AND_ARTIST);
        assertThat(ex.getExistingTrack()).isEqualTo(existing);
        verify(trackStorageService).delete(storedFile.file());
        verify(trackRepository, never()).save(any());
    }

    @Test
    void noArtistTag_skipsTitleAndArtistCheck() throws AudioMetadataException {
        when(trackRepository.findFirstByContentHash("hash-123")).thenReturn(Optional.empty());
        when(audioMetadataReader.read(storedFile.file()))
                .thenReturn(new AudioMetadata("My Song", null, 120, List.of()));
        when(trackRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        uploadService.upload(file, false);

        verify(trackRepository, never()).findFirstByTitleIgnoreCaseAndArtistsContaining(anyString(), any());
        verify(trackRepository).save(any());
    }
}
