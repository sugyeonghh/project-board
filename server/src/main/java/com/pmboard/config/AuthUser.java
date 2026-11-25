package com.pmboard.config;

/** 로그인한 사용자 정보 (JWT에서 꺼낸 값) */
public record AuthUser(Long id, String username, String displayName, String role) {
    public boolean isAdmin() {
        return "ADMIN".equals(role);
    }
}
