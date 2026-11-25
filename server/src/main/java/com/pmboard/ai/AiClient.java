package com.pmboard.ai;

/** AI 제공사 공통 인터페이스. 새 제공사는 이 인터페이스를 구현하고 AiClientFactory에 등록한다. */
public interface AiClient {
    /** 제공사 이름 (설정의 ai.provider 값과 같음) */
    String provider();

    /** 시스템 지침과 사용자 입력을 보내고 답변 텍스트를 받는다. */
    String complete(String apiKey, String model, String system, String user);
}
