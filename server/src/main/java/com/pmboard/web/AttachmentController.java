package com.pmboard.web;

import com.pmboard.domain.Attachment;
import com.pmboard.service.AttachmentService;
import com.pmboard.web.dto.Dtos.AttachmentDto;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api")
public class AttachmentController {
    private final AttachmentService attachments;

    public AttachmentController(AttachmentService attachments) {
        this.attachments = attachments;
    }

    @GetMapping("/projects/{id}/attachments")
    public List<AttachmentDto> list(@PathVariable Long id) {
        return attachments.byProject(id);
    }

    @PostMapping(value = "/projects/{id}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public AttachmentDto upload(@PathVariable Long id, @RequestParam(required = false) Long taskId,
                                @RequestParam("file") MultipartFile file) throws IOException {
        return attachments.upload(id, taskId, file);
    }

    @GetMapping("/attachments/{id}/download")
    public ResponseEntity<Resource> download(@PathVariable Long id) {
        Attachment a = attachments.find(id);
        String type = a.getContentType() == null ? MediaType.APPLICATION_OCTET_STREAM_VALUE : a.getContentType();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(type))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(a.getOriginalName(), StandardCharsets.UTF_8).build().toString())
                .body(new FileSystemResource(attachments.pathOf(a)));
    }

    @DeleteMapping("/attachments/{id}")
    public void delete(@PathVariable Long id) throws IOException {
        attachments.delete(id);
    }
}
