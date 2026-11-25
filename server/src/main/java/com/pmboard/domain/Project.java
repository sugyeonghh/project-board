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
@Table(name = "project")
@Getter @Setter @NoArgsConstructor
public class Project {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String name;
    private String description;
    private String goal;
    private String scope;
    private String outOfScope;
    private String doneCriteria;
    private String stakeholders;
    @Enumerated(EnumType.STRING)
    private ProjectStatus status = ProjectStatus.IN_PROGRESS;
    private short priority = 2;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    private AppUser owner;
    @ManyToMany
    @JoinTable(name = "project_member",
            joinColumns = @JoinColumn(name = "project_id"),
            inverseJoinColumns = @JoinColumn(name = "user_id"))
    private Set<AppUser> members = new LinkedHashSet<>();
    private LocalDate startDate;
    private LocalDate endDate;
    private LocalDate closedOn;
    private String jiraKey;
    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();

    @PreUpdate
    void touch() { updatedAt = Instant.now(); }
}
