package de.djcloud.backend.auth;

import java.time.Instant;
import java.util.Date;
import java.util.Map;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

@Service
public class JwtService {

    private static final String PURPOSE_CLAIM = "purpose";
    private static final String MEDIA_PURPOSE = "media";

    private final SecretKey key;
    private final long expirationMillis;
    private final long mediaTokenExpirationMillis;

    public JwtService(@Value("${jwt.secret}") String secret, @Value("${jwt.expiration}") long expirationMillis,
            @Value("${app.media-token.expiration}") long mediaTokenExpirationMillis) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes());
        this.expirationMillis = expirationMillis;
        this.mediaTokenExpirationMillis = mediaTokenExpirationMillis;
    }

    public String generateToken(AppUserDetails userDetails) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationMillis);
        String role = userDetails.getAuthorities().iterator().next().getAuthority();

        return Jwts.builder()
                .subject(userDetails.getUsername())
                .claims(Map.of("role", role, "tv", userDetails.getTokenVersion()))
                .issuedAt(now)
                .expiration(expiry)
                .signWith(key)
                .compact();
    }

    /**
     * A short-lived token good only for streaming/cover endpoints — carries a {@code purpose} claim so it
     * can't be replayed as a normal session token even if it leaks (e.g. via browser history, since it's
     * meant to be passed as a URL query param by {@code <audio>}/{@code <img>} tags that can't set headers).
     */
    public MediaToken generateMediaToken(AppUserDetails userDetails) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + mediaTokenExpirationMillis);

        String token = Jwts.builder()
                .subject(userDetails.getUsername())
                .claims(Map.of("tv", userDetails.getTokenVersion(), PURPOSE_CLAIM, MEDIA_PURPOSE))
                .issuedAt(now)
                .expiration(expiry)
                .signWith(key)
                .compact();

        return new MediaToken(token, expiry.toInstant());
    }

    public String extractUsername(String token) {
        return parseClaims(token).getSubject();
    }

    public boolean isTokenValid(String token, AppUserDetails userDetails) {
        Claims claims = parseClaims(token);
        String username = claims.getSubject();
        int tokenVersion = claims.get("tv", Integer.class);

        return username.equals(userDetails.getUsername())
                && tokenVersion == userDetails.getTokenVersion()
                && !claims.getExpiration().before(new Date());
    }

    /** Like {@link #isTokenValid}, but additionally requires the token to be a media token (see above). */
    public boolean isMediaTokenValid(String token, AppUserDetails userDetails) {
        Claims claims = parseClaims(token);
        return MEDIA_PURPOSE.equals(claims.get(PURPOSE_CLAIM, String.class)) && isTokenValid(token, userDetails);
    }

    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
