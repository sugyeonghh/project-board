package com.pmboard.repo;

import com.pmboard.domain.Project;
import com.pmboard.domain.ProjectStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface ProjectRepository extends JpaRepository<Project, Long> {
    List<Project> findByStatusNotInOrderByPriorityAscEndDateAsc(Collection<ProjectStatus> statuses);
    List<Project> findByStatusInOrderByClosedOnDesc(Collection<ProjectStatus> statuses);

    /** 책임자이거나 참여자인 프로젝트 id */
    @Query("select distinct p.id from Project p left join p.members m where p.owner.id = :userId or m.id = :userId")
    List<Long> findIdsInvolving(@Param("userId") Long userId);
}
