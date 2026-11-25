package com.pmboard.service;

import com.pmboard.config.ApiException;
import com.pmboard.config.AuthUser;
import com.pmboard.config.CurrentUser;
import com.pmboard.domain.*;
import com.pmboard.repo.*;
import com.pmboard.web.dto.Dtos.*;
import com.pmboard.config.PmBoardProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
public class ProjectService {
    private static final Logger LOG = LoggerFactory.getLogger(ProjectService.class);
    private static final Set<ProjectStatus> CLOSED = EnumSet.of(ProjectStatus.DONE, ProjectStatus.CANCELLED);

    private final ProjectRepository projects;
    private final TaskRepository tasks;
    private final MilestoneRepository milestones;
    private final DecisionRepository decisions;
    private final ChangeLogRepository changes;
    private final UserRepository users;
    private final AttachmentRepository attachments;
    private final ChangeLogService log;
    private final Path storageRoot;

    public ProjectService(ProjectRepository projects, TaskRepository tasks, MilestoneRepository milestones,
                          DecisionRepository decisions, ChangeLogRepository changes, UserRepository users,
                          AttachmentRepository attachments, ChangeLogService log, PmBoardProperties props) {
        this.attachments = attachments;
        this.storageRoot = Path.of(props.storageDir()).toAbsolutePath().normalize();
        this.projects = projects;
        this.tasks = tasks;
        this.milestones = milestones;
        this.decisions = decisions;
        this.changes = changes;
        this.users = users;
        this.log = log;
    }

    // 조회 --------------------------------------------------------------------
    @Transactional(readOnly = true)
    public List<ProjectSummary> active() {
        return active(null);
    }

    /** 진행 중 프로젝트. userId가 있으면 그 사람이 책임자·참여자인 것만 */
    @Transactional(readOnly = true)
    public List<ProjectSummary> active(Long userId) {
        Map<Long, long[]> counts = taskCounts();
        Set<Long> mine = userId == null ? null : new HashSet<>(projects.findIdsInvolving(userId));
        return projects.findByStatusNotInOrderByPriorityAscEndDateAsc(CLOSED).stream()
                .filter(p -> mine == null || mine.contains(p.getId()))
                .map(p -> summary(p, counts)).toList();
    }

    @Transactional(readOnly = true)
    public List<YearGroup> closedByYear() {
        Map<Long, long[]> counts = taskCounts();
        Map<Integer, List<ProjectSummary>> byYear = new TreeMap<>(Comparator.reverseOrder());
        for (Project p : projects.findByStatusInOrderByClosedOnDesc(CLOSED)) {
            LocalDate closed = p.getClosedOn() != null ? p.getClosedOn() : p.getEndDate();
            int year = closed != null ? closed.getYear() : LocalDate.now().getYear();
            byYear.computeIfAbsent(year, y -> new ArrayList<>()).add(summary(p, counts));
        }
        return byYear.entrySet().stream().map(e -> new YearGroup(e.getKey(), e.getValue())).toList();
    }

    @Transactional(readOnly = true)
    public ProjectDetail get(Long id) {
        Project p = find(id);
        long[] c = taskCounts().getOrDefault(id, new long[]{0, 0});
        return new ProjectDetail(p.getId(), p.getName(), p.getDescription(), p.getGoal(), p.getScope(),
                p.getOutOfScope(), p.getDoneCriteria(), p.getStakeholders(), p.getStatus(), p.getPriority(),
                Mappers.user(p.getOwner()), p.getMembers().stream().map(Mappers::user).toList(),
                p.getStartDate(), p.getEndDate(), p.getClosedOn(), p.getJiraKey(), percent(c), c[1], c[0]);
    }

    // 생성 · 수정 ---------------------------------------------------------------
    public ProjectDetail create(ProjectRequest req) {
        if (req.name() == null || req.name().isBlank()) throw ApiException.badRequest("프로젝트 이름을 입력해 주세요.");
        Project p = new Project();
        apply(p, req);
        AppUser me = users.getReferenceById(CurrentUser.id());
        if (p.getOwner() == null) p.setOwner(me);
        p.getMembers().add(me);
        projects.save(p);
        log.on(p.getId(), "PROJECT", p.getId(), p.getName()).created();
        return get(p.getId());
    }

    public ProjectDetail update(Long id, ProjectRequest req) {
        Project p = editable(id);
        var rec = log.on(id, "PROJECT", id, p.getName());
        ProjectStatus beforeStatus = p.getStatus();
        String beforeOwner = p.getOwner() == null ? null : p.getOwner().getDisplayName();
        rec.diff("name", ChangeKind.CONTENT, p.getName(), req.name() != null ? req.name() : p.getName());
        rec.diff("goal", ChangeKind.CONTENT, p.getGoal(), req.goal() != null ? req.goal() : p.getGoal());
        rec.diff("scope", ChangeKind.CONTENT, p.getScope(), req.scope() != null ? req.scope() : p.getScope());
        rec.diff("outOfScope", ChangeKind.CONTENT, p.getOutOfScope(), req.outOfScope() != null ? req.outOfScope() : p.getOutOfScope());
        rec.diff("doneCriteria", ChangeKind.CONTENT, p.getDoneCriteria(), req.doneCriteria() != null ? req.doneCriteria() : p.getDoneCriteria());
        rec.diff("startDate", ChangeKind.SCHEDULE, p.getStartDate(), req.startDate() != null ? req.startDate() : p.getStartDate());
        rec.diff("endDate", ChangeKind.SCHEDULE, p.getEndDate(), req.endDate() != null ? req.endDate() : p.getEndDate());
        rec.diff("priority", ChangeKind.CONTENT, p.getPriority(), req.priority() != null ? req.priority() : p.getPriority());
        apply(p, req);
        rec.diff("status", ChangeKind.STATUS, beforeStatus, p.getStatus());
        rec.diff("owner", ChangeKind.ASSIGNEE, beforeOwner, p.getOwner() == null ? null : p.getOwner().getDisplayName());
        if (!beforeStatus.isClosed() && p.getStatus().isClosed() && p.getClosedOn() == null) {
            p.setClosedOn(LocalDate.now());
        }
        if (beforeStatus.isClosed() && !p.getStatus().isClosed()) {
            p.setClosedOn(null);
        }
        return get(id);
    }

    public void setPriority(Long id, short priority) {
        Project p = editable(id);
        log.on(id, "PROJECT", id, p.getName()).diff("priority", ChangeKind.CONTENT, p.getPriority(), priority);
        p.setPriority(priority);
    }

    /**
     * 프로젝트 삭제. 할일·마일스톤·노트·첨부·결정 로그·참여자 연결은 DB의 ON DELETE CASCADE로 함께 지워지고,
     * 첨부파일 실제 파일은 커밋이 끝난 뒤 디스크에서 지운다. 되돌릴 수 없으므로 책임자와 관리자만 할 수 있다.
     */
    public void delete(Long id) {
        Project p = find(id);
        AuthUser me = CurrentUser.get();
        boolean ok = me.isAdmin() || (p.getOwner() != null && p.getOwner().getId().equals(me.id()));
        if (!ok) throw new ApiException(403, "프로젝트 삭제는 책임자와 관리자만 할 수 있습니다.");

        List<Path> files = attachments.findByProjectIdOrderByCreatedAtDesc(id).stream()
                .map(a -> storageRoot.resolve(a.getStoredPath()).normalize())
                .filter(f -> f.startsWith(storageRoot))
                .toList();
        projects.delete(p);
        projects.flush();

        if (files.isEmpty()) return;
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                for (Path f : files) {
                    try {
                        Files.deleteIfExists(f);
                    } catch (IOException e) {
                        LOG.warn("첨부파일을 지우지 못했습니다: {}", f, e);
                    }
                }
            }
        });
    }

    private void apply(Project p, ProjectRequest r) {
        if (r.name() != null) p.setName(r.name());
        if (r.description() != null) p.setDescription(r.description());
        if (r.goal() != null) p.setGoal(r.goal());
        if (r.scope() != null) p.setScope(r.scope());
        if (r.outOfScope() != null) p.setOutOfScope(r.outOfScope());
        if (r.doneCriteria() != null) p.setDoneCriteria(r.doneCriteria());
        if (r.stakeholders() != null) p.setStakeholders(r.stakeholders());
        if (r.status() != null) p.setStatus(r.status());
        if (r.priority() != null) p.setPriority(r.priority());
        if (r.ownerId() != null) p.setOwner(users.findById(r.ownerId()).orElseThrow(() -> ApiException.notFound("사용자")));
        if (r.memberIds() != null) p.setMembers(new LinkedHashSet<>(users.findAllById(r.memberIds())));
        if (r.startDate() != null) p.setStartDate(r.startDate());
        if (r.endDate() != null) p.setEndDate(r.endDate());
        if (r.jiraKey() != null) p.setJiraKey(r.jiraKey().isBlank() ? null : r.jiraKey());
    }

    // 마일스톤 ------------------------------------------------------------------
    @Transactional(readOnly = true)
    public List<MilestoneDto> milestones(Long projectId) {
        return milestones.findByProjectIdOrderByDueDateAscSortOrderAsc(projectId).stream().map(Mappers::milestone).toList();
    }

    public MilestoneDto addMilestone(Long projectId, MilestoneRequest req) {
        if (req.name() == null || req.dueDate() == null) throw ApiException.badRequest("이름과 날짜를 입력해 주세요.");
        checkPeriod(req.startDate(), req.dueDate());
        Milestone m = new Milestone();
        m.setProject(editable(projectId));
        m.setName(req.name());
        m.setStartDate(req.startDate());
        m.setDueDate(req.dueDate());
        m.setDone(Boolean.TRUE.equals(req.done()));
        milestones.save(m);
        log.on(projectId, "MILESTONE", m.getId(), m.getName()).created();
        return Mappers.milestone(m);
    }

    public MilestoneDto updateMilestone(Long id, MilestoneRequest req) {
        Milestone m = milestones.findById(id).orElseThrow(() -> ApiException.notFound("마일스톤"));
        editable(m.getProject().getId());
        var rec = log.on(m.getProject().getId(), "MILESTONE", id, m.getName());
        if (req.dueDate() != null) {
            checkPeriod(req.startDate(), req.dueDate());
            rec.diff("startDate", ChangeKind.SCHEDULE, m.getStartDate(), req.startDate());
            rec.diff("dueDate", ChangeKind.SCHEDULE, m.getDueDate(), req.dueDate());
            m.setStartDate(req.startDate());
            m.setDueDate(req.dueDate());
        }
        if (req.done() != null) {
            rec.diff("done", ChangeKind.STATUS, m.isDone(), req.done());
            m.setDone(req.done());
        }
        if (req.name() != null) {
            rec.diff("name", ChangeKind.CONTENT, m.getName(), req.name());
            m.setName(req.name());
        }
        return Mappers.milestone(m);
    }

    private static void checkPeriod(LocalDate start, LocalDate end) {
        if (start != null && end != null && start.isAfter(end))
            throw ApiException.badRequest("마일스톤 시작일이 종료일보다 늦을 수 없습니다.");
    }

    public void deleteMilestone(Long id) {
        Milestone m = milestones.findById(id).orElseThrow(() -> ApiException.notFound("마일스톤"));
        editable(m.getProject().getId());
        milestones.delete(m);
    }

    // 결정 로그 · 변경 이력 -------------------------------------------------------
    @Transactional(readOnly = true)
    public List<DecisionDto> decisions(Long projectId) {
        return decisions.findByProjectIdOrderByDecidedOnDescIdDesc(projectId).stream().map(Mappers::decision).toList();
    }

    public DecisionDto addDecision(Long projectId, DecisionRequest req) {
        editable(projectId);
        Decision d = new Decision();
        d.setProjectId(projectId);
        d.setDecidedOn(req.decidedOn());
        d.setWhat(req.what());
        d.setWhy(req.why());
        d.setDecidedBy(req.decidedBy());
        return Mappers.decision(decisions.save(d));
    }

    @Transactional(readOnly = true)
    public List<ChangeDto> history(Long projectId) {
        return changes.findByProjectIdOrderByChangedAtDesc(projectId).stream().map(Mappers::change).toList();
    }

    // 내부 ---------------------------------------------------------------------
    Project find(Long id) {
        return projects.findById(id).orElseThrow(() -> ApiException.notFound("프로젝트"));
    }

    /**
     * 수정 권한 확인. 로그인한 사람은 모든 프로젝트를 볼 수 있고,
     * 고치는 것은 그 프로젝트의 참여자(책임자 포함)만 할 수 있다. 관리자라도 참여자가 아니면 고칠 수 없다.
     * (삭제 권한은 delete()에서 따로 본다: 책임자·관리자)
     */
    Project editable(Long id) {
        Project p = find(id);
        AuthUser me = CurrentUser.get();
        if (!isParticipant(p, me.id())) throw new ApiException(403, "이 프로젝트의 참여자만 수정할 수 있습니다.");
        return p;
    }

    /** 책임자이거나 참여자인가 */
    static boolean isParticipant(Project p, Long userId) {
        return userId != null && ((p.getOwner() != null && p.getOwner().getId().equals(userId))
                || p.getMembers().stream().anyMatch(m -> m.getId().equals(userId)));
    }

    /** projectId → [전체 할일 수, 완료 수] */
    Map<Long, long[]> taskCounts() {
        return tasks.countByProject().stream().collect(Collectors.toMap(
                r -> (Long) r[0], r -> new long[]{((Number) r[1]).longValue(), ((Number) r[2]).longValue()}));
    }

    ProjectSummary summary(Project p, Map<Long, long[]> counts) {
        long[] c = counts.getOrDefault(p.getId(), new long[]{0, 0});
        return new ProjectSummary(p.getId(), p.getName(), p.getDescription(), p.getStatus(), p.getPriority(),
                percent(c), c[1], c[0], Mappers.user(p.getOwner()), p.getMembers().size(), p.getStartDate(),
                p.getEndDate(), p.getClosedOn(), nextStep(p));
    }

    private String nextStep(Project p) {
        if (p.getStatus().isClosed()) return null;
        Optional<Task> blocked = tasks.findByProjectIdOrderByDueDateAscIdAsc(p.getId()).stream()
                .filter(t -> t.getStatus() == TaskStatus.BLOCKED).findFirst();
        if (blocked.isPresent()) return "막힘: " + blocked.get().getTitle();
        return milestones.findByProjectIdOrderByDueDateAscSortOrderAsc(p.getId()).stream()
                .filter(m -> !m.isDone()).findFirst()
                .map(m -> "다음 마일스톤: " + m.getName() + " (" + m.getDueDate() + ")").orElse(null);
    }

    private static int percent(long[] c) {
        return c[0] == 0 ? 0 : (int) Math.round(c[1] * 100.0 / c[0]);
    }
}
