package com.pmboard.config;

import com.pmboard.domain.AppUser;
import com.pmboard.domain.Role;
import com.pmboard.repo.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/** 사용자가 한 명도 없으면 관리자 계정을 만든다. */
@Component
public class DataInitializer implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final PmBoardProperties props;

    public DataInitializer(UserRepository users, PasswordEncoder encoder, PmBoardProperties props) {
        this.users = users;
        this.encoder = encoder;
        this.props = props;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (users.count() > 0) return;
        if (props.adminPassword() == null || props.adminPassword().isBlank()) {
            log.warn("사용자가 없습니다. PMBOARD_ADMIN_PASSWORD를 설정하고 다시 실행하면 관리자 계정이 만들어집니다.");
            return;
        }
        AppUser admin = new AppUser();
        admin.setUsername(props.adminUsername());
        admin.setDisplayName("관리자");
        admin.setPasswordHash(encoder.encode(props.adminPassword()));
        admin.setRole(Role.ADMIN);
        users.save(admin);
        log.info("관리자 계정 '{}'을(를) 만들었습니다.", props.adminUsername());
    }
}
