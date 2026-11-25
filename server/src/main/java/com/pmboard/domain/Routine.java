package com.pmboard.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

@Entity
@Table(name = "routine")
@Getter @Setter @NoArgsConstructor
public class Routine {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String name;
    @Enumerated(EnumType.STRING)
    private RoutineCycle cycle;
    private Short dayOfWeek;
    private Short dayOfMonth;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assignee_id")
    private AppUser assignee;
    private boolean active = true;
    private LocalDate lastDoneOn;

    /** 오늘 이후(오늘 포함) 다음 실행일 */
    public LocalDate nextDue(LocalDate today) {
        return switch (cycle) {
            case DAILY -> today;
            case WEEKLY -> {
                int target = dayOfWeek == null ? 1 : dayOfWeek;
                int diff = (target - today.getDayOfWeek().getValue() + 7) % 7;
                yield today.plusDays(diff);
            }
            case MONTHLY -> {
                int dom = dayOfMonth == null ? 1 : dayOfMonth;
                LocalDate cand = today.withDayOfMonth(Math.min(dom, today.lengthOfMonth()));
                if (cand.isBefore(today)) {
                    LocalDate next = today.plusMonths(1);
                    cand = next.withDayOfMonth(Math.min(dom, next.lengthOfMonth()));
                }
                yield cand;
            }
        };
    }

    public boolean doneFor(LocalDate due) {
        return lastDoneOn != null && !lastDoneOn.isBefore(due);
    }
}
