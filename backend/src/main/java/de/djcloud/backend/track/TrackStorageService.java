package de.djcloud.backend.track;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
class TrackStorageService {

    private static final List<String> ALLOWED_EXTENSIONS = List.of("mp3", "wav");

    @Value("${app.storage.tracks-dir}")
    private String tracksDir;

    @Value("${app.storage.previews-dir}")
    private String previewsDir;

    @PostConstruct
    void createStorageDirectory() throws IOException {
        Files.createDirectories(Path.of(tracksDir));
        Files.createDirectories(Path.of(previewsDir));
    }

    StoredFile save(MultipartFile file) {
        String extension = extensionOf(file);

        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Uploaded file is empty");
        }

        Path target = Path.of(tracksDir, UUID.randomUUID() + "." + extension);

        try {
            file.transferTo(target);
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not save uploaded file", ex);
        }

        return new StoredFile(target.toFile(), extension);
    }

    /** SHA-256 hex digest of the file's bytes, streamed rather than read fully into memory. */
    String computeHash(File file) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (InputStream in = new DigestInputStream(Files.newInputStream(file.toPath()), digest)) {
                byte[] buffer = new byte[8192];
                while (in.read(buffer) != -1) {
                    // reading drains the stream through the DigestInputStream, updating the digest
                }
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not hash uploaded file", ex);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 not available", ex);
        }
    }

    void delete(File file) {
        if (!file.delete()) {
            log.warn("Could not delete orphaned upload file: {}", file);
        }
    }

    File resolve(String fileName) {
        return Path.of(tracksDir, fileName).toFile();
    }

    void deleteByFileName(String fileName) {
        if (fileName != null) {
            delete(resolve(fileName));
        }
    }

    /** Allocates a fresh, not-yet-existing file path for a generated preview — always an mp3. */
    File newPreviewFile() {
        return Path.of(previewsDir, UUID.randomUUID() + ".mp3").toFile();
    }

    File resolvePreview(String previewFileName) {
        return Path.of(previewsDir, previewFileName).toFile();
    }

    void deletePreviewByFileName(String previewFileName) {
        if (previewFileName != null) {
            delete(resolvePreview(previewFileName));
        }
    }

    private String extensionOf(MultipartFile file) {
        String originalFilename = file.getOriginalFilename();
        int dotIndex = originalFilename == null ? -1 : originalFilename.lastIndexOf('.');
        String extension = dotIndex < 0 ? "" : originalFilename.substring(dotIndex + 1).toLowerCase(Locale.ROOT);

        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Unsupported file type — only .mp3 and .wav are accepted");
        }

        return extension;
    }
}
