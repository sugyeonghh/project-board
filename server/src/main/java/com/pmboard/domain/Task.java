package com.pmboard.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "task")
@Getter @Setter @NoArgsConstructor
public class Task {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id")
    private Project project;
    private String title;
    private String description;
    private String summary;
    @Enumerated(EnumType.STRING)
    private TaskStatus status = TaskStatus.TODO;
    private short priority = 2;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assignee_id")
    private AppUser assignee;
    private LocalDate startDate;
    private LocalDate dueDate;
    private String blockedReason;
    private LocalDate blockedSince;
    private String jiraKey;
    private Instant doneAt;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private AppUser createdBy;
    @ManyToMany
    @JoinTable(name = "task_dependency",
            joinColumns = @JoinColumn(name = "task_id"),
            inverseJoinColumns = @JoinColumn(name = "depends_on_id"))
    private Set<Task> dependsOn = new LinkedHashSet<>();
    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();

    @PreUpdate
    void touch() { updatedAt = Instant.now(); }
}
