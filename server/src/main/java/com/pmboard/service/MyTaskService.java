package com.pmboard.service;

import com.pmboard.domain.*;
import com.pmboard.repo.OpsTaskRepository;
import com.pmboard.repo.RoutineRepository;
import com.pmboard.repo.TaskRepository;
import com.pmboard.web.dto.Dtos.MyTaskItem;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** 내 할일 모아보기: 프로젝트 할일 + 운영업무 + 정기 작업을 마감일 기준으로 묶는다. */
@Service
@Transactional(readOnly = true)
public class MyTaskService {
    private final TaskRepository tasks;
    private final OpsTaskRepository ops;
    private final RoutineRepository routines;

    public MyTaskService(TaskRepository tasks, OpsTaskRepository ops, RoutineRepository routines) {
        this.tasks = tasks;
        this.ops = ops;
        this.routines = routines;
    }

    public List<MyTaskItem> forUser(Long userId, LocalDate today) {
        List<MyTaskItem> out = new ArrayList<>();
        for (Task t : tasks.findByAssigneeIdAndStatusNotOrderByDueDateAsc(userId, TaskStatus.DONE)) {
            out.add(new MyTaskItem("TASK", t.getId(), t.getTitle(), t.getProject().getId(), t.getProject().getName(),
                    t.getStatus().name(), t.getDueDate(), group(t.getDueDate(), today), null));
        }
        for (OpsTask o : ops.findByAssigneeIdAndStatus(userId, OpsStatus.OPEN)) {
            LocalDate due = o.getDueDate() != null ? o.getDueDate() : o.getWorkDate();
            out.add(new MyTaskItem("OPS", o.getId(), o.getTitle(), null, "운영업무", o.getStatus().name(),
                    due, group(due, today), null));
        }
        for (Routine r : routines.findByActiveTrueAndAssigneeId(userId)) {
            LocalDate due = r.nextDue(today);
            if (r.doneFor(due) || due.isAfter(today.plusDays(7))) continue;
            out.add(new MyTaskItem("ROUTINE", r.getId(), r.getName(), null, "정기 작업", "TODO", due, group(due, today), null));
        }
        out.sort(Comparator.comparing(MyTaskItem::dueDate, Comparator.nullsLast(Comparator.naturalOrder())));
        return out;
    }

    /** 완료한 항목: 프로젝트 할일 + 운영업무. 최근 완료 순으로 최대 300건 */
    public List<MyTaskItem> doneForUser(Long userId) {
        List<MyTaskItem> out = new ArrayList<>();
        for (Task t : tasks.findByAssigneeIdAndStatusIn(userId, List.of(TaskStatus.DONE))) {
            out.add(new MyTaskItem("TASK", t.getId(), t.getTitle(), t.getProject().getId(), t.getProject().getName(),
                    t.getStatus().name(), t.getDueDate(), "done", day(t.getDoneAt())));
        }
        for (OpsTask o : ops.findByAssigneeIdAndStatus(userId, OpsStatus.DONE)) {
            LocalDate due = o.getDueDate() != null ? o.getDueDate() : o.getWorkDate();
            out.add(new MyTaskItem("OPS", o.getId(), o.getTitle(), null, "운영업무", o.getStatus().name(),
                    due, "done", day(o.getDoneAt())));
        }
        out.sort(Comparator.comparing(MyTaskItem::doneOn, Comparator.nullsLast(Comparator.reverseOrder())));
        return out.size() > 300 ? out.subList(0, 300) : out;
    }

    private static LocalDate day(java.time.Instant at) {
        return at == null ? null : at.atZone(java.time.ZoneId.systemDefault()).toLocalDate();
    }

    static String group(LocalDate due, LocalDate today) {
        if (due == null) return "later";
        if (due.isBefore(today)) return "late";
        if (due.isEqual(today)) return "today";
        LocalDate endOfWeek = today.with(DayOfWeek.SUNDAY);
        return due.isAfter(endOfWeek) ? "later" : "week";
    }
}
