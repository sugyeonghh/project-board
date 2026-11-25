package com.pmboard.repo;

import com.pmboard.domain.OpsStatus;
import com.pmboard.domain.OpsTask;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface OpsTaskRepository extends JpaRepository<OpsTask, Long> {
    List<OpsTask> findByWorkDateBetweenOrderByWorkDateDescIdDesc(LocalDate from, LocalDate to);
    List<OpsTask> findByAssigneeIdAndWorkDateBetween(Long assigneeId, LocalDate from, LocalDate to);
    List<OpsTask> findByAssigneeIdAndStatus(Long assigneeId, OpsStatus status);
}
