package com.pmboard.service;

import com.pmboard.domain.*;
import com.pmboard.repo.ChangeLogRepository;
import com.pmboard.repo.OpsTaskRepository;
import com.pmboard.repo.TaskRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * 보고서에 들어갈 재료를 모은다. 섹션 이름(키)은 화면의 "포함할 내용"과 같다:
 * done(한 일), doing(진행 중), ops(운영업무), changes(변경 사항), blocked(이슈·막힌 일), next(다음 할 일)
 */
@Component
@Transactional(readOnly = true)
public class ReportDataCollector {
    public static final List<String> SECTIONS = List.of("done", "doing", "ops", "changes", "blocked", "next");
    private static final ZoneId ZONE = ZoneId.of("Asia/Seoul");
    private static final Map<String, String> FIELD_NAMES = Map.of(
            "status", "상태", "dueDate", "마감일", "startDate", "시작일", "assignee", "담당자",
            "priority", "우선순위", "title", "제목", "endDate", "종료일", "owner", "책임자", "done", "완료");

    private final TaskRepository tasks;
    private final OpsTaskRepository ops;
    private final ChangeLogRepository changes;

    public ReportDataCollector(TaskRepository tasks, OpsTaskRepository ops, ChangeLogRepository changes) {
        this.tasks = tasks;
        this.ops = ops;
        this.changes = changes;
    }

    /** 섹션 키 → 줄 목록 (순서 유지) */
    public Map<String, List<String>> collect(Long userId, ReportType type, LocalDate start, LocalDate end) {
        Map<String, List<String>> out = new LinkedHashMap<>();
        SECTIONS.forEach(s -> out.put(s, new ArrayList<>()));
        var from = start.atStartOfDay(ZONE).toInstant();
        var to = end.plusDays(1).atStartOfDay(ZONE).toInstant();

        for (Task t : tasks.findByAssigneeIdAndDoneAtBetween(userId, from, to)) {
            out.get("done").add(tag(t) + t.getTitle());
        }
        for (Task t : tasks.findByAssigneeIdAndStatusIn(userId, EnumSet.of(TaskStatus.IN_PROGRESS))) {
            out.get("doing").add(tag(t) + t.getTitle() + note(t.getSummary()));
        }
        for (OpsTask o : ops.findByAssigneeIdAndWorkDateBetween(userId, start, end)) {
            String state = o.getStatus() == OpsStatus.DONE ? "완료" : "진행 중";
            String spent = o.getSpentMinutes() == null ? "" : ", " + o.getSpentMinutes() + "분";
            out.get("ops").add("[" + category(o.getCategory()) + "] " + o.getTitle() + " (" + state + spent + ")");
        }
        for (ChangeLog c : changes.findByChangedByIdAndChangedAtBetweenOrderByChangedAt(userId, from, to)) {
            if (c.getKind() == ChangeKind.CREATE || c.getKind() == ChangeKind.CONTENT) continue;
            out.get("changes").add("\"" + c.getEntityLabel() + "\" " + FIELD_NAMES.getOrDefault(c.getField(), c.getField())
                    + " " + nvl(c.getOldValue()) + " → " + nvl(c.getNewValue()));
        }
        for (Task t : tasks.findByAssigneeIdAndStatusIn(userId, EnumSet.of(TaskStatus.BLOCKED))) {
            long days = t.getBlockedSince() == null ? 0 : ChronoUnit.DAYS.between(t.getBlockedSince(), end) + 1;
            out.get("blocked").add(tag(t) + t.getTitle() + (days > 0 ? " · " + days + "일째" : "")
                    + note(t.getBlockedReason()));
        }
        LocalDate nextFrom = end.plusDays(1);
        LocalDate nextTo = type == ReportType.DAILY ? end.plusDays(3) : end.plusDays(7);
        for (Task t : tasks.findByAssigneeIdAndStatusNotOrderByDueDateAsc(userId, TaskStatus.DONE)) {
            if (t.getDueDate() != null && !t.getDueDate().isBefore(nextFrom) && !t.getDueDate().isAfter(nextTo)) {
                out.get("next").add(tag(t) + t.getTitle() + " (마감 " + t.getDueDate().getMonthValue() + "."
                        + t.getDueDate().getDayOfMonth() + ")");
            }
        }
        return out;
    }

    public static String sectionTitle(String key, ReportType type) {
        boolean daily = type == ReportType.DAILY;
        return switch (key) {
            case "done" -> daily ? "오늘 한 일" : "금주 완료";
            case "doing" -> "진행 중";
            case "ops" -> "운영업무";
            case "changes" -> "변경 사항";
            case "blocked" -> daily ? "이슈 · 막힌 일" : "이슈 및 요청사항";
            case "next" -> daily ? "내일 할 일" : "차주 계획";
            default -> key;
        };
    }

    private static String tag(Task t) {
        return "[" + t.getProject().getName() + "] ";
    }

    private static String note(String s) {
        return s == null || s.isBlank() ? "" : " — " + s;
    }

    private static String nvl(String s) {
        return s == null ? "없음" : s;
    }

    private static String category(OpsCategory c) {
        return switch (c) {
            case REQUEST -> "요청 처리";
            case INCIDENT -> "장애 대응";
            case ROUTINE -> "정기 작업";
            case SIMPLE -> "단순 업무";
        };
    }
}
