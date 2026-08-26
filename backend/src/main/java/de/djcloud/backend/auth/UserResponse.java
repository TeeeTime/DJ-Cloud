package de.djcloud.backend.auth;

import de.djcloud.backend.user.Role;

public record UserResponse(Long id, String username, Role role) {

    public static UserResponse fromUserDetails(AppUserDetails userDetails) {
        return new UserResponse(userDetails.getId(), userDetails.getUsername(), userDetails.getRole());
    }
}
