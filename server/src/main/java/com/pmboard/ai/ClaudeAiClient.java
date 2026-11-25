package com.pmboard.ai;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

/** Anthropic Messages API (https://docs.claude.com) */
@Component
public class ClaudeAiClient implements AiClient {
    /** 설정에서 모델을 비워 두면 쓰는 기본값. 최신 모델 이름은 Anthropic 문서에서 확인해 바꾼다. */
    public static final String DEFAULT_MODEL = "claude-sonnet-5-5";

    private final RestClient http = RestClient.builder().baseUrl("https://api.anthropic.com").build();

    @Override
    public String provider() {
        return "CLAUDE";
    }

    @Override
    public String complete(String apiKey, String model, String system, String user) {
        Map<String, Object> body = Map.of(
                "model", model == null || model.isBlank() ? DEFAULT_MODEL : model,
                "max_tokens", 2000,
                "system", system,
                "messages", List.of(Map.of("role", "user", "content", user)));
        JsonNode res = http.post().uri("/v1/messages")
                .header("x-api-key", apiKey)
                .header("anthropic-version", "2023-06-01")
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(JsonNode.class);
        StringBuilder out = new StringBuilder();
        if (res != null) {
            for (JsonNode block : res.path("content")) {
                if ("text".equals(block.path("type").asText())) out.append(block.path("text").asText());
            }
        }
        return out.toString().trim();
    }
}
