package de.djcloud.backend;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class BackendApplication {

    public static void main(String[] args) throws IOException {
        // SQLite won't create a missing parent directory for its db file, and on a fresh clone
        // ./data (gitignored) doesn't exist yet — create it before Spring even tries to connect.
        Files.createDirectories(Path.of("./data"));

        SpringApplication.run(BackendApplication.class, args);
    }

}
