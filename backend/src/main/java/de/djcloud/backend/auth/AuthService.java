package de.djcloud.backend.auth;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;

import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import de.djcloud.backend.user.Role;
import de.djcloud.backend.user.User;
import de.djcloud.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final int CODE_BYTES = 24;

    private final UserRepository userRepository;
    private final RegistrationCodeRepository registrationCodeRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final CustomUserDetailsService userDetailsService;
    private final JwtService jwtService;

    private final SecureRandom secureRandom = new SecureRandom();

    public AuthResponse login(LoginRequest request) {
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.username(), request.password()));
        } catch (AuthenticationException ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username or password");
        }

        return toAuthResponse(userDetailsService.loadUserByUsername(request.username()));
    }

    public AuthResponse refresh(AppUserDetails userDetails) {
        return toAuthResponse(userDetails);
    }

    public UserResponse me(AppUserDetails userDetails) {
        return UserResponse.fromUserDetails(userDetails);
    }

    @Transactional
    public void register(RegisterRequest request) {
        RegistrationCode registrationCode = registrationCodeRepository.findByCode(request.registrationCode())
                .filter(code -> !code.isUsed())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Invalid or already used registration code"));

        if (userRepository.existsByUsername(request.username())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username is already taken");
        }

        User user = new User();
        user.setUsername(request.username());
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setRole(registrationCode.getRole());
        userRepository.save(user);

        registrationCode.setUsed(true);
        registrationCode.setUsedAt(Instant.now());
        registrationCode.setUsedBy(user.getUsername());
        registrationCodeRepository.save(registrationCode);
    }

    @Transactional
    public RegistrationCodeResponse generateRegistrationCode(String createdByUsername, Role role) {
        RegistrationCode registrationCode = new RegistrationCode();
        registrationCode.setCode(generateCode());
        registrationCode.setCreatedBy(createdByUsername);
        registrationCode.setRole(role);
        registrationCodeRepository.save(registrationCode);

        return new RegistrationCodeResponse(registrationCode.getCode(), registrationCode.getRole());
    }

    /** Invalidates every JWT previously issued to this account (all devices). */
    @Transactional
    public void logout(AppUserDetails userDetails) {
        bumpTokenVersion(userDetails.getUsername());
    }

    @Transactional(readOnly = true)
    public Instant getLastSeenRecentlyAddedAt(AppUserDetails userDetails) {
        return userRepository.findByUsername(userDetails.getUsername())
                .map(User::getLastSeenRecentlyAddedAt)
                .orElse(null);
    }

    @Transactional
    public void markRecentlyAddedSeen(AppUserDetails userDetails) {
        User user = userRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        user.setLastSeenRecentlyAddedAt(Instant.now());
        userRepository.save(user);
    }

    @Transactional
    public void changePassword(AppUserDetails userDetails, ChangePasswordRequest request) {
        User user = userRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));

        if (!passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Current password is incorrect");
        }

        user.setPassword(passwordEncoder.encode(request.newPassword()));
        user.setTokenVersion(user.getTokenVersion() + 1);
        userRepository.save(user);
    }

    private void bumpTokenVersion(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        user.setTokenVersion(user.getTokenVersion() + 1);
        userRepository.save(user);
    }

    private String generateCode() {
        byte[] bytes = new byte[CODE_BYTES];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private AuthResponse toAuthResponse(AppUserDetails userDetails) {
        String token = jwtService.generateToken(userDetails);
        return new AuthResponse(token, userDetails.getUsername(), userDetails.getRole().name());
    }
}
