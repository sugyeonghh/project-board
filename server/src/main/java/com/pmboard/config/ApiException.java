package com.pmboard.config;

public class ApiException extends RuntimeException {
    private final int status;

    public ApiException(int status, String message) {
        super(message);
        this.status = status;
    }

    public int getStatus() {
        return status;
    }

    public static ApiException notFound(String what) {
        return new ApiException(404, what + "을(를) 찾을 수 없습니다.");
    }

    public static ApiException badRequest(String message) {
        return new ApiException(400, message);
    }
}
