package com.pmboard.config;

import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

/** AI API 키처럼 DB에 넣으면 안 되는 값을 AES-GCM으로 암호화한다. */
@Service
public class CryptoService {
    private static final int IV_LEN = 12;
    private final SecretKeySpec key;
    private final SecureRandom random = new SecureRandom();

    public CryptoService(PmBoardProperties props) {
        String b64 = props.secretKey();
        if (b64 == null || b64.isBlank()) {
            this.key = null; // 키가 없으면 민감한 설정 저장을 막는다
        } else {
            byte[] raw = Base64.getDecoder().decode(b64.trim());
            if (raw.length != 32) {
                throw new IllegalStateException("pmboard.secret-key는 Base64로 인코딩한 32바이트여야 합니다.");
            }
            this.key = new SecretKeySpec(raw, "AES");
        }
    }

    public boolean isReady() {
        return key != null;
    }

    public String encrypt(String plain) {
        requireKey();
        try {
            byte[] iv = new byte[IV_LEN];
            random.nextBytes(iv);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
            byte[] enc = c.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(ByteBuffer.allocate(iv.length + enc.length).put(iv).put(enc).array());
        } catch (Exception e) {
            throw new IllegalStateException("암호화 실패", e);
        }
    }

    public String decrypt(String stored) {
        requireKey();
        try {
            byte[] all = Base64.getDecoder().decode(stored);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, all, 0, IV_LEN));
            return new String(c.doFinal(all, IV_LEN, all.length - IV_LEN), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("복호화 실패 (secret-key가 바뀌었을 수 있습니다)", e);
        }
    }

    private void requireKey() {
        if (key == null) {
            throw new ApiException(500, "서버에 PMBOARD_SECRET_KEY가 설정되지 않아 키를 저장할 수 없습니다.");
        }
    }
}
