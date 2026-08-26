package de.djcloud.backend.auth;

public record AuthResponse(String token, String username, String role) {
}
