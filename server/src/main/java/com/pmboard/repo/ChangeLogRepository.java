package com.pmboard.repo;

import com.pmboard.domain.ChangeLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

public interface ChangeLogRepository extends JpaRepository<ChangeLog, Long> {
    List<ChangeLog> findByProjectIdOrderByChangedAtDesc(Long projectId);
    List<ChangeLog> findByChangedByIdAndChangedAtBetweenOrderByChangedAt(Long userId, Instant from, Instant to);
    List<ChangeLog> findByEntityTypeAndEntityIdOrderByChangedAtDesc(String entityType, Long entityId);
}
