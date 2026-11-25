package com.pmboard.service;

import com.pmboard.ai.AiService;
import com.pmboard.config.ApiException;
import com.pmboard.domain.*;
import com.pmboard.repo.ReportRepository;
import com.pmboard.repo.UserRepository;
import com.pmboard.web.dto.Dtos.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.TextStyle;
import java.util.*;

/**
 * 일일 업무 일지 / 주간보고 작성.
 * 1) ReportDataCollector가 할일·운영업무·변경 이력에서 재료를 모으고
 * 2) BASIC: 양식에 맞춰 그대로 정리 / AI: 재료 + 팀 작성 지침을 AI에 보내 다듬는다.
 * 같은 사람·종류·기간의 보고서는 하나만 두고 다시 만들면 덮어쓴다(게시된 것은 덮어쓰지 않음).
 */
@Service
@Transactional
public class ReportService {
    private final ReportRepository reports;
    private final ReportDataCollector collector;
    private final AiService ai;
    private final SettingsService settings;
    private final UserRepository users;

    public ReportService(ReportRepository reports, ReportDataCollector collector, AiService ai,
                         SettingsService settings, UserRepository users) {
        this.reports = reports;
        this.collector = collector;
        this.ai = ai;
        this.settings = settings;
        this.users = users;
    }

    public ReportDto generate(Long userId, GenerateReportRequest req) {
        LocalDate date = req.date() != null ? req.date() : LocalDate.now();
        LocalDate start = req.type() == ReportType.DAILY ? date : date.with(DayOfWeek.MONDAY);
        LocalDate end = req.type() == ReportType.DAILY ? date : start.plusDays(4);
        Set<String> include = req.include() == null || req.include().isEmpty()
                ? new HashSet<>(ReportDataCollector.SECTIONS) : req.include();

        Map<String, List<String>> data = collector.collect(userId, req.type(), start, end);
        data.keySet().retainAll(include);

        String author = users.findById(userId).map(AppUser::getDisplayName).orElse("");
        String title = title(req.type(), start, end);
        String basic = basic(title, author, req.type(), data);

        boolean useAi = req.useAi() && ai.isConfigured();
        String content = useAi ? withAi(basic) : basic;

        Report r = reports.findByOwnerIdAndTypeAndPeriodStart(userId, req.type(), start).orElseGet(Report::new);
        if (r.getId() != null && r.getStatus() == ReportStatus.PUBLISHED) {
            throw new ApiException(409, "이미 게시된 보고서입니다. 수정은 보고서 편집에서 해 주세요.");
        }
        r.setOwnerId(userId);
        r.setType(req.type());
        r.setPeriodStart(start);
        r.setPeriodEnd(end);
        r.setTitle(title);
        r.setContent(content);
        r.setMethod(useAi ? ReportMethod.AI : ReportMethod.BASIC);
        if ("PUBLISH".equals(settings.get("report.after", "DRAFT"))) r.setStatus(ReportStatus.PUBLISHED);
        return Mappers.report(reports.save(r));
    }

    @Transactional(readOnly = true)
    public List<ReportDto> month(Long userId, YearMonth ym) {
        return reports.findByOwnerIdAndPeriodStartBetweenOrderByPeriodStartDesc(userId, ym.atDay(1), ym.atEndOfMonth())
                .stream().map(Mappers::report).toList();
    }

    @Transactional(readOnly = true)
    public ReportDto get(Long userId, Long id) {
        return Mappers.report(own(userId, id));
    }

    public ReportDto update(Long userId, Long id, ReportUpdateRequest req) {
        Report r = own(userId, id);
        if (req.content() != null) r.setContent(req.content());
        if (req.status() != null) r.setStatus(req.status());
        return Mappers.report(r);
    }

    private Report own(Long userId, Long id) {
        Report r = reports.findById(id).orElseThrow(() -> ApiException.notFound("보고서"));
        if (!r.getOwnerId().equals(userId)) throw new ApiException(403, "본인 보고서만 볼 수 있습니다.");
        return r;
    }

    // 작성 ---------------------------------------------------------------------
    private static String title(ReportType type, LocalDate start, LocalDate end) {
        if (type == ReportType.DAILY) {
            return String.format("일일 업무 일지 · %d.%02d.%02d (%s)", start.getYear(), start.getMonthValue(),
                    start.getDayOfMonth(), start.getDayOfWeek().getDisplayName(TextStyle.SHORT, Locale.KOREAN));
        }
        int week = (start.getDayOfMonth() - 1) / 7 + 1;
        return String.format("주간보고 · %d월 %d주차 (%d.%02d – %d.%02d)", start.getMonthValue(), week,
                start.getMonthValue(), start.getDayOfMonth(), end.getMonthValue(), end.getDayOfMonth());
    }

    private static String basic(String title, String author, ReportType type, Map<String, List<String>> data) {
        StringBuilder sb = new StringBuilder("# ").append(title).append("\n\n작성: ").append(author).append("\n");
        data.forEach((key, lines) -> {
            sb.append("\n## ").append(ReportDataCollector.sectionTitle(key, type)).append("\n");
            if (lines.isEmpty()) sb.append("- 없음\n");
            lines.forEach(l -> sb.append("- ").append(l).append("\n"));
        });
        return sb.toString();
    }

    private String withAi(String basic) {
        String style = "POLITE".equals(settings.get("report.style", "BULLET"))
                ? "존댓말 문장형(~했습니다)으로 쓴다." : "개조식(~함, ~예정)으로 쓴다.";
        String system = """
                너는 금융IT팀 업무 보고서를 정리하는 도우미다.
                아래 재료에 있는 사실만 사용하고, 없는 내용을 지어내지 않는다.
                Markdown 형식을 유지하고 제목(#)과 섹션(##) 구조는 그대로 둔다.
                %s
                팀 작성 지침:
                %s
                """.formatted(style, settings.get("report.guide", ""));
        return ai.complete(system, "다음 재료로 보고서를 다듬어 줘.\n\n" + basic);
    }
}
