package com.pmboard.web.dto;

import com.pmboard.domain.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

/** API 요청·응답 모델 모음. null 필드는 "바꾸지 않음"을 뜻한다(부분 수정). */
public final class Dtos {
    private Dtos() {}

    // 공통 ------------------------------------------------------------------
    public record UserRef(Long id, String name) {}

    public record UserInfo(Long id, String username, String displayName, String role) {}

    public record LoginRequest(@NotBlank String username, @NotBlank String password) {}

    public record LoginResponse(String token, UserInfo user) {}

    public record CreateUserRequest(@NotBlank String username, @NotBlank String displayName,
                                    @NotBlank String password, Role role) {}

    public record PasswordRequest(@NotBlank String currentPassword, @NotBlank String newPassword) {}

    // 프로젝트 ----------------------------------------------------------------
    public record ProjectSummary(Long id, String name, String description, ProjectStatus status, short priority,
                                 int progress, long doneCount, long totalCount, UserRef owner, int memberCount,
                                 LocalDate startDate, LocalDate endDate, LocalDate closedOn, String nextStep) {}

    public record ProjectDetail(Long id, String name, String description, String goal, String scope,
                                String outOfScope, String doneCriteria, String stakeholders,
                                ProjectStatus status, short priority, UserRef owner, List<UserRef> members,
                                LocalDate startDate, LocalDate endDate, LocalDate closedOn, String jiraKey,
                                int progress, long doneCount, long totalCount) {}

    public record ProjectRequest(String name, String description, String goal, String scope, String outOfScope,
                                 String doneCriteria, String stakeholders, ProjectStatus status, Short priority,
                                 Long ownerId, List<Long> memberIds, LocalDate startDate, LocalDate endDate,
                                 String jiraKey) {}

    public record PriorityRequest(@NotNull Short priority) {}

    public record MilestoneDto(Long id, String name, LocalDate startDate, LocalDate dueDate, boolean done, int sortOrder) {}

    /** dueDate를 보내면 startDate도 함께 반영한다 (startDate가 없으면 하루짜리로 되돌림) */
    public record MilestoneRequest(String name, LocalDate startDate, LocalDate dueDate, Boolean done) {}

    public record DecisionDto(Long id, LocalDate decidedOn, String what, String why, String decidedBy) {}

    public record DecisionRequest(@NotNull LocalDate decidedOn, @NotBlank String what, String why, String decidedBy) {}

    // 할일 -------------------------------------------------------------------
    public record TaskRef(Long id, String title, TaskStatus status) {}

    public record TaskDto(Long id, Long projectId, String projectName, String title, String summary,
                          String description, TaskStatus status, short priority, UserRef assignee,
                          LocalDate startDate, LocalDate dueDate, String blockedReason, LocalDate blockedSince,
                          String jiraKey, Instant doneAt, List<TaskRef> dependsOn) {}

    public record TaskRequest(String title, String summary, String description, TaskStatus status, Short priority,
                              Long assigneeId, LocalDate startDate, LocalDate dueDate, String blockedReason,
                              String jiraKey, List<Long> dependsOnIds) {}

    public record TaskDetail(TaskDto task, List<ChecklistDto> checklist, List<CommentDto> comments,
                             List<AttachmentDto> attachments, List<ChangeDto> history, List<TaskRef> dependents) {}

    public record ChecklistDto(Long id, String text, boolean done, int sortOrder) {}

    public record ChecklistRequest(String text, Boolean done) {}

    public record CommentDto(Long id, UserRef author, String body, Instant createdAt, Instant updatedAt) {}

    public record CommentRequest(@NotBlank String body) {}

    // 노트 · 첨부 · 이력 -------------------------------------------------------
    public record NoteDto(Long id, Long projectId, String title, String body, String tags, UserRef author,
                          Instant updatedAt) {}

    public record NoteRequest(String title, String body, String tags) {}

    public record AttachmentDto(Long id, Long projectId, Long taskId, String taskTitle, String name, long sizeBytes,
                                String contentType, UserRef uploadedBy, Instant createdAt) {}

    public record ChangeDto(Long id, Long projectId, String entityType, Long entityId, String entityLabel,
                            String field, ChangeKind kind, String oldValue, String newValue, UserRef changedBy,
                            Instant changedAt) {}

    // 내 할일 · 운영업무 · 메모 -------------------------------------------------
    /** source: TASK(프로젝트 할일), OPS(운영업무), ROUTINE(정기 작업). group: late, today, week, later */
    public record MyTaskItem(String source, Long id, String title, Long projectId, String projectName,
                             String status, LocalDate dueDate, String group, LocalDate doneOn) {}

    /** description = 요청 내용, resolution = 처리 내역 */
    public record OpsDto(Long id, OpsCategory category, String title, String description, String resolution,
                         String requester, UserRef assignee, OpsStatus status, LocalDate workDate, LocalDate dueDate,
                         Integer spentMinutes, Long convertedProjectId, Instant createdAt, Instant doneAt) {}

    /** null인 항목은 그대로 둔다. clearDueDate=true면 기한을 비운다 */
    public record OpsRequest(OpsCategory category, String title, String description, String resolution,
                             String requester, Long assigneeId, OpsStatus status, LocalDate workDate,
                             LocalDate dueDate, Boolean clearDueDate, Integer spentMinutes) {}

    public record RoutineDto(Long id, String name, RoutineCycle cycle, Short dayOfWeek, Short dayOfMonth,
                             UserRef assignee, LocalDate nextDue, boolean done) {}

    public record RoutineRequest(String name, RoutineCycle cycle, Short dayOfWeek, Short dayOfMonth,
                                 Long assigneeId, Boolean active) {}

    public record MemoDto(Long id, String body, String tag, boolean pinned, Instant createdAt, Instant updatedAt) {}

    public record MemoRequest(String body, String tag, Boolean pinned) {}

    // 대시보드 · 캘린더 · 검색 -------------------------------------------------
    public record BlockedItem(TaskDto task, long days) {}

    public record YearGroup(int year, List<ProjectSummary> projects) {}

    public record DashboardDto(int activeCount, int dueThisWeek, int atRiskCount, int blockedCount,
                               List<ProjectSummary> active, List<TaskDto> dueTasks, List<BlockedItem> blocked,
                               List<YearGroup> closedByYear) {}

    /** type: TASK, MILESTONE, OPS */
    /** endDate가 있으면 date~endDate 기간 일정, 없으면 date 하루 일정 */
    public record CalendarEvent(String type, Long id, String title, LocalDate date, LocalDate endDate, Long projectId,
                                String projectName) {}

    /** type: PROJECT, TASK, NOTE, ATTACHMENT, COMMENT, MEMO, OPS, CHANGE */
    public record SearchResult(String type, Long id, String title, String context, Long projectId) {}

    // 보고서 · 설정 -----------------------------------------------------------
    public record ReportDto(Long id, ReportType type, LocalDate periodStart, LocalDate periodEnd, String title,
                            String content, ReportMethod method, ReportStatus status, Instant createdAt,
                            Instant updatedAt) {}

    /** include: done, doing, ops, changes, blocked, next (비우면 전부) */
    public record GenerateReportRequest(@NotNull ReportType type, LocalDate date, boolean useAi,
                                        Set<String> include) {}

    public record ReportUpdateRequest(String content, ReportStatus status) {}

    public record AiSettingsDto(String provider, String model, boolean hasKey, boolean secretKeyReady) {}

    /** apiKey가 null이면 기존 키 유지, clearKey=true면 삭제 */
    public record AiSettingsRequest(String provider, String model, String apiKey, boolean clearKey) {}

    public record ReportSettingsDto(String dailyTime, int weeklyDay, String weeklyTime, String style,
                                    String after, String guide) {}

    public record AiTestResult(boolean ok, String message) {}
}
