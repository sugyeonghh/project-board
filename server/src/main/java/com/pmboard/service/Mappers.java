package com.pmboard.service;

import com.pmboard.domain.*;
import com.pmboard.web.dto.Dtos.*;

import java.util.List;

/** 엔티티 → 응답 DTO 변환. 지연 로딩 때문에 반드시 트랜잭션 안에서 호출한다. */
public final class Mappers {
    private Mappers() {}

    public static UserRef user(AppUser u) {
        return u == null ? null : new UserRef(u.getId(), u.getDisplayName());
    }

    public static TaskRef taskRef(Task t) {
        return new TaskRef(t.getId(), t.getTitle(), t.getStatus());
    }

    public static TaskDto task(Task t) {
        List<TaskRef> deps = t.getDependsOn().stream().map(Mappers::taskRef).toList();
        return new TaskDto(t.getId(), t.getProject().getId(), t.getProject().getName(), t.getTitle(), t.getSummary(),
                t.getDescription(), t.getStatus(), t.getPriority(), user(t.getAssignee()), t.getStartDate(),
                t.getDueDate(), t.getBlockedReason(), t.getBlockedSince(), t.getJiraKey(), t.getDoneAt(), deps);
    }

    public static MilestoneDto milestone(Milestone m) {
        return new MilestoneDto(m.getId(), m.getName(), m.getStartDate(), m.getDueDate(), m.isDone(), m.getSortOrder());
    }

    public static DecisionDto decision(Decision d) {
        return new DecisionDto(d.getId(), d.getDecidedOn(), d.getWhat(), d.getWhy(), d.getDecidedBy());
    }

    public static ChecklistDto checklist(ChecklistItem c) {
        return new ChecklistDto(c.getId(), c.getText(), c.isDone(), c.getSortOrder());
    }

    public static CommentDto comment(TaskComment c) {
        return new CommentDto(c.getId(), user(c.getAuthor()), c.getBody(), c.getCreatedAt(), c.getUpdatedAt());
    }

    public static NoteDto note(Note n) {
        return new NoteDto(n.getId(), n.getProjectId(), n.getTitle(), n.getBody(), n.getTags(), user(n.getAuthor()),
                n.getUpdatedAt());
    }

    public static AttachmentDto attachment(Attachment a) {
        Task t = a.getTask();
        return new AttachmentDto(a.getId(), a.getProjectId(), t == null ? null : t.getId(),
                t == null ? null : t.getTitle(), a.getOriginalName(), a.getSizeBytes(), a.getContentType(),
                user(a.getUploadedBy()), a.getCreatedAt());
    }

    public static ChangeDto change(ChangeLog c) {
        return new ChangeDto(c.getId(), c.getProjectId(), c.getEntityType(), c.getEntityId(), c.getEntityLabel(),
                c.getField(), c.getKind(), c.getOldValue(), c.getNewValue(), user(c.getChangedBy()),
                c.getChangedAt());
    }

    public static OpsDto ops(OpsTask o) {
        return new OpsDto(o.getId(), o.getCategory(), o.getTitle(), o.getDescription(), o.getResolution(),
                o.getRequester(), user(o.getAssignee()), o.getStatus(), o.getWorkDate(), o.getDueDate(),
                o.getSpentMinutes(), o.getConvertedProjectId(), o.getCreatedAt(), o.getDoneAt());
    }

    public static MemoDto memo(Memo m) {
        return new MemoDto(m.getId(), m.getBody(), m.getTag(), m.isPinned(), m.getCreatedAt(), m.getUpdatedAt());
    }

    public static ReportDto report(Report r) {
        return new ReportDto(r.getId(), r.getType(), r.getPeriodStart(), r.getPeriodEnd(), r.getTitle(),
                r.getContent(), r.getMethod(), r.getStatus(), r.getCreatedAt(), r.getUpdatedAt());
    }
}
