package com.pmboard.web;

import com.pmboard.ai.AiService;
import com.pmboard.config.CurrentUser;
import com.pmboard.service.ReportService;
import com.pmboard.service.SettingsService;
import com.pmboard.web.dto.Dtos.*;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.time.YearMonth;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class ReportController {
    private final ReportService reports;
    private final SettingsService settings;
    private final AiService ai;

    public ReportController(ReportService reports, SettingsService settings, AiService ai) {
        this.reports = reports;
        this.settings = settings;
        this.ai = ai;
    }

    /** 보고서 화면 상단의 "AI 연결됨/미연결" 표시용 (키 값은 내보내지 않음) */
    @GetMapping("/reports/ai-status")
    public Map<String, Object> aiStatus() {
        return Map.of("connected", ai.isConfigured(), "provider", settings.get(SettingsService.AI_PROVIDER, "CLAUDE"));
    }

    @PostMapping("/reports/generate")
    public ReportDto generate(@Valid @RequestBody GenerateReportRequest req) {
        return reports.generate(CurrentUser.id(), req);
    }

    /** 모아보기: 월별 (예: ?month=2026-11) */
    @GetMapping("/reports")
    public List<ReportDto> month(@RequestParam(required = false) String month) {
        return reports.month(CurrentUser.id(), month == null ? YearMonth.now() : YearMonth.parse(month));
    }

    @GetMapping("/reports/{id}")
    public ReportDto get(@PathVariable Long id) {
        return reports.get(CurrentUser.id(), id);
    }

    @PutMapping("/reports/{id}")
    public ReportDto update(@PathVariable Long id, @RequestBody ReportUpdateRequest req) {
        return reports.update(CurrentUser.id(), id, req);
    }

    // 설정 (관리자만: SecurityConfig에서 /api/settings/** 를 ADMIN으로 제한)
    @GetMapping("/settings/ai")
    public AiSettingsDto aiSettings() {
        return settings.ai();
    }

    @PutMapping("/settings/ai")
    public AiSettingsDto saveAi(@RequestBody AiSettingsRequest req) {
        return settings.saveAi(req);
    }

    @PostMapping("/settings/ai/test")
    public AiTestResult testAi() {
        try {
            String answer = ai.complete("짧게 답한다.", "연결 테스트입니다. '확인'이라고만 답해 주세요.");
            return new AiTestResult(true, "연결됨: " + answer);
        } catch (Exception e) {
            return new AiTestResult(false, e.getMessage());
        }
    }

    @GetMapping("/settings/report")
    public ReportSettingsDto reportSettings() {
        return settings.report();
    }

    @PutMapping("/settings/report")
    public ReportSettingsDto saveReport(@RequestBody ReportSettingsDto req) {
        return settings.saveReport(req);
    }
}
