package com.pmboard.web;

import com.pmboard.config.CurrentUser;
import com.pmboard.service.MyTaskService;
import com.pmboard.service.TaskService;
import com.pmboard.web.dto.Dtos.*;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api")
public class TaskController {
    private final TaskService tasks;
    private final MyTaskService myTasks;

    public TaskController(TaskService tasks, MyTaskService myTasks) {
        this.tasks = tasks;
        this.myTasks = myTasks;
    }

    /** 내 할일 모아보기 */
    /** done=true: 내가 담당한 완료 항목 (최근 완료 순) */
    @GetMapping("/my-tasks")
    public List<MyTaskItem> mine(@RequestParam(defaultValue = "false") boolean done) {
        return done ? myTasks.doneForUser(CurrentUser.id()) : myTasks.forUser(CurrentUser.id(), LocalDate.now());
    }

    /** 할일 상세 팝업 */
    @GetMapping("/tasks/{id}")
    public TaskDetail detail(@PathVariable Long id) {
        return tasks.detail(id);
    }

    @PutMapping("/tasks/{id}")
    public TaskDto update(@PathVariable Long id, @RequestBody TaskRequest req) {
        return tasks.update(id, req);
    }

    @DeleteMapping("/tasks/{id}")
    public void delete(@PathVariable Long id) {
        tasks.delete(id);
    }

    @PostMapping("/tasks/{id}/checklist")
    public ChecklistDto addChecklist(@PathVariable Long id, @RequestBody ChecklistRequest req) {
        return tasks.addChecklist(id, req);
    }

    @PatchMapping("/checklist/{id}")
    public ChecklistDto updateChecklist(@PathVariable Long id, @RequestBody ChecklistRequest req) {
        return tasks.updateChecklist(id, req);
    }

    @DeleteMapping("/checklist/{id}")
    public void deleteChecklist(@PathVariable Long id) {
        tasks.deleteChecklist(id);
    }

    @PutMapping("/comments/{id}")
    public CommentDto updateComment(@PathVariable Long id, @Valid @RequestBody CommentRequest req) {
        return tasks.updateComment(id, req);
    }

    @DeleteMapping("/comments/{id}")
    public void deleteComment(@PathVariable Long id) {
        tasks.deleteComment(id);
    }

    @PostMapping("/tasks/{id}/comments")
    public CommentDto comment(@PathVariable Long id, @Valid @RequestBody CommentRequest req) {
        return tasks.addComment(id, req);
    }
}
