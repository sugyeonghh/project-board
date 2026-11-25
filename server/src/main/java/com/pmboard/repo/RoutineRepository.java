package com.pmboard.repo;

import com.pmboard.domain.Routine;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RoutineRepository extends JpaRepository<Routine, Long> {
    List<Routine> findByActiveTrueOrderByCycleAscIdAsc();
    List<Routine> findByActiveTrueAndAssigneeId(Long assigneeId);
}
