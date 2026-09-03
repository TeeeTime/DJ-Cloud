package de.djcloud.backend.config;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import de.djcloud.backend.auth.JwtAuthFilter;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    @Value("${app.cors.allowed-origin}")
    private String allowedOrigin;

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(ex -> ex.authenticationEntryPoint(
                        (request, response, authException) -> response.sendError(HttpServletResponse.SC_UNAUTHORIZED)))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/error").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/login", "/api/auth/register").permitAll()
                        .requestMatchers(HttpMethod.GET, "/actuator/health", "/actuator/info").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/tracks/recent").authenticated()
                        // Downloading actual audio bytes is more sensitive than browsing metadata,
                        // so these two are carved out of the broader permitAll rule below.
                        .requestMatchers(HttpMethod.GET, "/api/tracks/*/download").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/genres/*/download").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/tracks/**", "/api/artists/**", "/api/genres/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/registration-codes").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/tracks/**", "/api/artists/**", "/api/genres/**").hasAnyRole("EDITOR", "ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/tracks/**", "/api/artists/**", "/api/genres/**").hasAnyRole("EDITOR", "ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/tracks/**", "/api/artists/**", "/api/genres/**").hasAnyRole("EDITOR", "ADMIN")
                        // Subscribing is open to any authenticated role, so these more specific
                        // matchers must be evaluated before the coarser EDITOR/ADMIN-only ones below.
                        .requestMatchers(HttpMethod.POST, "/api/playlists/*/subscription").authenticated()
                        .requestMatchers(HttpMethod.DELETE, "/api/playlists/*/subscription").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/playlists/**").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/playlists/**").hasAnyRole("EDITOR", "ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/playlists/**").hasAnyRole("EDITOR", "ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/playlists/**").hasAnyRole("EDITOR", "ADMIN")
                        .anyRequest().authenticated())
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of(allowedOrigin));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        // Download endpoints put the server-generated, sanitized filename in this header — without
        // exposing it, browser JS can't read it cross-origin and a fetch-based download would fall
        // back to a client-guessed name instead of the one the backend computed.
        configuration.setExposedHeaders(List.of("Content-Disposition"));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }
}
