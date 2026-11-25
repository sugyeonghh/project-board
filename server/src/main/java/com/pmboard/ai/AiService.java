package com.pmboard.ai;

import com.pmboard.config.ApiException;
import com.pmboard.service.SettingsService;
import org.springframework.stereotype.Service;

import java.util.List;

/** 설정에 저장된 제공사·모델·키로 AI를 호출한다. */
@Service
public class AiService {
    private final List<AiClient> clients;
    private final SettingsService settings;

    public AiService(List<AiClient> clients, SettingsService settings) {
        this.clients = clients;
        this.settings = settings;
    }

    public boolean isConfigured() {
        return settings.aiKey().isPresent();
    }

    public String complete(String system, String user) {
        String key = settings.aiKey().orElseThrow(() -> new ApiException(400, "AI가 연결되지 않았습니다. 설정에서 API 키를 등록해 주세요."));
        String provider = settings.get(SettingsService.AI_PROVIDER, "CLAUDE");
        AiClient client = clients.stream().filter(c -> c.provider().equalsIgnoreCase(provider)).findFirst()
                .orElseThrow(() -> new ApiException(400, "지원하지 않는 AI 제공사입니다: " + provider));
        try {
            return client.complete(key, settings.get(SettingsService.AI_MODEL, ""), system, user);
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw new ApiException(502, "AI 호출에 실패했습니다: " + e.getMessage());
        }
    }
}
