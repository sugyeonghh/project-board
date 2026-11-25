package com.pmboard.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "change_log")
@Getter @Setter @NoArgsConstructor
public class ChangeLog {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private Long projectId;
    private String entityType;
    private Long entityId;
    private String entityLabel;
    private String field;
    @Enumerated(EnumType.STRING)
    private ChangeKind kind;
    private String oldValue;
    private String newValue;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "changed_by")
    private AppUser changedBy;
    private Instant changedAt = Instant.now();
}
