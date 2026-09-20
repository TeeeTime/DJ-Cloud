package de.djcloud.backend.config;

import java.time.Instant;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;

/**
 * Fixed-window per-IP rate limiter for the endpoints that must stay unauthenticated
 * (POST /api/auth/login, /api/auth/register) — everything else is already gated by JwtAuthFilter, but
 * these are open to credential-stuffing/brute-force otherwise. In-memory is sufficient since this is a
 * single-instance deployment (see the SQLite datasource / hikari.maximum-pool-size: 1 config).
 */
@Component
public class RateLimitingFilter extends OncePerRequestFilter {

    private static final Set<String> LIMITED_PATHS = Set.of("/api/auth/login", "/api/auth/register");

    private final int maxAttempts;
    private final long windowMillis;
    private final ConcurrentHashMap<String, Window> windowsByIp = new ConcurrentHashMap<>();

    public RateLimitingFilter(@Value("${app.rate-limit.auth.max-attempts}") int maxAttempts,
            @Value("${app.rate-limit.auth.window-seconds}") long windowSeconds) {
        this.maxAttempts = maxAttempts;
        this.windowMillis = windowSeconds * 1000;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if (!HttpMethod.POST.matches(request.getMethod()) || !LIMITED_PATHS.contains(request.getRequestURI())) {
            filterChain.doFilter(request, response);
            return;
        }

        if (isOverLimit(request.getRemoteAddr())) {
            response.sendError(HttpStatus.TOO_MANY_REQUESTS.value(), "Too many attempts — try again later");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private boolean isOverLimit(String clientIp) {
        long now = Instant.now().toEpochMilli();

        Window window = windowsByIp.compute(clientIp, (ip, existing) -> {
            if (existing == null || now - existing.windowStartMillis >= windowMillis) {
                return new Window(now);
            }
            return existing;
        });

        return window.count.incrementAndGet() > maxAttempts;
    }

    private static final class Window {
        private final long windowStartMillis;
        private final AtomicInteger count = new AtomicInteger(0);

        private Window(long windowStartMillis) {
            this.windowStartMillis = windowStartMillis;
        }
    }
}
