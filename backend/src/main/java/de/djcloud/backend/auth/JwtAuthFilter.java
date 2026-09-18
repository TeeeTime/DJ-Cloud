package de.djcloud.backend.auth;

import java.io.IOException;
import java.util.regex.Pattern;

import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";

    // Matches GET /api/tracks/{id}/audio and /cover — the only endpoints a media token (see JwtService)
    // is accepted for, since <audio>/<img> tags can't set an Authorization header and so must carry
    // auth as a URL query param instead.
    private static final Pattern MEDIA_ENDPOINT_PATTERN = Pattern.compile("^/api/tracks/[^/]+/(audio|cover)$");

    private final JwtService jwtService;
    private final CustomUserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");
        String token;
        boolean requireMediaPurpose;

        if (authHeader != null && authHeader.startsWith(BEARER_PREFIX)) {
            token = authHeader.substring(BEARER_PREFIX.length());
            requireMediaPurpose = false;
        } else if (isMediaEndpoint(request)) {
            token = request.getParameter("token");
            requireMediaPurpose = true;
        } else {
            token = null;
            requireMediaPurpose = false;
        }

        if (token == null) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            String username = jwtService.extractUsername(token);

            if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                AppUserDetails userDetails = userDetailsService.loadUserByUsername(username);
                boolean valid = requireMediaPurpose ? jwtService.isMediaTokenValid(token, userDetails)
                        : jwtService.isTokenValid(token, userDetails);

                if (valid) {
                    UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                            userDetails, null, userDetails.getAuthorities());
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            }
        } catch (JwtException | IllegalArgumentException | UsernameNotFoundException ex) {
            // invalid, expired, or stale token: leave the request unauthenticated and let
            // authorization reject it downstream instead of failing the whole request here
        }

        filterChain.doFilter(request, response);
    }

    private boolean isMediaEndpoint(HttpServletRequest request) {
        return HttpMethod.GET.matches(request.getMethod()) && MEDIA_ENDPOINT_PATTERN.matcher(request.getRequestURI()).matches();
    }
}
