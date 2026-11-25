package com.pmboard.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "app_setting")
@Getter @Setter @NoArgsConstructor
public class AppSetting {
    @Id
    @Column(name = "setting_key")
    private String key;
    @Column(name = "setting_value")
    private String value;
    private boolean encrypted;
    private Instant updatedAt = Instant.now();

    public AppSetting(String key, String value, boolean encrypted) {
        this.key = key;
        this.value = value;
        this.encrypted = encrypted;
    }
}
