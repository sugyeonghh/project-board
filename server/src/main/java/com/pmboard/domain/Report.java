package com.pmboard.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "report")
@Getter @Setter @NoArgsConstructor
public class Report {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "owner_id")
    private Long ownerId;
    @Enumerated(EnumType.STRING)
    private ReportType type;
    private LocalDate periodStart;
    private LocalDate periodEnd;
    private String title;
    private String content;
    @Enumerated(EnumType.STRING)
    private ReportMethod method;
    @Enumerated(EnumType.STRING)
    private ReportStatus status = ReportStatus.DRAFT;
    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();

    @PreUpdate
    void touch() { updatedAt = Instant.now(); }
}
