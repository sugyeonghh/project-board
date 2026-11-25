package com.pmboard.web;

import com.pmboard.service.*;
import com.pmboard.web.dto.Dtos.*;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api")
public class ProjectController {
    private final ProjectService projects;
    private final TaskService tasks;
    private final NoteService notes;
    private final DashboardService dashboard;

    public ProjectController(ProjectService projects, TaskService tasks, NoteService notes, DashboardService dashboard) {
        this.projects = projects;
        this.tasks = tasks;
        this.notes = notes;
        this.dashboard = dashboard;
    }

    @GetMapping("/dashboard")
    public DashboardDto dashboard() {
        return dashboard.get(LocalDate.now());
    }

    /** mine=true: 내가 책임자·참여자인 프로젝트만 (프로젝트 상세 메뉴) */
    @GetMapping("/projects")
    public List<ProjectSummary> active(@RequestParam(defaultValue = "false") boolean mine) {
        return projects.active(mine ? com.pmboard.config.CurrentUser.id() : null);
    }

    @GetMapping("/projects/archive")
    public List<YearGroup> archive() {
        return projects.closedByYear();
    }

    @PostMapping("/projects")
    public ProjectDetail create(@RequestBody ProjectRequest req) {
        return projects.create(req);
    }

    @GetMapping("/projects/{id}")
    public ProjectDetail get(@PathVariable Long id) {
        return projects.get(id);
    }

    @PutMapping("/projects/{id}")
    public ProjectDetail update(@PathVariable Long id, @RequestBody ProjectRequest req) {
        return projects.update(id, req);
    }

    @DeleteMapping("/projects/{id}")
    public void delete(@PathVariable Long id) {
        projects.delete(id);
    }

    @PatchMapping("/projects/{id}/priority")
    public void priority(@PathVariable Long id, @Valid @RequestBody PriorityRequest req) {
        projects.setPriority(id, req.priority());
    }

    // 마일스톤
    @GetMapping("/projects/{id}/milestones")
    public List<MilestoneDto> milestones(@PathVariable Long id) {
        return projects.milestones(id);
    }

    @PostMapping("/projects/{id}/milestones")
    public MilestoneDto addMilestone(@PathVariable Long id, @RequestBody MilestoneRequest req) {
        return projects.addMilestone(id, req);
    }

    @PutMapping("/milestones/{id}")
    public MilestoneDto updateMilestone(@PathVariable Long id, @RequestBody MilestoneRequest req) {
        return projects.updateMilestone(id, req);
    }

    @DeleteMapping("/milestones/{id}")
    public void deleteMilestone(@PathVariable Long id) {
        projects.deleteMilestone(id);
    }

    // 할일 목록 · 노트 · 결정 로그 · 변경 이력
    @GetMapping("/projects/{id}/tasks")
    public List<TaskDto> tasks(@PathVariable Long id) {
        return tasks.byProject(id);
    }

    @PostMapping("/projects/{id}/tasks")
    public TaskDto addTask(@PathVariable Long id, @RequestBody TaskRequest req) {
        return tasks.create(id, req);
    }

    @GetMapping("/projects/{id}/notes")
    public List<NoteDto> notes(@PathVariable Long id) {
        return notes.byProject(id);
    }

    @PostMapping("/projects/{id}/notes")
    public NoteDto addNote(@PathVariable Long id, @RequestBody NoteRequest req) {
        return notes.create(id, req);
    }

    @PutMapping("/notes/{id}")
    public NoteDto updateNote(@PathVariable Long id, @RequestBody NoteRequest req) {
        return notes.update(id, req);
    }

    @DeleteMapping("/notes/{id}")
    public void deleteNote(@PathVariable Long id) {
        notes.delete(id);
    }

    @GetMapping("/projects/{id}/decisions")
    public List<DecisionDto> decisions(@PathVariable Long id) {
        return projects.decisions(id);
    }

    @PostMapping("/projects/{id}/decisions")
    public DecisionDto addDecision(@PathVariable Long id, @Valid @RequestBody DecisionRequest req) {
        return projects.addDecision(id, req);
    }

    @GetMapping("/projects/{id}/history")
    public List<ChangeDto> history(@PathVariable Long id) {
        return projects.history(id);
    }
}
