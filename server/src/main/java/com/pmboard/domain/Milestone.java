package com.pmboard.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

@Entity
@Table(name = "milestone")
@Getter @Setter @NoArgsConstructor
public class Milestone {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id")
    private Project project;
    private String name;
    /** 기간 마일스톤의 시작일. null이면 dueDate 하루짜리 마일스톤 */
    private LocalDate startDate;
    private LocalDate dueDate;
    private boolean done;
    private int sortOrder;
}
