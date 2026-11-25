package com.pmboard.repo;

import com.pmboard.domain.Milestone;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface MilestoneRepository extends JpaRepository<Milestone, Long> {
    List<Milestone> findByProjectIdOrderByDueDateAscSortOrderAsc(Long projectId);
    List<Milestone> findByDueDateBetweenOrderByDueDate(LocalDate from, LocalDate to);
    /** 시작일 <= to 이고 종료일 >= from 인 마일스톤 (캘린더 기간 표시용) */
    List<Milestone> findByStartDateLessThanEqualAndDueDateGreaterThanEqual(LocalDate to, LocalDate from);
}
