package com.pmboard.service;

import com.pmboard.config.AuthUser;
import com.pmboard.domain.AppUser;
import com.pmboard.domain.ReportType;
import com.pmboard.repo.UserRepository;
import com.pmboard.web.dto.Dtos.GenerateReportRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * 설정한 시각에 모든 사용자의 일일 일지/주간보고 초안을 만든다.
 * 1분마다 설정 시각과 비교한다 (설정 화면에서 시각을 바꾸면 재시작 없이 바로 반영).
 */
@Component
public class ReportScheduler {
    private static final Logger log = LoggerFactory.getLogger(ReportScheduler.class);
    private static final ZoneId ZONE = ZoneId.of("Asia/Seoul");
    private static final DateTimeFormatter HM = DateTimeFormatter.ofPattern("HH:mm");

    private final SettingsService settings;
    private final ReportService reports;
    private final UserRepository users;

    public ReportScheduler(SettingsService settings, ReportService reports, UserRepository users) {
        this.settings = settings;
        this.reports = reports;
        this.users = users;
    }

    @Scheduled(cron = "0 * * * * *", zone = "Asia/Seoul")
    public void tick() {
        LocalDate today = LocalDate.now(ZONE);
        String now = LocalTime.now(ZONE).format(HM);
        boolean weekday = today.getDayOfWeek().getValue() <= 5;
        if (weekday && now.equals(settings.get("report.daily.time", "18:00"))) {
            runAll(ReportType.DAILY, today);
        }
        int weeklyDay = Integer.parseInt(settings.get("report.weekly.day", "5"));
        if (today.getDayOfWeek().getValue() == weeklyDay && now.equals(settings.get("report.weekly.time", "16:00"))) {
            runAll(ReportType.WEEKLY, weeklyDay == 1 ? today.minusWeeks(1) : today);
        }
    }

    private void runAll(ReportType type, LocalDate date) {
        List<AppUser> active = users.findByActiveTrueOrderByDisplayName();
        for (AppUser u : active) {
            try {
                // 변경 이력 기록 등에서 현재 사용자가 필요하므로 그 사용자로 실행
                var principal = new AuthUser(u.getId(), u.getUsername(), u.getDisplayName(), u.getRole().name());
                SecurityContextHolder.getContext().setAuthentication(
                        new UsernamePasswordAuthenticationToken(principal, null, List.of()));
                try {
                    reports.generate(u.getId(), new GenerateReportRequest(type, date, true, null));
                } catch (com.pmboard.config.ApiException e) {
                    if (e.getStatus() != 502) throw e;
                    // AI 호출이 실패하면 기본 초안이라도 만들어 둔다
                    reports.generate(u.getId(), new GenerateReportRequest(type, date, false, null));
                }
            } catch (Exception e) {
                log.warn("{} 보고서 자동 생성 실패 ({}): {}", type, u.getUsername(), e.getMessage());
            } finally {
                SecurityContextHolder.clearContext();
            }
        }
        log.info("{} 보고서 자동 생성 완료: {}명", type, active.size());
    }
}
