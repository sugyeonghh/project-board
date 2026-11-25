package com.pmboard.web;

import com.pmboard.config.ApiException;
import com.pmboard.config.AuthUser;
import com.pmboard.config.CurrentUser;
import com.pmboard.config.JwtService;
import com.pmboard.domain.AppUser;
import com.pmboard.domain.Role;
import com.pmboard.repo.UserRepository;
import com.pmboard.service.Mappers;
import com.pmboard.web.dto.Dtos.*;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class AuthController {
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final JwtService jwt;

    public AuthController(UserRepository users, PasswordEncoder encoder, JwtService jwt) {
        this.users = users;
        this.encoder = encoder;
        this.jwt = jwt;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }

    @PostMapping("/auth/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest req) {
        AppUser u = users.findByUsername(req.username())
                .filter(AppUser::isActive)
                .filter(x -> encoder.matches(req.password(), x.getPasswordHash()))
                .orElseThrow(() -> new ApiException(401, "아이디 또는 비밀번호가 맞지 않습니다."));
        AuthUser au = new AuthUser(u.getId(), u.getUsername(), u.getDisplayName(), u.getRole().name());
        return new LoginResponse(jwt.issue(au), info(u));
    }

    @GetMapping("/me")
    public UserInfo me() {
        return users.findById(CurrentUser.id()).map(AuthController::info)
                .orElseThrow(() -> new ApiException(401, "사용자를 찾을 수 없습니다."));
    }

    @PutMapping("/me/password")
    @Transactional
    public void changePassword(@Valid @RequestBody PasswordRequest req) {
        AppUser u = users.findById(CurrentUser.id()).orElseThrow();
        if (!encoder.matches(req.currentPassword(), u.getPasswordHash())) {
            throw ApiException.badRequest("현재 비밀번호가 맞지 않습니다.");
        }
        u.setPasswordHash(encoder.encode(req.newPassword()));
    }

    /** 담당자 선택 목록 */
    @GetMapping("/users")
    public List<UserRef> list() {
        return users.findByActiveTrueOrderByDisplayName().stream().map(Mappers::user).toList();
    }

    @PostMapping("/users")
    @PreAuthorize("hasRole('ADMIN')")
    public UserInfo create(@Valid @RequestBody CreateUserRequest req) {
        if (users.findByUsername(req.username()).isPresent()) throw ApiException.badRequest("이미 있는 아이디입니다.");
        AppUser u = new AppUser();
        u.setUsername(req.username());
        u.setDisplayName(req.displayName());
        u.setPasswordHash(encoder.encode(req.password()));
        u.setRole(req.role() == null ? Role.USER : req.role());
        return info(users.save(u));
    }

    private static UserInfo info(AppUser u) {
        return new UserInfo(u.getId(), u.getUsername(), u.getDisplayName(), u.getRole().name());
    }
}
