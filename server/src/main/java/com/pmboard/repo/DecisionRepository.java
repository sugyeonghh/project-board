package com.pmboard.repo;

import com.pmboard.domain.Decision;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DecisionRepository extends JpaRepository<Decision, Long> {
    List<Decision> findByProjectIdOrderByDecidedOnDescIdDesc(Long projectId);
}
