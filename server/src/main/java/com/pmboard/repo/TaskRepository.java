package com.pmboard.repo;

import com.pmboard.domain.Task;
import com.pmboard.domain.TaskStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

public interface TaskRepository extends JpaRepository<Task, Long> {
    List<Task> findByProjectIdOrderByDueDateAscIdAsc(Long projectId);

    List<Task> findByAssigneeIdAndStatusNotOrderByDueDateAsc(Long assigneeId, TaskStatus status);

    List<Task> findByAssigneeIdAndDoneAtBetween(Long assigneeId, Instant from, Instant to);

    List<Task> findByStatus(TaskStatus status);

    List<Task> findByStatusNotAndDueDateBetweenOrderByDueDate(TaskStatus status, LocalDate from, LocalDate to);

    /** 시작일 <= to 이고 마감일 >= from 인 할일 (캘린더 기간 표시용) */
    List<Task> findByStatusNotAndStartDateLessThanEqualAndDueDateGreaterThanEqual(TaskStatus status, LocalDate to, LocalDate from);

    List<Task> findByAssigneeIdAndStatusIn(Long assigneeId, Collection<TaskStatus> statuses);

    @Query("select t.project.id, count(t), sum(case when t.status = com.pmboard.domain.TaskStatus.DONE then 1 else 0 end) " +
           "from Task t group by t.project.id")
    List<Object[]> countByProject();
}
