package com.pmboard.repo;

import com.pmboard.domain.ChecklistItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChecklistItemRepository extends JpaRepository<ChecklistItem, Long> {
    List<ChecklistItem> findByTaskIdOrderBySortOrderAscIdAsc(Long taskId);
}
