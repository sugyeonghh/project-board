import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type {
  Attachment, Change, ChangeKind, Decision, Milestone, Note, ProjectDetail, Task, TaskStatus, UserRef,
} from "../api/types";
import { Badge, Chips, ConfirmDialog, Loading, Progress } from "../components/ui";
import ScheduleStrip from "../components/ScheduleStrip";
import TaskModal from "../components/TaskModal";
import { Markdown } from "../lib/markdown";
import { downloadAttachment } from "../lib/download";
import { useAuth } from "../lib/auth";
import {
  dateTime, ext, fieldLabel, fileSize, md, priorityLabel, projectStatusLabel, taskStatusLabel, todayIso,
} from "../lib/format";

type Tab = "overview" | "notes" | "files" | "decisions" | "history";

export default function ProjectPage() {
  const id = Number(useParams().id);
  const [params, setParams] = useSearchParams();
  const openTask = params.get("task") ? Number(params.get("task")) : null;
  const [tab, setTab] = useState<Tab>("overview");
  const [askDelete, setAskDelete] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const project = useQuery({ queryKey: ["project", id], queryFn: () => api.get<ProjectDetail>(`/projects/${id}`) });
  const tasks = useQuery({ queryKey: ["project-tasks", id], queryFn: () => api.get<Task[]>(`/projects/${id}/tasks`) });
  const milestones = useQuery({ queryKey: ["milestones", id], queryFn: () => api.get<Milestone[]>(`/projects/${id}/milestones`) });
  const notes = useQuery({ queryKey: ["notes", id], queryFn: () => api.get<Note[]>(`/projects/${id}/notes`) });
  const files = useQuery({ queryKey: ["attachments", id], queryFn: () => api.get<Attachment[]>(`/projects/${id}/attachments`) });

  const removeProject = useMutation({
    mutationFn: () => api.del(`/projects/${id}`),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ["project", id] });
      for (const key of ["projects", "archive", "dashboard", "calendar", "my-tasks"]) qc.invalidateQueries({ queryKey: [key] });
      navigate("/", { replace: true });
    },
  });

  const p = project.data;
  if (!p) return <Loading error={project.error} />;

  // 편집은 참여자(책임자 포함)만, 삭제는 책임자와 관리자만 (서버도 같은 규칙으로 막는다)
  const canEdit = user != null && (p.owner?.id === user.id || p.members.some((m) => m.id === user.id));
  const canDelete = user?.role === "ADMIN" || (p.owner != null && p.owner.id === user?.id);
  // 할일 담당자로 고를 수 있는 사람: 책임자 + 참여자
  const participants = [...(p.owner ? [p.owner] : []), ...p.members].filter((u, i, a) => a.findIndex((x) => x.id === u.id) === i);

  const setTask = (taskId: number | null) => {
    const next = new URLSearchParams(params);
    if (taskId) next.set("task", String(taskId));
    else next.delete("task");
    setParams(next, { replace: true });
  };

  return (
    <>
      <nav className="muted" style={{ fontSize: 13 }}><Link to="/">대시보드</Link> / 프로젝트 / {p.name}</nav>
      {askDelete && (
        <ConfirmDialog title="프로젝트를 삭제할까요?" confirmLabel="삭제" danger busy={removeProject.isPending}
                       onConfirm={() => removeProject.mutate()} onCancel={() => setAskDelete(false)}>
          <p><strong>{p.name}</strong> 프로젝트를 삭제하면 할일 {p.totalCount}개, 마일스톤, 지식노트, 첨부파일, 결정 로그가 모두 함께 지워져요.</p>
          <p style={{ color: "#b91c1c", marginTop: 6 }}>삭제한 뒤에는 되돌릴 수 없어요.</p>
          {removeProject.error && <p className="error" style={{ marginTop: 6 }}>{(removeProject.error as Error).message}</p>}
        </ConfirmDialog>
      )}
      <section className="card" style={{ padding: "22px 24px 0", display: "flex", flexDirection: "column", gap: 18 }}>
        <div className="row wrap">
          <h1>{p.name}</h1>
          <Badge status={p.status}>{projectStatusLabel[p.status]}</Badge>
          <span className={`badge badge-${p.priority === 1 ? "red" : p.priority === 2 ? "orange" : "gray"}`}>우선순위 {priorityLabel[p.priority]}</span>
          <span className="row" style={{ marginLeft: "auto", gap: 8 }}>
            {canEdit
              ? <Link to={`/projects/${id}/edit`} className="btn" style={{ lineHeight: "40px" }}>편집</Link>
              : <span className="muted" title="이 프로젝트의 참여자만 편집할 수 있어요">읽기 전용 · 참여자만 편집 가능</span>}
            {canDelete && <button className="btn btn-danger" onClick={() => { removeProject.reset(); setAskDelete(true); }}>삭제</button>}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
          <Meta label="기간" value={`${p.startDate ?? "—"} – ${p.endDate ? md(p.endDate) : "—"}`} />
          <Meta label="책임자" value={p.owner?.name ?? "—"} />
          <Meta label="참여자" value={p.members.map((m) => m.name).join(", ") || "—"} />
          <Meta label="Jira 프로젝트 키" value={p.jiraKey ? `${p.jiraKey} · 연동 예정` : "연동 전"} />
          <div>
            <p className="muted">진행률 · 할일 {p.doneCount} / {p.totalCount} 완료</p>
            <div style={{ marginTop: 8 }}><Progress value={p.progress} color={p.status === "AT_RISK" ? "#ea7a1a" : undefined} /></div>
          </div>
        </div>
        <div style={{ borderTop: "1px solid #eef0f3", paddingTop: 18 }}>
          <ScheduleStrip start={p.startDate} end={p.endDate} milestones={milestones.data ?? []} tasks={tasks.data ?? []} />
        </div>
        <div className="tabs" role="tablist" style={{ margin: "0 -24px", padding: "0 16px", borderTop: "1px solid #eef0f3", borderBottom: 0 }}>
          {([
            ["overview", "개요 · 할일"], ["notes", `지식노트 ${notes.data?.length ?? ""}`], ["files", `첨부파일 ${files.data?.length ?? ""}`],
            ["decisions", "결정 로그"], ["history", "변경 이력"],
          ] as [Tab, string][]).map(([v, l]) => (
            <button key={v} role="tab" aria-selected={tab === v} className={`tab ${tab === v ? "on" : ""}`} onClick={() => setTab(v)}>{l}</button>
          ))}
        </div>
      </section>

      {tab === "overview" && <OverviewTab project={p} tasks={tasks.data ?? []} milestones={milestones.data ?? []} onOpen={setTask} canEdit={canEdit} participants={participants} />}
      {tab === "notes" && <NotesTab projectId={id} notes={notes.data ?? []} canEdit={canEdit} />}
      {tab === "files" && <FilesTab projectId={id} files={files.data ?? []} canEdit={canEdit} />}
      {tab === "decisions" && <DecisionsTab projectId={id} canEdit={canEdit} />}
      {tab === "history" && <HistoryTab projectId={id} />}

      {openTask && <TaskModal taskId={openTask} onClose={() => setTask(null)} canEdit={canEdit} participants={participants} />}
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div><p className="muted">{label}</p><p style={{ marginTop: 4, fontWeight: 500 }}>{value}</p></div>;
}

// 개요 · 할일 ------------------------------------------------------------------
const TILE = { background: "#f9fafb", border: "1px solid #e4e7ec", borderRadius: 10, padding: "16px 18px" };

function Lines({ text }: { text: string | null }) {
  const lines = (text ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
  if (!lines.length) return <p className="muted">아직 적지 않았어요.</p>;
  return <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, color: "#374151" }}>{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>;
}

function OverviewTab({ project: p, tasks, milestones, onOpen, canEdit, participants }: {
  project: ProjectDetail; tasks: Task[]; milestones: Milestone[]; onOpen: (id: number) => void; canEdit: boolean; participants: UserRef[];
}) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"ALL" | TaskStatus>("ALL");
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState(0);
  const [due, setDue] = useState("");
  const [msName, setMsName] = useState("");
  const [msStart, setMsStart] = useState("");
  const [msDate, setMsDate] = useState("");
  const [msEdit, setMsEdit] = useState<{ id: number; name: string; start: string; due: string } | null>(null);
  const [msDelete, setMsDelete] = useState<Milestone | null>(null);
  const refresh = () => qc.invalidateQueries();

  const addTask = useMutation({
    mutationFn: () => api.post(`/projects/${p.id}/tasks`, { title, assigneeId: assignee || undefined, dueDate: due || undefined }),
    onSuccess: () => { setTitle(""); setDue(""); refresh(); },
  });
  const addMs = useMutation({
    mutationFn: () => api.post(`/projects/${p.id}/milestones`, { name: msName, startDate: msStart || undefined, dueDate: msDate }),
    onSuccess: () => { setMsName(""); setMsStart(""); setMsDate(""); refresh(); },
  });
  const saveMsDates = useMutation({
    mutationFn: (v: { id: number; name: string; start: string; due: string }) =>
      api.put(`/milestones/${v.id}`, { name: v.name.trim(), startDate: v.start || undefined, dueDate: v.due }),
    onSuccess: () => { setMsEdit(null); refresh(); },
  });
  const removeMs = useMutation({
    mutationFn: (id: number) => api.del(`/milestones/${id}`),
    onSuccess: () => { setMsDelete(null); setMsEdit(null); refresh(); },
  });
  const toggleMs = useMutation({ mutationFn: (m: Milestone) => api.put(`/milestones/${m.id}`, { done: !m.done }), onSuccess: refresh });

  const shown = tasks.filter((t) => filter === "ALL" || t.status === filter);
  const onAddTask = (e: FormEvent) => { e.preventDefault(); if (title.trim()) addTask.mutate(); };
  const onAddMs = (e: FormEvent) => { e.preventDefault(); if (msName.trim() && msDate) addMs.mutate(); };
  const msError = (addMs.error ?? saveMsDates.error ?? toggleMs.error ?? removeMs.error) as Error | null;
  const periodText = (m: Milestone) => (m.startDate && m.startDate !== m.dueDate ? `${md(m.startDate)} – ${md(m.dueDate)}` : md(m.dueDate));
  const COLS = "0.9fr 3fr 1fr 0.8fr 0.9fr";

  return (
    <div className="row wrap" style={{ alignItems: "flex-start", gap: 20 }}>
      <div className="stack" style={{ flex: "999 1 560px", minWidth: 0, gap: 20 }}>
        <section className="card card-pad">
          <h2 style={{ marginBottom: 16 }}>프로젝트 개요</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <div style={{ gridColumn: "1 / -1", background: "#eef3fe", borderRadius: 10, padding: "16px 18px" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#1e40af", marginBottom: 6 }}>목표</p>
              <p style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.6 }}>{p.goal || <span className="muted">편집에서 목표를 적어 주세요.</span>}</p>
            </div>
            <div style={TILE}><p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>범위</p><Lines text={p.scope} /></div>
            <div style={TILE}><p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "#9a3412" }}>제외 범위</p><Lines text={p.outOfScope} /></div>
            <div style={TILE}><p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "#166534" }}>완료 기준</p><Lines text={p.doneCriteria} /></div>
            <div style={TILE}><p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "#5b21b6" }}>이해관계자 · 관련 시스템</p><Lines text={p.stakeholders} /></div>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="grow">할일 목록</h2>
            <Chips value={filter} onChange={setFilter} options={[
              { value: "ALL", label: `전체 ${tasks.length}` },
              ...(["IN_PROGRESS", "BLOCKED", "TODO", "DONE"] as TaskStatus[]).map((s) => ({
                value: s, label: `${taskStatusLabel[s]} ${tasks.filter((t) => t.status === s).length}`,
              })),
            ]} />
          </div>
          {canEdit && <form onSubmit={onAddTask} className="row wrap" style={{ padding: "12px 20px", borderBottom: "1px solid #eef0f3" }}>
            <input className="grow" style={{ minWidth: 220 }} aria-label="새 할일" placeholder="새 할일 제목" value={title} onChange={(e) => setTitle(e.target.value)} />
            <select aria-label="담당자" value={assignee} onChange={(e) => setAssignee(Number(e.target.value))}>
              <option value={0}>담당자 미지정</option>
              {participants.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <input type="date" aria-label="마감일" value={due} onChange={(e) => setDue(e.target.value)} />
            <button className="btn btn-primary" disabled={addTask.isPending}>+ 할일 추가</button>
          </form>}
          {addTask.error && <p className="error" style={{ padding: "8px 20px" }}>{(addTask.error as Error).message}</p>}
          <div className="table-scroll">
            <div style={{ minWidth: 720 }}>
              <div className="thead" style={{ display: "grid", gridTemplateColumns: COLS, gap: 14, padding: "10px 20px" }}>
                <span>상태</span><span>할일 (누르면 상세)</span><span>담당자</span><span>마감</span><span>Jira</span>
              </div>
              {shown.length === 0 && <div className="empty">할일이 없어요.</div>}
              {shown.map((t) => (
                <button key={t.id} className="list-row clickable" onClick={() => onOpen(t.id)}
                        style={{ display: "grid", gridTemplateColumns: COLS, gap: 14 }}>
                  <span><Badge status={t.status}>{taskStatusLabel[t.status]}</Badge></span>
                  <span style={{ minWidth: 0 }}><div>{t.title}</div>{(t.summary || t.blockedReason) && <div className="muted">{t.summary || t.blockedReason}</div>}</span>
                  <span style={{ fontSize: 13 }}>{t.assignee?.name ?? "—"}</span>
                  <span style={{ fontSize: 13, color: t.dueDate && t.dueDate < todayIso() && t.status !== "DONE" ? "#b91c1c" : undefined }}>{md(t.dueDate)}</span>
                  <span className="muted">{t.jiraKey ?? "연동 전"}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      <aside className="stack" style={{ flex: "1 1 300px", minWidth: 0, gap: 20 }}>
        <section className="card card-pad">
          <h2 style={{ fontSize: 16, marginBottom: 10 }}>마일스톤 관리</h2>
          {milestones.length === 0 && <p className="muted">아직 마일스톤이 없어요.</p>}
          {milestones.map((m) => msEdit?.id === m.id ? (
            <form key={m.id} className="stack" style={{ gap: 6, padding: "8px 0", borderTop: "1px solid #eef0f3" }}
                  onSubmit={(e) => { e.preventDefault(); if (msEdit.due && msEdit.name.trim()) saveMsDates.mutate(msEdit); }}>
              <input aria-label="마일스톤 이름" required value={msEdit.name} onChange={(e) => setMsEdit({ ...msEdit, name: e.target.value })} />
              <div className="row" style={{ gap: 6 }}>
                <input className="grow" type="date" aria-label="시작일" title="시작일 (비우면 하루짜리)" value={msEdit.start} max={msEdit.due || undefined}
                       onChange={(e) => setMsEdit({ ...msEdit, start: e.target.value })} />
                <span className="muted">~</span>
                <input className="grow" type="date" aria-label="종료일" required value={msEdit.due} min={msEdit.start || undefined}
                       onChange={(e) => setMsEdit({ ...msEdit, due: e.target.value })} />
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button className="btn btn-sm btn-primary" disabled={saveMsDates.isPending}>저장</button>
                <button type="button" className="btn btn-sm" onClick={() => setMsEdit(null)}>취소</button>
                <button type="button" className="btn btn-sm btn-danger" style={{ marginLeft: "auto" }}
                        onClick={() => { removeMs.reset(); setMsDelete(m); }}>삭제</button>
              </div>
            </form>
          ) : (
            <div key={m.id} className="row" style={{ padding: "8px 0", borderTop: "1px solid #eef0f3" }}>
              <input type="checkbox" aria-label={`${m.name} 완료`} checked={m.done} disabled={!canEdit}
                     onChange={() => toggleMs.mutate(m)} style={{ width: 17, height: 17, padding: 0 }} />
              <span className="grow" style={m.done ? { color: "#5b6472", textDecoration: "line-through" } : undefined}>{m.name}</span>
              {canEdit ? (
                <>
                  <span className="muted">{periodText(m)}</span>
                  <button className="btn-link" title={`${m.name} 수정`} style={{ padding: "0 2px" }}
                          onClick={() => { saveMsDates.reset(); setMsEdit({ id: m.id, name: m.name, start: m.startDate ?? "", due: m.dueDate }); }}>수정</button>
                </>
              ) : <span className="muted">{periodText(m)}</span>}
            </div>
          ))}
          {msError && <p className="error" style={{ marginTop: 6 }}>{msError.message}</p>}
          {msDelete && (
            <ConfirmDialog title="마일스톤을 삭제할까요?" confirmLabel="삭제" danger busy={removeMs.isPending}
                           onConfirm={() => removeMs.mutate(msDelete.id)} onCancel={() => setMsDelete(null)}>
              <p><strong>{msDelete.name}</strong> ({periodText(msDelete)}) 마일스톤을 삭제해요. 되돌릴 수 없어요.</p>
            </ConfirmDialog>
          )}
          {canEdit && (
            <form onSubmit={onAddMs} className="stack" style={{ gap: 8, marginTop: 10 }}>
              <input aria-label="마일스톤 이름" placeholder="마일스톤 이름" value={msName} onChange={(e) => setMsName(e.target.value)} />
              <div className="row" style={{ gap: 6 }}>
                <input className="grow" type="date" aria-label="마일스톤 시작일" title="시작일 (선택 · 비우면 하루짜리)" value={msStart} max={msDate || undefined}
                       onChange={(e) => setMsStart(e.target.value)} />
                <span className="muted">~</span>
                <input className="grow" type="date" aria-label="마일스톤 종료일" title="종료일 (필수)" value={msDate} min={msStart || undefined}
                       onChange={(e) => setMsDate(e.target.value)} />
              </div>
              <div className="row"><span className="muted grow" style={{ fontSize: 12 }}>시작일을 비우면 하루짜리 마일스톤이에요.</span><button className="btn btn-sm">추가</button></div>
            </form>
          )}
        </section>
      </aside>
    </div>
  );
}

// 지식노트 ---------------------------------------------------------------------
function NotesTab({ projectId, notes, canEdit }: { projectId: number; notes: Note[]; canEdit: boolean }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<number | null>(notes[0]?.id ?? null);
  const [editing, setEditing] = useState<{ title: string; body: string; tags: string } | null>(null);
  const [isNew, setIsNew] = useState(false);
  const note = notes.find((n) => n.id === selected) ?? null;
  const save = useMutation({
    mutationFn: (v: { title: string; body: string; tags: string }) =>
      note && !isNew ? api.put<Note>(`/notes/${note.id}`, v) : api.post<Note>(`/projects/${projectId}/notes`, v),
    onSuccess: (n) => { qc.invalidateQueries({ queryKey: ["notes", projectId] }); setSelected(n.id); setEditing(null); setIsNew(false); },
  });

  return (
    <div className="row wrap" style={{ alignItems: "flex-start", gap: 20 }}>
      <section className="card card-pad stack" style={{ flex: "1 1 260px", gap: 6 }}>
        <div className="row"><h2 className="grow" style={{ fontSize: 16 }}>이 프로젝트의 노트</h2>
          {canEdit && <button className="btn btn-sm btn-primary" onClick={() => { setIsNew(true); setEditing({ title: "", body: "", tags: "" }); }}>+ 노트</button>}</div>
        {notes.length === 0 && <p className="muted">설계 메모, 용어 정리, 처리 흐름 같은 이론 내용을 모아 두세요.</p>}
        {notes.map((n) => (
          <button key={n.id} className={`chip ${n.id === selected ? "on" : ""}`} style={{ height: "auto", padding: "10px 12px", borderRadius: 8, textAlign: "left", border: 0 }}
                  onClick={() => { setSelected(n.id); setEditing(null); setIsNew(false); }}>
            <div>{n.title}</div><div className="muted">{dateTime(n.updatedAt)} 수정</div>
          </button>
        ))}
      </section>
      <article className="card" style={{ flex: "999 1 560px", minWidth: 0, padding: "26px 30px" }}>
        {editing && canEdit ? (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); save.mutate(editing); }}>
            <input required placeholder="제목" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            <input placeholder="태그 (예: #PG #정산)" value={editing.tags} onChange={(e) => setEditing({ ...editing, tags: e.target.value })} />
            <textarea rows={18} placeholder={"Markdown으로 작성해요.\n# 제목\n## 소제목\n- 목록"} value={editing.body}
                      onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
            {save.error && <p className="error">{(save.error as Error).message}</p>}
            <div className="row"><button className="btn btn-primary">저장</button><button type="button" className="btn" onClick={() => { setEditing(null); setIsNew(false); }}>취소</button></div>
          </form>
        ) : note ? (
          <div className="stack">
            <div className="row wrap">
              {note.tags && <span className="badge badge-gray">{note.tags}</span>}
              {canEdit && <button className="btn btn-sm" style={{ marginLeft: "auto" }}
                      onClick={() => setEditing({ title: note.title, body: note.body ?? "", tags: note.tags ?? "" })}>편집</button>}
            </div>
            <div><h2 style={{ fontSize: 24 }}>{note.title}</h2><p className="muted" style={{ marginTop: 6 }}>작성 {note.author?.name} · {dateTime(note.updatedAt)} 수정</p></div>
            <Markdown text={note.body ?? ""} />
          </div>
        ) : <div className="empty">왼쪽에서 노트를 고르거나 새로 만들어 주세요.</div>}
      </article>
    </div>
  );
}

// 첨부파일 ---------------------------------------------------------------------
function FilesTab({ projectId, files, canEdit }: { projectId: number; files: Attachment[]; canEdit: boolean }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const upload = useMutation({
    mutationFn: async (list: File[]) => {
      for (const f of list) {
        const form = new FormData();
        form.append("file", f);
        await api.upload(`/projects/${projectId}/attachments`, form);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attachments", projectId] }),
  });
  const remove = useMutation({ mutationFn: (id: number) => api.del(`/attachments/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["attachments", projectId] }) });
  const COLS = "2.6fr 1.8fr 0.7fr 0.8fr 0.8fr 1.2fr";

  return (
    <section className="card card-pad stack">
      <h2>첨부파일</h2>
      {canEdit && <div onClick={() => input.current?.click()}
           onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
           onDrop={(e) => { e.preventDefault(); setDrag(false); upload.mutate(Array.from(e.dataTransfer.files)); }}
           style={{ padding: 32, border: `2px dashed ${drag ? "#2f5bea" : "#c5cbd4"}`, borderRadius: 12, background: "#f9fafb", textAlign: "center", cursor: "pointer" }}>
        <p style={{ fontWeight: 500, fontSize: 15 }}>{upload.isPending ? "올리는 중…" : "파일을 끌어다 놓거나 눌러서 선택"}</p>
        <p className="muted" style={{ marginTop: 6 }}>명세서, 회의록, 테스트 결과 등 · 할일 팝업에서 올리면 그 할일에 연결돼요</p>
        <input ref={input} type="file" multiple hidden onChange={(e) => { upload.mutate(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
      </div>}
      {(upload.error || remove.error) && <p className="error">{((upload.error ?? remove.error) as Error).message}</p>}
      <div className="table-scroll">
        <div style={{ minWidth: 760, border: "1px solid #e4e7ec", borderRadius: 10, overflow: "hidden" }}>
          <div className="thead" style={{ display: "grid", gridTemplateColumns: COLS, gap: 14, padding: "10px 16px" }}>
            <span>파일명</span><span>연결된 할일</span><span>크기</span><span>올린 사람</span><span>날짜</span><span />
          </div>
          {files.length === 0 && <div className="empty">아직 첨부파일이 없어요.</div>}
          {files.map((f) => (
            <div key={f.id} style={{ display: "grid", gridTemplateColumns: COLS, gap: 14, alignItems: "center", padding: "12px 16px", borderTop: "1px solid #eef0f3" }}>
              <span className="row" style={{ minWidth: 0 }}><span className="badge badge-gray" style={{ borderRadius: 4 }}>{ext(f.name)}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span></span>
              <span style={{ fontSize: 13 }}>{f.taskTitle ?? "—"}</span>
              <span className="muted">{fileSize(f.sizeBytes)}</span>
              <span style={{ fontSize: 13 }}>{f.uploadedBy?.name}</span>
              <span className="muted">{md(f.createdAt)}</span>
              <span className="row">
                <button className="btn btn-sm" onClick={() => downloadAttachment(f.id, f.name)}>받기</button>
                {canEdit && <button className="btn btn-sm" onClick={() => confirm(`"${f.name}"을(를) 삭제할까요?`) && remove.mutate(f.id)}>삭제</button>}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// 결정 로그 ---------------------------------------------------------------------
function DecisionsTab({ projectId, canEdit }: { projectId: number; canEdit: boolean }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["decisions", projectId], queryFn: () => api.get<Decision[]>(`/projects/${projectId}/decisions`) });
  const [form, setForm] = useState({ decidedOn: todayIso(), what: "", why: "", decidedBy: "" });
  const add = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/decisions`, form),
    onSuccess: () => { setForm({ ...form, what: "", why: "" }); qc.invalidateQueries({ queryKey: ["decisions", projectId] }); },
  });
  return (
    <section className="card card-pad stack">
      <h2>결정 로그</h2>
      {canEdit && <form className="row wrap" onSubmit={(e) => { e.preventDefault(); if (form.what.trim()) add.mutate(); }}>
        <input type="date" aria-label="결정일" value={form.decidedOn} onChange={(e) => setForm({ ...form, decidedOn: e.target.value })} />
        <input className="grow" style={{ minWidth: 220 }} placeholder="무엇을 결정했나요?" value={form.what} onChange={(e) => setForm({ ...form, what: e.target.value })} />
        <input className="grow" style={{ minWidth: 180 }} placeholder="이유" value={form.why} onChange={(e) => setForm({ ...form, why: e.target.value })} />
        <input placeholder="결정한 사람·회의" value={form.decidedBy} onChange={(e) => setForm({ ...form, decidedBy: e.target.value })} />
        <button className="btn btn-primary">+ 기록</button>
      </form>}
      {data?.length === 0 && <p className="muted">"왜 이렇게 했지?"에 답할 수 있게 중요한 결정을 남겨 두세요.</p>}
      {data?.map((d) => (
        <div key={d.id} style={{ display: "grid", gridTemplateColumns: "100px minmax(0,1fr)", gap: 16, padding: "12px 0", borderTop: "1px solid #eef0f3" }}>
          <strong>{md(d.decidedOn)}</strong>
          <div><div style={{ fontSize: 15, fontWeight: 500 }}>{d.what}</div><div className="muted">이유: {d.why || "—"} · 결정: {d.decidedBy || "—"}</div></div>
        </div>
      ))}
    </section>
  );
}

// 변경 이력 ---------------------------------------------------------------------
const KIND: Record<ChangeKind, [string, string]> = {
  STATUS: ["상태", "blue"], SCHEDULE: ["일정", "orange"], ASSIGNEE: ["담당자", "gray"], CONTENT: ["내용", "gray"], CREATE: ["생성", "green"],
};

function HistoryTab({ projectId }: { projectId: number }) {
  const { data } = useQuery({ queryKey: ["history", projectId], queryFn: () => api.get<Change[]>(`/projects/${projectId}/history`) });
  const [kind, setKind] = useState<"ALL" | ChangeKind>("ALL");
  const list = (data ?? []).filter((c) => kind === "ALL" || c.kind === kind);
  const byDate = list.reduce<Record<string, Change[]>>((acc, c) => {
    const d = c.changedAt.slice(0, 10);
    (acc[d] ??= []).push(c);
    return acc;
  }, {});
  return (
    <section className="card card-pad stack">
      <div className="row wrap">
        <h2 className="grow">변경 이력 <span className="muted" style={{ fontWeight: 400 }}>· 모든 수정이 자동으로 기록돼요</span></h2>
        <Chips value={kind} onChange={setKind} options={[
          { value: "ALL", label: "전체" }, { value: "STATUS", label: "상태" }, { value: "SCHEDULE", label: "일정" },
          { value: "ASSIGNEE", label: "담당자" }, { value: "CONTENT", label: "내용" }, { value: "CREATE", label: "생성" },
        ]} />
      </div>
      {list.length === 0 && <p className="muted">아직 변경 이력이 없어요.</p>}
      {Object.entries(byDate).map(([date, items]) => (
        <div key={date}>
          <p style={{ fontSize: 13, fontWeight: 700, margin: "6px 0 4px" }}>{date}</p>
          {items.map((h) => (
            <div key={h.id} className="row wrap" style={{ padding: "10px 0", borderTop: "1px solid #eef0f3" }}>
              <span className="muted" style={{ width: 44 }}>{dateTime(h.changedAt).slice(-5)}</span>
              <span className={`badge badge-${KIND[h.kind][1]}`} style={{ borderRadius: 6 }}>{KIND[h.kind][0]}</span>
              <span className="grow" style={{ minWidth: 260 }}>
                <strong style={{ fontWeight: 500 }}>{h.changedBy?.name}</strong> · {h.entityLabel} {fieldLabel[h.field] ?? h.field}{" "}
                {h.kind !== "CREATE" && <><s style={{ color: "#8a93a1" }}>{h.oldValue ?? "없음"}</s> → </>}<strong>{h.newValue ?? "없음"}</strong>
              </span>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
