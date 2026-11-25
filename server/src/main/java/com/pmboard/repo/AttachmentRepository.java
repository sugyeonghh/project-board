package com.pmboard.repo;

import com.pmboard.domain.Attachment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AttachmentRepository extends JpaRepository<Attachment, Long> {
    List<Attachment> findByProjectIdOrderByCreatedAtDesc(Long projectId);
    List<Attachment> findByTaskIdOrderByCreatedAtDesc(Long taskId);
}
