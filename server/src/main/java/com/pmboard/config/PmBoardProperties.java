package com.pmboard.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

@ConfigurationProperties(prefix = "pmboard")
public record PmBoardProperties(
        String jwtSecret,
        int jwtExpireHours,
        String secretKey,
        String storageDir,
        String adminUsername,
        String adminPassword,
        List<String> corsOrigins
) {
}
