package com.pmboard.repo;

import com.pmboard.domain.Memo;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MemoRepository extends JpaRepository<Memo, Long> {
    List<Memo> findByOwnerIdOrderByPinnedDescUpdatedAtDesc(Long ownerId);
}
