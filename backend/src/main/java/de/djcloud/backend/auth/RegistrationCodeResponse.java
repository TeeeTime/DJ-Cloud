package de.djcloud.backend.auth;

import de.djcloud.backend.user.Role;

public record RegistrationCodeResponse(String code, Role role) {
}
