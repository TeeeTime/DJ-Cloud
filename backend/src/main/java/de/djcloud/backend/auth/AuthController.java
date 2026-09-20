package de.djcloud.backend.auth;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    /** Called with a still-valid token to get a fresh one, so a logged-in session persists without re-entering credentials. */
    @PostMapping("/refresh")
    public AuthResponse refresh(Authentication authentication) {
        return authService.refresh((AppUserDetails) authentication.getPrincipal());
    }

    @GetMapping("/me")
    public UserResponse me(Authentication authentication) {
        return authService.me((AppUserDetails) authentication.getPrincipal());
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public void register(@Valid @RequestBody RegisterRequest request) {
        authService.register(request);
    }

    @PostMapping("/registration-codes")
    public RegistrationCodeResponse generateRegistrationCode(Authentication authentication,
            @Valid @RequestBody GenerateRegistrationCodeRequest request) {
        return authService.generateRegistrationCode(authentication.getName(), request.role());
    }

    /** Invalidates every token previously issued to the caller's account (all devices, not just this one). */
    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(Authentication authentication) {
        authService.logout((AppUserDetails) authentication.getPrincipal());
    }

    /** Also logs the account out everywhere, since the old token(s) must no longer work with the old password. */
    @PostMapping("/change-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(Authentication authentication, @Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword((AppUserDetails) authentication.getPrincipal(), request);
    }

    /** Marks the caller's "recently added" list as seen as of now, clearing any "new" tags on next fetch. */
    @PostMapping("/me/recently-added-seen")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markRecentlyAddedSeen(Authentication authentication) {
        authService.markRecentlyAddedSeen((AppUserDetails) authentication.getPrincipal());
    }
}
