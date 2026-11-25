package com.pmboard.ai;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

/** OpenAI Chat Completions API. 모델 이름은 설정에서 반드시 지정한다. */
@Component
public class OpenAiClient implements AiClient {
    private final RestClient http = RestClient.builder().baseUrl("https://api.openai.com").build();

    @Override
    public String provider() {
        return "OPENAI";
    }

    @Override
    public String complete(String apiKey, String model, String system, String user) {
        if (model == null || model.isBlank()) {
            throw new IllegalStateException("OpenAI는 설정에서 모델 이름을 지정해야 합니다.");
        }
        Map<String, Object> body = Map.of(
                "model", model,
                "messages", List.of(Map.of("role", "system", "content", system),
                        Map.of("role", "user", "content", user)));
        JsonNode res = http.post().uri("/v1/chat/completions")
                .header("Authorization", "Bearer " + apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(JsonNode.class);
        return res == null ? "" : res.path("choices").path(0).path("message").path("content").asText("").trim();
    }
}
