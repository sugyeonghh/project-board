package com.pmboard.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "decision")
@Getter @Setter @NoArgsConstructor
public class Decision {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "project_id")
    private Long projectId;
    private LocalDate decidedOn;
    private String what;
    private String why;
    private String decidedBy;
    private Instant createdAt = Instant.now();
}
