package com.pmboard.service;

import com.pmboard.config.ApiException;
import com.pmboard.config.CurrentUser;
import com.pmboard.domain.*;
import com.pmboard.repo.OpsTaskRepository;
import com.pmboard.repo.ProjectRepository;
import com.pmboard.repo.RoutineRepository;
import com.pmboard.repo.UserRepository;
import com.pmboard.web.dto.Dtos.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Service
@Transactional
public class OpsService {
    private final OpsTaskRepository ops;
    private final RoutineRepository routines;
    private final UserRepository users;
    private final ProjectRepository projects;

    public OpsService(OpsTaskRepository ops, RoutineRepository routines, UserRepository users,
                      ProjectRepository projects) {
        this.ops = ops;
        this.routines = routines;
        this.users = users;
        this.projects = projects;
    }

    @Transactional(readOnly = true)
    public List<OpsDto> list(LocalDate from, LocalDate to) {
        return ops.findByWorkDateBetweenOrderByWorkDateDescIdDesc(from, to).stream().map(Mappers::ops).toList();
    }

    @Transactional(readOnly = true)
    public OpsDto get(Long id) {
        return Mappers.ops(ops.findById(id).orElseThrow(() -> ApiException.notFound("운영업무")));
    }

    public OpsDto create(OpsRequest req) {
        if (req.title() == null || req.title().isBlank()) throw ApiException.badRequest("업무 내용을 입력해 주세요.");
        OpsTask o = new OpsTask();
        o.setCategory(req.category() != null ? req.category() : OpsCategory.SIMPLE);
        o.setAssignee(users.getReferenceById(req.assigneeId() != null ? req.assigneeId() : CurrentUser.id()));
        apply(o, req);
        return Mappers.ops(ops.save(o));
    }

    public OpsDto update(Long id, OpsRequest req) {
        OpsTask o = ops.findById(id).orElseThrow(() -> ApiException.notFound("운영업무"));
        if (req.category() != null) o.setCategory(req.category());
        if (req.assigneeId() != null) o.setAssignee(users.getReferenceById(req.assigneeId()));
        apply(o, req);
        return Mappers.ops(o);
    }

    private void apply(OpsTask o, OpsRequest r) {
        if (r.title() != null) o.setTitle(r.title());
        if (r.description() != null) o.setDescription(r.description());
        if (r.resolution() != null) o.setResolution(r.resolution());
        if (r.requester() != null) o.setRequester(r.requester());
        if (r.workDate() != null) o.setWorkDate(r.workDate());
        if (r.dueDate() != null) o.setDueDate(r.dueDate());
        if (Boolean.TRUE.equals(r.clearDueDate())) o.setDueDate(null);
        if (r.spentMinutes() != null) o.setSpentMinutes(r.spentMinutes());
        if (r.status() != null && r.status() != o.getStatus()) {
            o.setStatus(r.status());
            o.setDoneAt(r.status() == OpsStatus.DONE ? Instant.now() : null);
        }
    }

    public void delete(Long id) {
        ops.deleteById(id);
    }

    /** 운영업무가 커졌을 때 프로젝트로 전환 */
    public Long convertToProject(Long id) {
        OpsTask o = ops.findById(id).orElseThrow(() -> ApiException.notFound("운영업무"));
        Project p = new Project();
        p.setName(o.getTitle());
        p.setDescription(o.getDescription());
        p.setOwner(users.getReferenceById(CurrentUser.id()));
        p.setStartDate(LocalDate.now());
        projects.save(p);
        o.setConvertedProjectId(p.getId());
        return p.getId();
    }

    // 정기 작업 -----------------------------------------------------------------
    @Transactional(readOnly = true)
    public List<RoutineDto> routines(LocalDate today) {
        return routines.findByActiveTrueOrderByCycleAscIdAsc().stream().map(r -> routine(r, today)).toList();
    }

    public RoutineDto saveRoutine(Long id, RoutineRequest req) {
        Routine r = id == null ? new Routine() : routines.findById(id).orElseThrow(() -> ApiException.notFound("정기 작업"));
        if (req.name() != null) r.setName(req.name());
        if (req.cycle() != null) r.setCycle(req.cycle());
        if (req.dayOfWeek() != null) r.setDayOfWeek(req.dayOfWeek());
        if (req.dayOfMonth() != null) r.setDayOfMonth(req.dayOfMonth());
        if (req.active() != null) r.setActive(req.active());
        if (req.assigneeId() != null) r.setAssignee(users.getReferenceById(req.assigneeId()));
        if (r.getAssignee() == null) r.setAssignee(users.getReferenceById(CurrentUser.id()));
        if (r.getName() == null || r.getCycle() == null) throw ApiException.badRequest("이름과 주기를 입력해 주세요.");
        return routine(routines.save(r), LocalDate.now());
    }

    /** 이번 회차 완료 체크 (다시 누르면 취소) */
    public RoutineDto toggleRoutine(Long id, LocalDate today) {
        Routine r = routines.findById(id).orElseThrow(() -> ApiException.notFound("정기 작업"));
        LocalDate due = r.nextDue(today);
        r.setLastDoneOn(r.doneFor(due) ? null : due);
        return routine(r, today);
    }

    private RoutineDto routine(Routine r, LocalDate today) {
        LocalDate due = r.nextDue(today);
        return new RoutineDto(r.getId(), r.getName(), r.getCycle(), r.getDayOfWeek(), r.getDayOfMonth(),
                Mappers.user(r.getAssignee()), due, r.doneFor(due));
    }
}
