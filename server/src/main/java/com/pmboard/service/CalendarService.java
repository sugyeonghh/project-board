package com.pmboard.service;

import com.pmboard.domain.ProjectStatus;
import com.pmboard.domain.TaskStatus;
import com.pmboard.repo.MilestoneRepository;
import com.pmboard.repo.OpsTaskRepository;
import com.pmboard.repo.ProjectRepository;
import com.pmboard.repo.TaskRepository;
import com.pmboard.web.dto.Dtos.CalendarEvent;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;
import java.util.function.Predicate;

/**
 * 캘린더 일정. 시작~끝이 있는 일정(프로젝트 기간, 기간 마일스톤, 시작일이 있는 할일)은
 * date=시작일, endDate=종료일인 한 건으로 돌려주고, 화면에서 범위 선으로 그린다.
 * 하루짜리 일정은 endDate가 null이다.
 */
@Service
@Transactional(readOnly = true)
public class CalendarService {
    private final TaskRepository tasks;
    private final MilestoneRepository milestones;
    private final OpsTaskRepository ops;
    private final ProjectRepository projects;

    public CalendarService(TaskRepository tasks, MilestoneRepository milestones, OpsTaskRepository ops,
                           ProjectRepository projects) {
        this.tasks = tasks;
        this.milestones = milestones;
        this.ops = ops;
        this.projects = projects;
    }

    /**
     * 기간 [from, to]에 걸치는 일정. mineOf 가 있으면 그 사람이 책임자·참여자인 프로젝트의 일정과
     * 그 사람이 담당한 운영업무만 돌려준다.
     */
    public List<CalendarEvent> between(LocalDate from, LocalDate to, Long mineOf) {
        Set<Long> mine = mineOf == null ? null : new HashSet<>(projects.findIdsInvolving(mineOf));
        Predicate<Long> inScope = projectId -> mine == null || mine.contains(projectId);
        Predicate<LocalDate> inRange = d -> d != null && !d.isBefore(from) && !d.isAfter(to);

        List<CalendarEvent> out = new ArrayList<>();

        // 프로젝트: 시작·종료일이 다 있으면 기간, 하나만 있으면 그날 표시
        projects.findAll().stream()
                .filter(p -> p.getStatus() != ProjectStatus.CANCELLED && inScope.test(p.getId()))
                .forEach(p -> {
                    LocalDate s = p.getStartDate(), e = p.getEndDate();
                    if (isPeriod(s, e)) {
                        if (overlaps(s, e, from, to))
                            out.add(new CalendarEvent("PROJECT", p.getId(), p.getName(), s, e, p.getId(), p.getName()));
                    } else {
                        if (inRange.test(s))
                            out.add(new CalendarEvent("PROJECT_START", p.getId(), p.getName() + " 시작", s, null, p.getId(), p.getName()));
                        if (inRange.test(e) && !e.equals(s))
                            out.add(new CalendarEvent("PROJECT_END", p.getId(), p.getName() + " 종료", e, null, p.getId(), p.getName()));
                    }
                });

        // 할일 (완료 제외): 시작일이 마감일보다 앞이면 기간, 아니면 마감일 하루
        tasks.findByStatusNotAndStartDateLessThanEqualAndDueDateGreaterThanEqual(TaskStatus.DONE, to, from).stream()
                .filter(t -> isPeriod(t.getStartDate(), t.getDueDate()) && inScope.test(t.getProject().getId()))
                .forEach(t -> out.add(new CalendarEvent("TASK", t.getId(), t.getTitle(), t.getStartDate(), t.getDueDate(),
                        t.getProject().getId(), t.getProject().getName())));
        tasks.findByStatusNotAndDueDateBetweenOrderByDueDate(TaskStatus.DONE, from, to).stream()
                .filter(t -> !isPeriod(t.getStartDate(), t.getDueDate()) && inScope.test(t.getProject().getId()))
                .forEach(t -> out.add(new CalendarEvent("TASK", t.getId(), t.getTitle(), t.getDueDate(), null,
                        t.getProject().getId(), t.getProject().getName())));

        // 마일스톤: 시작일이 있으면 기간, 없으면 하루
        milestones.findByStartDateLessThanEqualAndDueDateGreaterThanEqual(to, from).stream()
                .filter(m -> isPeriod(m.getStartDate(), m.getDueDate()) && inScope.test(m.getProject().getId()))
                .forEach(m -> out.add(new CalendarEvent("MILESTONE", m.getId(), m.getName(), m.getStartDate(), m.getDueDate(),
                        m.getProject().getId(), m.getProject().getName())));
        milestones.findByDueDateBetweenOrderByDueDate(from, to).stream()
                .filter(m -> !isPeriod(m.getStartDate(), m.getDueDate()) && inScope.test(m.getProject().getId()))
                .forEach(m -> out.add(new CalendarEvent("MILESTONE", m.getId(), m.getName(), m.getDueDate(), null,
                        m.getProject().getId(), m.getProject().getName())));

        ops.findByWorkDateBetweenOrderByWorkDateDescIdDesc(from, to).stream()
                .filter(o -> o.getDueDate() != null)
                .filter(o -> mineOf == null || (o.getAssignee() != null && mineOf.equals(o.getAssignee().getId())))
                .forEach(o -> out.add(new CalendarEvent("OPS", o.getId(), o.getTitle(), o.getDueDate(), null, null, "운영업무")));

        out.sort(Comparator.comparing(CalendarEvent::date)
                .thenComparing(e -> e.endDate() == null ? e.date() : e.endDate(), Comparator.reverseOrder()));
        return out;
    }

    private static boolean isPeriod(LocalDate start, LocalDate end) {
        return start != null && end != null && start.isBefore(end);
    }

    private static boolean overlaps(LocalDate s, LocalDate e, LocalDate from, LocalDate to) {
        return !s.isAfter(to) && !e.isBefore(from);
    }
}
