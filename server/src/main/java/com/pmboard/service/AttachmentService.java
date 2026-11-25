package com.pmboard.service;

import com.pmboard.config.ApiException;
import com.pmboard.config.CurrentUser;
import com.pmboard.config.PmBoardProperties;
import com.pmboard.domain.Attachment;
import com.pmboard.repo.AttachmentRepository;
import com.pmboard.repo.TaskRepository;
import com.pmboard.repo.UserRepository;
import com.pmboard.web.dto.Dtos.AttachmentDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** 첨부파일은 서버 디스크(pmboard.storage-dir)에 저장하고, DB에는 경로만 둔다. */
@Service
@Transactional
public class AttachmentService {
    private final AttachmentRepository repo;
    private final TaskRepository tasks;
    private final UserRepository users;
    private final ProjectService projects;
    private final Path root;

    public AttachmentService(AttachmentRepository repo, TaskRepository tasks, UserRepository users,
                             ProjectService projects, PmBoardProperties props) {
        this.repo = repo;
        this.tasks = tasks;
        this.users = users;
        this.projects = projects;
        this.root = Path.of(props.storageDir()).toAbsolutePath().normalize();
    }

    @Transactional(readOnly = true)
    public List<AttachmentDto> byProject(Long projectId) {
        return repo.findByProjectIdOrderByCreatedAtDesc(projectId).stream().map(Mappers::attachment).toList();
    }

    public AttachmentDto upload(Long projectId, Long taskId, MultipartFile file) throws IOException {
        projects.editable(projectId);
        if (file.isEmpty()) throw ApiException.badRequest("빈 파일입니다.");
        LocalDate today = LocalDate.now();
        Path dir = root.resolve(String.valueOf(today.getYear())).resolve(String.format("%02d", today.getMonthValue()));
        Files.createDirectories(dir);
        Path target = dir.resolve(UUID.randomUUID().toString());
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        }
        Attachment a = new Attachment();
        a.setProjectId(projectId);
        if (taskId != null) a.setTask(tasks.findById(taskId).orElseThrow(() -> ApiException.notFound("할일")));
        a.setOriginalName(file.getOriginalFilename() == null ? "file" : file.getOriginalFilename());
        a.setStoredPath(root.relativize(target).toString());
        a.setSizeBytes(file.getSize());
        a.setContentType(file.getContentType());
        a.setUploadedBy(users.getReferenceById(CurrentUser.id()));
        repo.save(a);
        return Mappers.attachment(repo.findById(a.getId()).orElseThrow());
    }

    @Transactional(readOnly = true)
    public Attachment find(Long id) {
        return repo.findById(id).orElseThrow(() -> ApiException.notFound("첨부파일"));
    }

    public Path pathOf(Attachment a) {
        Path p = root.resolve(a.getStoredPath()).normalize();
        if (!p.startsWith(root)) throw new ApiException(400, "잘못된 파일 경로입니다.");
        return p;
    }

    public void delete(Long id) throws IOException {
        Attachment a = find(id);
        projects.editable(a.getProjectId());
        Files.deleteIfExists(pathOf(a));
        repo.delete(a);
    }
}
