package com.pmboard.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "task_comment")
@Getter @Setter @NoArgsConstructor
public class TaskComment {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "task_id")
    private Task task;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id")
    private AppUser author;
    private String body;
    private Instant createdAt = Instant.now();
    /** 수정한 시각. 수정한 적 없으면 null */
    private Instant updatedAt;
}
