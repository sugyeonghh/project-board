package com.pmboard.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;

@Service
public class JwtService {
    private final SecretKey key;
    private final Duration ttl;

    public JwtService(PmBoardProperties props) {
        if (props.jwtSecret() == null || props.jwtSecret().length() < 32) {
            throw new IllegalStateException("pmboard.jwt-secret은 32자 이상이어야 합니다.");
        }
        this.key = Keys.hmacShaKeyFor(props.jwtSecret().getBytes(StandardCharsets.UTF_8));
        this.ttl = Duration.ofHours(props.jwtExpireHours() <= 0 ? 12 : props.jwtExpireHours());
    }

    public String issue(AuthUser user) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(String.valueOf(user.id()))
                .claim("username", user.username())
                .claim("name", user.displayName())
                .claim("role", user.role())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(ttl)))
                .signWith(key)
                .compact();
    }

    public AuthUser parse(String token) {
        Claims c = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
        return new AuthUser(Long.valueOf(c.getSubject()), c.get("username", String.class),
                c.get("name", String.class), c.get("role", String.class));
    }
}
