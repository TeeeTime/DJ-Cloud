package de.djcloud.backend.auth;

import de.djcloud.backend.user.Role;
import jakarta.validation.constraints.NotNull;

public record GenerateRegistrationCodeRequest(@NotNull Role role) {
}
