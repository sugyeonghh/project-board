package com.pmboard.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "checklist_item")
@Getter @Setter @NoArgsConstructor
public class ChecklistItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "task_id")
    private Long taskId;
    private String text;
    private boolean done;
    private int sortOrder;
}
