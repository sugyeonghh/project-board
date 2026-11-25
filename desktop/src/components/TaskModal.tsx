import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Comment, TaskDetail, TaskRequest, TaskStatus, UserRef } from "../api/types";
import { Badge, ConfirmDialog, Loading } from "./ui";
import { useAuth } from "../lib/auth";
import { dateTime, ext, fieldLabel, fileSize, taskStatusLabel } from "../lib/format";
import { downloadAttachment } from "../lib/download";

/**
 * 할일 상세 팝업. 닫기 버튼·바깥 클릭·Esc로 닫는다.
 * canEdit=false(프로젝트 참여자가 아님)면 읽기 전용: 코멘트도 쓸 수 없다.
 * participants: 담당자로 고를 수 있는 사람 (책임자 + 참여자)
 */
export default function TaskModal({ taskId, onClose, canEdit = true, participants }: {
  taskId: number; onClose: () => void; canEdit?: boolean; participants: UserRef[];
}) {
  const { user } = useAuth();
  const [editComment, setEditComment] = useState<{ id: number; body: string } | null>(null);
  const [delComment, setDelComment] = useState<Comment | null>(null);
  const qc = useQueryClient();
  const key = ["task", taskId];
  const { data, error } = useQuery({ queryKey: key, queryFn: () => api.get<TaskDetail>(`/tasks/${taskId}`) });
  const [comment, setComment] = useState("");
  const [newCheck, setNewCheck] = useState("");
  const [desc, setDesc] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["project-tasks"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["my-tasks"] });
  };
  const update = useMutation({ mutationFn: (req: TaskRequest) => api.put(`/tasks/${taskId}`, req), onSuccess: refresh });
  const addCheck = useMutation({ mutationFn: (text: string) => api.post(`/tasks/${taskId}/checklist`, { text }), onSuccess: refresh });
  const toggleCheck = useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) => api.patch(`/checklist/${id}`, { done }), onSuccess: refresh,
  });
  const addComment = useMutation({ mutationFn: (body: string) => api.post(`/tasks/${taskId}/comments`, { body }), onSuccess: refresh });
  const updateComment = useMutation({
    mutationFn: (v: { id: number; body: string }) => api.put(`/comments/${v.id}`, { body: v.body }),
    onSuccess: () => { setEditComment(null); refresh(); },
  });
  const deleteComment = useMutation({
    mutationFn: (id: number) => api.del(`/comments/${id}`),
    onSuccess: () => { setDelComment(null); refresh(); },
  });
  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api.upload(`/projects/${data!.task.projectId}/attachments?taskId=${taskId}`, form);
    },
    onSuccess: () => { refresh(); qc.invalidateQueries({ queryKey: ["attachments"] }); },
  });

  const t = data?.task;
  const done = data?.checklist.filter((c) => c.done).length ?? 0;
  const failed = update.error ?? addCheck.error ?? addComment.error ?? updateComment.error ?? deleteComment.error ?? upload.error;
  // 지금 담당자가 참여자 목록에 없으면(예전 데이터) 그대로 보이도록 목록에 덧붙인다
  const assigneeOptions = t?.assignee && !participants.some((u) => u.id === t.assignee!.id)
    ? [...participants, { ...t.assignee, name: `${t.assignee.name} (참여자 아님)` }] : participants;

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label="할일 상세">
        <div className="dialog-head">
          <div className="grow stack" style={{ gap: 8 }}>
            {t && (
              <div className="row wrap muted">
                <Badge status={t.status}>{taskStatusLabel[t.status]}</Badge>
                <span>{t.projectName}</span><span>·</span><span>{t.jiraKey ? `Jira ${t.jiraKey}` : "Jira 연동 전"}</span>
              </div>
            )}
            <h2 style={{ fontSize: 22 }}>{t?.title ?? "할일"}</h2>
          </div>
          <button className="btn" onClick={onClose}>✕ 닫기</button>
        </div>
        {!data || !t ? <Loading error={error} /> : (
          <div className="row wrap" style={{ alignItems: "flex-start", gap: 24, padding: "20px 24px 28px" }}>
            <div className="stack" style={{ flex: "999 1 420px", minWidth: 0, gap: 22 }}>
              {failed && <p className="error">{(failed as Error).message}</p>}
              <section className="stack" style={{ gap: 6 }}>
                <h3>설명</h3>
                {desc === null || !canEdit ? (
                  <p style={{ lineHeight: 1.75, whiteSpace: "pre-wrap", cursor: canEdit ? "text" : undefined }}
                     onClick={() => canEdit && setDesc(t.description ?? "")}>
                    {t.description || <span className="muted">{canEdit ? "눌러서 설명을 적어 주세요." : "설명이 없어요."}</span>}
                  </p>
                ) : (
                  <>
                    <textarea rows={5} value={desc} onChange={(e) => setDesc(e.target.value)} autoFocus />
                    <div className="row">
                      <button className="btn btn-sm btn-primary" onClick={() => { update.mutate({ description: desc }); setDesc(null); }}>저장</button>
                      <button className="btn btn-sm" onClick={() => setDesc(null)}>취소</button>
                    </div>
                  </>
                )}
              </section>
              {t.status === "BLOCKED" && (
                <section style={{ background: "#fdf3f3", borderRadius: 10, padding: "14px 16px" }}>
                  <h3 style={{ fontSize: 13, color: "#9b1c1c", marginBottom: 6 }}>막힌 이유{t.blockedSince ? ` (${t.blockedSince}부터)` : ""}</h3>
                  <textarea rows={2} style={{ width: "100%" }} readOnly={!canEdit} defaultValue={t.blockedReason ?? ""} placeholder="누구의 무엇을 기다리는지 적어 주세요"
                            onBlur={(e) => e.target.value !== (t.blockedReason ?? "") && update.mutate({ blockedReason: e.target.value })} />
                </section>
              )}
              <section>
                <div className="row" style={{ marginBottom: 4 }}><h3 className="grow">세부 체크리스트</h3><span className="muted">{done} / {data.checklist.length} 완료</span></div>
                {data.checklist.map((c) => (
                  <label key={c.id} className="row" style={{ padding: "9px 0", borderTop: "1px solid #eef0f3", cursor: "pointer" }}>
                    <input type="checkbox" checked={c.done} disabled={!canEdit} style={{ width: 18, height: 18, padding: 0 }}
                           onChange={() => toggleCheck.mutate({ id: c.id, done: !c.done })} />
                    <span style={c.done ? { color: "#5b6472", textDecoration: "line-through" } : undefined}>{c.text}</span>
                  </label>
                ))}
                {canEdit && <form className="row" style={{ marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); if (newCheck.trim()) { addCheck.mutate(newCheck.trim()); setNewCheck(""); } }}>
                  <input className="grow" aria-label="체크리스트 항목" placeholder="항목 추가" value={newCheck} onChange={(e) => setNewCheck(e.target.value)} />
                  <button className="btn btn-sm">추가</button>
                </form>}
              </section>
              <section className="stack" style={{ gap: 12 }}>
                <h3>코멘트</h3>
                {data.comments.length === 0 && <p className="muted">아직 코멘트가 없어요.</p>}
                {data.comments.map((c) => {
                  const mine = canEdit && c.author.id === user?.id;
                  return (
                    <div key={c.id} className="row" style={{ alignItems: "flex-start" }}>
                      <span style={{ width: 30, height: 30, borderRadius: "50%", background: "#e8eefd", color: "#1e40af", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{c.author.name.slice(0, 1)}</span>
                      <div className="grow" style={{ minWidth: 0 }}>
                        <div className="row" style={{ fontSize: 13, gap: 6 }}>
                          <strong>{c.author.name}</strong>
                          <span className="muted">{dateTime(c.createdAt)}{c.updatedAt ? " · 수정됨" : ""}</span>
                          {mine && editComment?.id !== c.id && (
                            <span className="row" style={{ marginLeft: "auto", gap: 10 }}>
                              <button className="btn-link" style={{ padding: 0 }} onClick={() => { updateComment.reset(); setEditComment({ id: c.id, body: c.body }); }}>수정</button>
                              <button className="btn-link" style={{ padding: 0, color: "#b91c1c" }} onClick={() => { deleteComment.reset(); setDelComment(c); }}>삭제</button>
                            </span>
                          )}
                        </div>
                        {editComment?.id === c.id ? (
                          <form className="stack" style={{ gap: 6, marginTop: 4 }}
                                onSubmit={(e) => { e.preventDefault(); if (editComment.body.trim()) updateComment.mutate({ id: c.id, body: editComment.body.trim() }); }}>
                            <textarea rows={3} aria-label="코멘트 수정" value={editComment.body} autoFocus
                                      onChange={(e) => setEditComment({ ...editComment, body: e.target.value })} />
                            <div className="row" style={{ gap: 6 }}>
                              <button className="btn btn-sm btn-primary" disabled={updateComment.isPending}>저장</button>
                              <button type="button" className="btn btn-sm" onClick={() => setEditComment(null)}>취소</button>
                            </div>
                          </form>
                        ) : <div style={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{c.body}</div>}
                      </div>
                    </div>
                  );
                })}
                {canEdit ? (
                  <form className="row" onSubmit={(e) => { e.preventDefault(); if (comment.trim()) { addComment.mutate(comment.trim()); setComment(""); } }}>
                    <input className="grow" aria-label="코멘트 입력" placeholder="코멘트 남기기" value={comment} onChange={(e) => setComment(e.target.value)} />
                    <button className="btn btn-primary">등록</button>
                  </form>
                ) : <p className="muted" style={{ fontSize: 13 }}>코멘트는 이 프로젝트의 참여자만 남길 수 있어요.</p>}
                {delComment && (
                  <ConfirmDialog title="코멘트를 삭제할까요?" confirmLabel="삭제" danger busy={deleteComment.isPending}
                                 onConfirm={() => deleteComment.mutate(delComment.id)} onCancel={() => setDelComment(null)}>
                    <p style={{ whiteSpace: "pre-wrap" }}>{delComment.body.length > 120 ? delComment.body.slice(0, 120) + "…" : delComment.body}</p>
                    <p style={{ color: "#b91c1c", marginTop: 6 }}>삭제한 뒤에는 되돌릴 수 없어요.</p>
                  </ConfirmDialog>
                )}
              </section>
              <section>
                <h3 style={{ marginBottom: 6 }}>변경 이력</h3>
                {data.history.length === 0 && <p className="muted">아직 변경 이력이 없어요.</p>}
                {data.history.slice(0, 10).map((h) => (
                  <p key={h.id} style={{ fontSize: 13, padding: "6px 0", borderTop: "1px solid #eef0f3" }}>
                    <span className="muted">{dateTime(h.changedAt)}</span> {h.changedBy?.name} · {fieldLabel[h.field] ?? h.field}{" "}
                    {h.kind !== "CREATE" && <><s style={{ color: "#8a93a1" }}>{label(h.field, h.oldValue)}</s> → </>}<strong>{label(h.field, h.newValue)}</strong>
                  </p>
                ))}
              </section>
            </div>

            <aside className="stack" style={{ flex: "1 1 250px", minWidth: 0, gap: 18 }}>
              <section style={{ background: "#f9fafb", borderRadius: 12, padding: "16px 18px", display: "grid", gridTemplateColumns: "72px minmax(0,1fr)", gap: "10px 8px", alignItems: "center", fontSize: 14 }}>
                <span className="muted">상태</span>
                <select disabled={!canEdit} value={t.status} onChange={(e) => update.mutate({ status: e.target.value as TaskStatus })}>
                  {Object.entries(taskStatusLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <span className="muted">담당자</span>
                <select disabled={!canEdit} value={t.assignee?.id ?? 0} onChange={(e) => update.mutate({ assigneeId: Number(e.target.value) })}>
                  <option value={0}>미지정</option>
                  {assigneeOptions.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <span className="muted">우선순위</span>
                <select disabled={!canEdit} value={t.priority} onChange={(e) => update.mutate({ priority: Number(e.target.value) })}>
                  <option value={1}>높음</option><option value={2}>보통</option><option value={3}>낮음</option>
                </select>
                <span className="muted">시작일</span>
                <input type="date" disabled={!canEdit} value={t.startDate ?? ""} onChange={(e) => e.target.value && update.mutate({ startDate: e.target.value })} />
                <span className="muted">마감일</span>
                <input type="date" disabled={!canEdit} value={t.dueDate ?? ""} onChange={(e) => e.target.value && update.mutate({ dueDate: e.target.value })} />
                <span className="muted">선행</span><span>{t.dependsOn.map((d) => d.title).join(", ") || "—"}</span>
                <span className="muted">후행</span><span>{data.dependents.map((d) => d.title).join(", ") || "—"}</span>
              </section>
              <section className="stack" style={{ gap: 8 }}>
                <h3>첨부파일</h3>
                {data.attachments.map((a) => (
                  <button key={a.id} className="row btn-link" style={{ color: "#111827", textAlign: "left" }} onClick={() => downloadAttachment(a.id, a.name)}>
                    <span className="badge badge-gray" style={{ borderRadius: 4 }}>{ext(a.name)}</span>
                    <span className="grow">{a.name}</span><span className="muted">{fileSize(a.sizeBytes)}</span>
                  </button>
                ))}
                {data.attachments.length === 0 && !canEdit && <p className="muted">첨부파일이 없어요.</p>}
                {canEdit && <>
                  <input ref={fileRef} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ""; }} />
                  <button className="btn btn-sm" style={{ borderStyle: "dashed" }} onClick={() => fileRef.current?.click()}>
                    {upload.isPending ? "올리는 중…" : "+ 파일 첨부"}
                  </button>
                </>}
              </section>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function label(field: string, v: string | null) {
  if (v == null) return "없음";
  if (field === "status") return taskStatusLabel[v as TaskStatus] ?? v;
  if (field === "priority") return ({ "1": "높음", "2": "보통", "3": "낮음" } as Record<string, string>)[v] ?? v;
  return v;
}
