package com.pmboard.service;

import com.pmboard.domain.ProjectStatus;
import com.pmboard.domain.Task;
import com.pmboard.domain.TaskStatus;
import com.pmboard.repo.TaskRepository;
import com.pmboard.web.dto.Dtos.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class DashboardService {
    private final ProjectService projects;
    private final TaskRepository tasks;

    public DashboardService(ProjectService projects, TaskRepository tasks) {
        this.projects = projects;
        this.tasks = tasks;
    }

    public DashboardDto get(LocalDate today) {
        List<ProjectSummary> active = projects.active();
        LocalDate weekEnd = today.with(DayOfWeek.SUNDAY);
        List<TaskDto> due = tasks.findByStatusNotAndDueDateBetweenOrderByDueDate(TaskStatus.DONE, today, weekEnd)
                .stream().map(Mappers::task).toList();
        List<BlockedItem> blocked = tasks.findByStatus(TaskStatus.BLOCKED).stream()
                .filter(t -> !t.getProject().getStatus().isClosed())
                .sorted(Comparator.comparing(Task::getBlockedSince, Comparator.nullsLast(Comparator.naturalOrder())))
                .map(t -> new BlockedItem(Mappers.task(t),
                        t.getBlockedSince() == null ? 0 : ChronoUnit.DAYS.between(t.getBlockedSince(), today) + 1))
                .toList();
        int atRisk = (int) active.stream().filter(p -> p.status() == ProjectStatus.AT_RISK).count();
        return new DashboardDto(active.size(), due.size(), atRisk, blocked.size(), active, due, blocked,
                projects.closedByYear());
    }
}
