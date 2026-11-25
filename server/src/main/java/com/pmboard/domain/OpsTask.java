package com.pmboard.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "ops_task")
@Getter @Setter @NoArgsConstructor
public class OpsTask {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Enumerated(EnumType.STRING)
    private OpsCategory category;
    private String title;
    /** 요청 내용 */
    private String description;
    /** 처리 내역 */
    private String resolution;
    private String requester;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assignee_id")
    private AppUser assignee;
    @Enumerated(EnumType.STRING)
    private OpsStatus status = OpsStatus.OPEN;
    private LocalDate workDate = LocalDate.now();
    private LocalDate dueDate;
    private Integer spentMinutes;
    private Long convertedProjectId;
    private Instant createdAt = Instant.now();
    private Instant doneAt;
}
