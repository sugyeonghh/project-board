package com.pmboard.repo;

import com.pmboard.domain.Note;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NoteRepository extends JpaRepository<Note, Long> {
    List<Note> findByProjectIdOrderByUpdatedAtDesc(Long projectId);
}
