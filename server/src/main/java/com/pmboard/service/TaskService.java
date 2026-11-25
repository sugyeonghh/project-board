package com.pmboard.service;

import com.pmboard.config.ApiException;
import com.pmboard.config.CurrentUser;
import com.pmboard.domain.*;
import com.pmboard.repo.*;
import com.pmboard.web.dto.Dtos.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.List;

@Service
@Transactional
public class TaskService {
    private final TaskRepository tasks;
    private final ProjectService projectService;
    private final ChecklistItemRepository checklist;
    private final TaskCommentRepository comments;
    private final AttachmentRepository attachments;
    private final ChangeLogRepository changes;
    private final UserRepository users;
    private final ChangeLogService log;

    public TaskService(TaskRepository tasks, ProjectService projectService, ChecklistItemRepository checklist,
                       TaskCommentRepository comments, AttachmentRepository attachments,
                       ChangeLogRepository changes, UserRepository users, ChangeLogService log) {
        this.tasks = tasks;
        this.projectService = projectService;
        this.checklist = checklist;
        this.comments = comments;
        this.attachments = attachments;
        this.changes = changes;
        this.users = users;
        this.log = log;
    }

    @Transactional(readOnly = true)
    public List<TaskDto> byProject(Long projectId) {
        return tasks.findByProjectIdOrderByDueDateAscIdAsc(projectId).stream().map(Mappers::task).toList();
    }

    @Transactional(readOnly = true)
    public TaskDetail detail(Long id) {
        Task t = find(id);
        List<TaskRef> dependents = tasks.findByProjectIdOrderByDueDateAscIdAsc(t.getProject().getId()).stream()
                .filter(o -> o.getDependsOn().stream().anyMatch(d -> d.getId().equals(id)))
                .map(Mappers::taskRef).toList();
        return new TaskDetail(Mappers.task(t),
                checklist.findByTaskIdOrderBySortOrderAscIdAsc(id).stream().map(Mappers::checklist).toList(),
                comments.findByTaskIdOrderByCreatedAtDesc(id).stream().map(Mappers::comment).toList(),
                attachments.findByTaskIdOrderByCreatedAtDesc(id).stream().map(Mappers::attachment).toList(),
                changes.findByEntityTypeAndEntityIdOrderByChangedAtDesc("TASK", id).stream().map(Mappers::change).toList(),
                dependents);
    }

    public TaskDto create(Long projectId, TaskRequest req) {
        if (req.title() == null || req.title().isBlank()) throw ApiException.badRequest("할일 제목을 입력해 주세요.");
        Task t = new Task();
        t.setProject(projectService.editable(projectId));
        t.setCreatedBy(users.getReferenceById(CurrentUser.id()));
        apply(t, req);
        tasks.save(t);
        log.on(projectId, "TASK", t.getId(), t.getTitle()).created();
        return Mappers.task(t);
    }

    public TaskDto update(Long id, TaskRequest req) {
        Task t = find(id);
        Long projectId = t.getProject().getId();
        projectService.editable(projectId);
        var rec = log.on(projectId, "TASK", id, t.getTitle());
        TaskStatus beforeStatus = t.getStatus();
        String beforeAssignee = name(t.getAssignee());
        LocalDate beforeDue = t.getDueDate();
        LocalDate beforeStart = t.getStartDate();
        String beforeTitle = t.getTitle();
        short beforePriority = t.getPriority();

        apply(t, req);

        rec.diff("title", ChangeKind.CONTENT, beforeTitle, t.getTitle());
        rec.diff("status", ChangeKind.STATUS, beforeStatus, t.getStatus());
        rec.diff("assignee", ChangeKind.ASSIGNEE, beforeAssignee, name(t.getAssignee()));
        rec.diff("dueDate", ChangeKind.SCHEDULE, beforeDue, t.getDueDate());
        rec.diff("startDate", ChangeKind.SCHEDULE, beforeStart, t.getStartDate());
        rec.diff("priority", ChangeKind.CONTENT, beforePriority, t.getPriority());

        if (beforeStatus != t.getStatus()) {
            t.setDoneAt(t.getStatus() == TaskStatus.DONE ? Instant.now() : null);
            t.setBlockedSince(t.getStatus() == TaskStatus.BLOCKED ? LocalDate.now() : null);
        }
        return Mappers.task(t);
    }

    public void delete(Long id) {
        Task t = find(id);
        projectService.editable(t.getProject().getId());
        tasks.delete(t);
    }

    private void apply(Task t, TaskRequest r) {
        if (r.title() != null) t.setTitle(r.title());
        if (r.summary() != null) t.setSummary(r.summary());
        if (r.description() != null) t.setDescription(r.description());
        if (r.status() != null) t.setStatus(r.status());
        if (r.priority() != null) t.setPriority(r.priority());
        if (r.assigneeId() != null) {
            if (r.assigneeId() == 0) {
                t.setAssignee(null);
            } else {
                AppUser u = users.findById(r.assigneeId()).orElseThrow(() -> ApiException.notFound("사용자"));
                boolean same = t.getAssignee() != null && t.getAssignee().getId().equals(u.getId());
                if (!same && !ProjectService.isParticipant(t.getProject(), u.getId()))
                    throw ApiException.badRequest("담당자는 이 프로젝트의 참여자만 지정할 수 있습니다.");
                t.setAssignee(u);
            }
        }
        if (r.startDate() != null) t.setStartDate(r.startDate());
        if (r.dueDate() != null) t.setDueDate(r.dueDate());
        if (r.blockedReason() != null) t.setBlockedReason(r.blockedReason());
        if (r.jiraKey() != null) t.setJiraKey(r.jiraKey().isBlank() ? null : r.jiraKey());
        if (r.dependsOnIds() != null) t.setDependsOn(new LinkedHashSet<>(tasks.findAllById(r.dependsOnIds())));
    }

    // 체크리스트 · 코멘트 ---------------------------------------------------------
    public ChecklistDto addChecklist(Long taskId, ChecklistRequest req) {
        projectService.editable(find(taskId).getProject().getId());
        ChecklistItem c = new ChecklistItem();
        c.setTaskId(taskId);
        c.setText(req.text());
        c.setSortOrder(checklist.findByTaskIdOrderBySortOrderAscIdAsc(taskId).size());
        return Mappers.checklist(checklist.save(c));
    }

    public ChecklistDto updateChecklist(Long id, ChecklistRequest req) {
        ChecklistItem c = checklist.findById(id).orElseThrow(() -> ApiException.notFound("체크리스트"));
        projectService.editable(find(c.getTaskId()).getProject().getId());
        if (req.text() != null) c.setText(req.text());
        if (req.done() != null) c.setDone(req.done());
        return Mappers.checklist(c);
    }

    public void deleteChecklist(Long id) {
        ChecklistItem c = checklist.findById(id).orElseThrow(() -> ApiException.notFound("체크리스트"));
        projectService.editable(find(c.getTaskId()).getProject().getId());
        checklist.delete(c);
    }

    /** 코멘트는 프로젝트 참여자만 쓸 수 있다 */
    public CommentDto addComment(Long taskId, CommentRequest req) {
        Task task = find(taskId);
        if (!ProjectService.isParticipant(task.getProject(), CurrentUser.id()))
            throw new ApiException(403, "이 프로젝트의 참여자만 코멘트를 남길 수 있습니다.");
        TaskComment c = new TaskComment();
        c.setTask(task);
        c.setAuthor(users.getReferenceById(CurrentUser.id()));
        c.setBody(req.body());
        comments.save(c);
        return Mappers.comment(comments.findById(c.getId()).orElseThrow());
    }

    /** 코멘트 수정: 쓴 사람만 (지금도 참여자여야 함) */
    public CommentDto updateComment(Long id, CommentRequest req) {
        TaskComment c = ownComment(id);
        c.setBody(req.body());
        c.setUpdatedAt(Instant.now());
        return Mappers.comment(c);
    }

    /** 코멘트 삭제: 쓴 사람만 (지금도 참여자여야 함) */
    public void deleteComment(Long id) {
        comments.delete(ownComment(id));
    }

    private TaskComment ownComment(Long id) {
        TaskComment c = comments.findById(id).orElseThrow(() -> ApiException.notFound("코멘트"));
        projectService.editable(c.getTask().getProject().getId());
        if (!c.getAuthor().getId().equals(CurrentUser.id()))
            throw new ApiException(403, "본인이 쓴 코멘트만 고치거나 지울 수 있습니다.");
        return c;
    }

    Task find(Long id) {
        return tasks.findById(id).orElseThrow(() -> ApiException.notFound("할일"));
    }

    private static String name(AppUser u) {
        return u == null ? null : u.getDisplayName();
    }
}
