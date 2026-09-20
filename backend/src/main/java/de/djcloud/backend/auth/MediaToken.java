package de.djcloud.backend.auth;

import java.time.Instant;

public record MediaToken(String token, Instant expiresAt) {
}
