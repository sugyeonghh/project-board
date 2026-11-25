package com.pmboard.service;

import com.pmboard.config.ApiException;
import com.pmboard.config.CurrentUser;
import com.pmboard.domain.Note;
import com.pmboard.repo.NoteRepository;
import com.pmboard.repo.UserRepository;
import com.pmboard.web.dto.Dtos.NoteDto;
import com.pmboard.web.dto.Dtos.NoteRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** 프로젝트 안의 지식노트 (Markdown) */
@Service
@Transactional
public class NoteService {
    private final NoteRepository notes;
    private final UserRepository users;
    private final ProjectService projects;

    public NoteService(NoteRepository notes, UserRepository users, ProjectService projects) {
        this.notes = notes;
        this.users = users;
        this.projects = projects;
    }

    @Transactional(readOnly = true)
    public List<NoteDto> byProject(Long projectId) {
        return notes.findByProjectIdOrderByUpdatedAtDesc(projectId).stream().map(Mappers::note).toList();
    }

    public NoteDto create(Long projectId, NoteRequest req) {
        projects.editable(projectId);
        if (req.title() == null || req.title().isBlank()) throw ApiException.badRequest("노트 제목을 입력해 주세요.");
        Note n = new Note();
        n.setProjectId(projectId);
        n.setTitle(req.title());
        n.setBody(req.body());
        n.setTags(req.tags());
        n.setAuthor(users.getReferenceById(CurrentUser.id()));
        notes.save(n);
        return Mappers.note(notes.findById(n.getId()).orElseThrow());
    }

    public NoteDto update(Long id, NoteRequest req) {
        Note n = notes.findById(id).orElseThrow(() -> ApiException.notFound("노트"));
        projects.editable(n.getProjectId());
        if (req.title() != null) n.setTitle(req.title());
        if (req.body() != null) n.setBody(req.body());
        if (req.tags() != null) n.setTags(req.tags());
        return Mappers.note(n);
    }

    public void delete(Long id) {
        Note n = notes.findById(id).orElseThrow(() -> ApiException.notFound("노트"));
        projects.editable(n.getProjectId());
        notes.delete(n);
    }
}
