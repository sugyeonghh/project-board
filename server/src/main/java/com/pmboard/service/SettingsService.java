package com.pmboard.service;

import com.pmboard.config.ApiException;
import com.pmboard.config.CryptoService;
import com.pmboard.domain.AppSetting;
import com.pmboard.repo.AppSettingRepository;
import com.pmboard.web.dto.Dtos.AiSettingsDto;
import com.pmboard.web.dto.Dtos.AiSettingsRequest;
import com.pmboard.web.dto.Dtos.ReportSettingsDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

@Service
@Transactional
public class SettingsService {
    public static final String AI_PROVIDER = "ai.provider";
    public static final String AI_MODEL = "ai.model";
    public static final String AI_KEY = "ai.api_key";

    private final AppSettingRepository repo;
    private final CryptoService crypto;

    public SettingsService(AppSettingRepository repo, CryptoService crypto) {
        this.repo = repo;
        this.crypto = crypto;
    }

    @Transactional(readOnly = true)
    public String get(String key, String fallback) {
        return repo.findById(key).map(s -> s.isEncrypted() ? crypto.decrypt(s.getValue()) : s.getValue())
                .filter(v -> !v.isBlank()).orElse(fallback);
    }

    public void set(String key, String value) {
        AppSetting s = repo.findById(key).orElseGet(() -> new AppSetting(key, null, false));
        s.setValue(value);
        s.setEncrypted(false);
        s.setUpdatedAt(Instant.now());
        repo.save(s);
    }

    public void setSecret(String key, String value) {
        AppSetting s = repo.findById(key).orElseGet(() -> new AppSetting(key, null, true));
        s.setValue(crypto.encrypt(value));
        s.setEncrypted(true);
        s.setUpdatedAt(Instant.now());
        repo.save(s);
    }

    /** AI 키 (복호화된 값). 서버 안에서만 쓰고 API 응답으로 내보내지 않는다. */
    @Transactional(readOnly = true)
    public Optional<String> aiKey() {
        return Optional.ofNullable(get(AI_KEY, null));
    }

    @Transactional(readOnly = true)
    public AiSettingsDto ai() {
        return new AiSettingsDto(get(AI_PROVIDER, "CLAUDE"), get(AI_MODEL, ""), repo.existsById(AI_KEY),
                crypto.isReady());
    }

    public AiSettingsDto saveAi(AiSettingsRequest req) {
        if (req.provider() != null) set(AI_PROVIDER, req.provider());
        if (req.model() != null) set(AI_MODEL, req.model().trim());
        if (req.clearKey()) {
            repo.deleteById(AI_KEY);
        } else if (req.apiKey() != null && !req.apiKey().isBlank()) {
            setSecret(AI_KEY, req.apiKey().trim());
        }
        return ai();
    }

    @Transactional(readOnly = true)
    public ReportSettingsDto report() {
        return new ReportSettingsDto(get("report.daily.time", "18:00"),
                Integer.parseInt(get("report.weekly.day", "5")), get("report.weekly.time", "16:00"),
                get("report.style", "BULLET"), get("report.after", "DRAFT"), get("report.guide", ""));
    }

    public ReportSettingsDto saveReport(ReportSettingsDto d) {
        if (d.weeklyDay() < 1 || d.weeklyDay() > 7) throw ApiException.badRequest("요일은 1(월)~7(일)입니다.");
        set("report.daily.time", d.dailyTime());
        set("report.weekly.day", String.valueOf(d.weeklyDay()));
        set("report.weekly.time", d.weeklyTime());
        set("report.style", d.style());
        set("report.after", d.after());
        set("report.guide", d.guide());
        return report();
    }
}
