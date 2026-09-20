package de.djcloud.backend.auth;

import java.time.Instant;

public record MediaTokenResponse(String token, Instant expiresAt) {

    public static MediaTokenResponse fromMediaToken(MediaToken mediaToken) {
        return new MediaTokenResponse(mediaToken.token(), mediaToken.expiresAt());
    }
}
