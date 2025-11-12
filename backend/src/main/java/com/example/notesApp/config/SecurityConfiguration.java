package com.example.notesApp.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfiguration {

    private final JwtAuthenticationFilter jwtAuthFilter;
    private final AuthenticationProvider authenticationProvider;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(authorize -> authorize.requestMatchers("/api/v1/auth/*")
                        .permitAll()
                        .requestMatchers("/swagger-ui/**").permitAll()
                        .requestMatchers("/v3/api-docs/**").permitAll()
                        .requestMatchers("/swagger-ui.html").permitAll()
                        .requestMatchers("/swagger-ui/*").permitAll()
                        .requestMatchers("/swagger-resources/**").permitAll()
                        .requestMatchers("/api/v1/user/*").hasAuthority("ADMIN")
                        .requestMatchers("/api/v1/review/getReviews", "/api/v1/review/getReviewById/*").hasAuthority("ADMIN")
                        .requestMatchers("/api/v1/reservation/getReservations", "/api/v1/reservation/updateReservation", "/api/v1/reservation/deleteReservation/*").hasAuthority("ADMIN")
                        .requestMatchers("/api/v1/book/getBookById/*", "/api/v1/book/saveBook", "/api/v1/book/updateBook", "/api/v1/book/deleteBook/*").hasAuthority("ADMIN")
                        .requestMatchers("/api/v1/author/saveAuthor", "/api/v1/author/updateAuthor", "/api/v1/author/deleteAuthor/*").hasAuthority("ADMIN")
                        .anyRequest()
                        .authenticated())
                .sessionManagement(sess -> sess.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authenticationProvider(authenticationProvider)
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

}

