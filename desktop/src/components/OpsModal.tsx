import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { Ops, OpsCategory, OpsStatus, UserRef } from "../api/types";
import { ConfirmDialog, Loading } from "./ui";
import { dateTime, opsCategoryLabel } from "../lib/format";

interface Form {
  title: string; category: OpsCategory; status: OpsStatus; requester: string; assigneeId: number;
  workDate: string; dueDate: string; spentMinutes: string; description: string; resolution: string;
}

const toForm = (o: Ops): Form => ({
  title: o.title, category: o.category, status: o.status, requester: o.requester ?? "", assigneeId: o.assignee?.id ?? 0,
  workDate: o.workDate, dueDate: o.dueDate ?? "", spentMinutes: o.spentMinutes != null ? String(o.spentMinutes) : "",
  description: o.description ?? "", resolution: o.resolution ?? "",
});

/**
 * 운영업무 상세 창. 요청 내용·처리 내역을 자세히 적고, 상태·담당·기한·소요 시간을 고친다.
 * 저장 버튼을 눌러야 반영되고, 고친 내용이 있는데 닫으려 하면 한 번 묻는다.
 */
export default function OpsModal({ opsId, onClose }: { opsId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, error } = useQuery({ queryKey: ["ops-item", opsId], queryFn: () => api.get<Ops>(`/ops/${opsId}`) });
  const users = useQuery({ queryKey: ["users"], queryFn: () => api.get<UserRef[]>("/users") });
  const [form, setForm] = useState<Form | null>(null);
  const [ask, setAsk] = useState<"delete" | "discard" | "convert" | null>(null);

  useEffect(() => { if (data) setForm(toForm(data)); }, [data]);
  const dirty = !!data && !!form && JSON.stringify(form) !== JSON.stringify(toForm(data));
  const tryClose = () => (dirty ? setAsk("discard") : onClose());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !ask) tryClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["ops"] });
    qc.invalidateQueries({ queryKey: ["ops-item", opsId] });
    qc.invalidateQueries({ queryKey: ["my-tasks"] });
    qc.invalidateQueries({ queryKey: ["calendar"] });
  };
  const save = useMutation({
    mutationFn: (f: Form) => api.put<Ops>(`/ops/${opsId}`, {
      title: f.title.trim(), category: f.category, status: f.status, requester: f.requester,
      assigneeId: f.assigneeId || undefined, workDate: f.workDate || undefined,
      dueDate: f.dueDate || undefined, clearDueDate: !f.dueDate,
      spentMinutes: f.spentMinutes === "" ? undefined : Number(f.spentMinutes),
      description: f.description, resolution: f.resolution,
    }),
    onSuccess: (o) => { qc.setQueryData(["ops-item", opsId], o); refresh(); },
  });
  const remove = useMutation({
    mutationFn: () => api.del(`/ops/${opsId}`),
    onSuccess: () => { refresh(); onClose(); },
  });
  const convert = useMutation({
    mutationFn: () => api.post<{ projectId: number }>(`/ops/${opsId}/convert`),
    onSuccess: (r) => { qc.invalidateQueries(); navigate(`/projects/${r.projectId}/edit`); },
  });

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const failed = (save.error ?? remove.error ?? convert.error) as Error | null;

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && tryClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label="운영업무 상세">
        <div className="dialog-head">
          <div className="grow stack" style={{ gap: 6 }}>
            <span className="muted">운영업무{data ? ` · 등록 ${dateTime(data.createdAt)}` : ""}{data?.doneAt ? ` · 완료 ${dateTime(data.doneAt)}` : ""}</span>
            <h2 style={{ fontSize: 22 }}>{data?.title ?? "운영업무"}</h2>
          </div>
          <button className="btn" onClick={tryClose}>✕ 닫기</button>
        </div>
        {!data || !form ? <Loading error={error} /> : (
          <form className="row wrap" style={{ alignItems: "flex-start", gap: 24, padding: "20px 24px 24px" }}
                onSubmit={(e) => { e.preventDefault(); if (form.title.trim()) save.mutate(form); }}>
            <div className="stack" style={{ flex: "999 1 420px", minWidth: 0, gap: 16 }}>
              <label className="field">제목
                <input required value={form.title} onChange={(e) => set("title", e.target.value)} />
              </label>
              <label className="field">요청 내용
                <textarea rows={6} placeholder={"누가, 무엇을, 왜 요청했는지\n예) 11/24 결제 실패 3건 재처리 요청 (카드사 응답 지연)"}
                          value={form.description} onChange={(e) => set("description", e.target.value)} />
              </label>
              <label className="field">처리 내역
                <textarea rows={8} placeholder={"무엇을 어떻게 처리했는지, 결과와 남은 일\n예) 11/25 10:20 재처리 완료 (3건 중 3건 성공), 요청자에게 회신"}
                          value={form.resolution} onChange={(e) => set("resolution", e.target.value)} />
              </label>
              {failed && <p className="error">{failed.message}</p>}
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-primary" disabled={!dirty || save.isPending}>{save.isPending ? "저장 중…" : "저장"}</button>
                <button type="button" className="btn" onClick={tryClose}>닫기</button>
                {save.isSuccess && !dirty && <span className="muted">저장했어요</span>}
                <button type="button" className="btn btn-danger" style={{ marginLeft: "auto" }} onClick={() => setAsk("delete")}>삭제</button>
              </div>
            </div>

            <aside style={{ flex: "1 1 250px", minWidth: 0, background: "var(--surface-2)", borderRadius: 12, padding: "16px 18px",
              display: "grid", gridTemplateColumns: "72px minmax(0,1fr)", gap: "10px 8px", alignItems: "center", fontSize: 14 }}>
              <span className="muted">상태</span>
              <select value={form.status} onChange={(e) => set("status", e.target.value as OpsStatus)}>
                <option value="OPEN">진행 중</option><option value="DONE">완료</option>
              </select>
              <span className="muted">분류</span>
              <select value={form.category} onChange={(e) => set("category", e.target.value as OpsCategory)}>
                {Object.entries(opsCategoryLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <span className="muted">요청자</span>
              <input value={form.requester} placeholder="—" onChange={(e) => set("requester", e.target.value)} />
              <span className="muted">담당자</span>
              <select value={form.assigneeId} onChange={(e) => set("assigneeId", Number(e.target.value))}>
                {form.assigneeId === 0 && <option value={0}>미지정</option>}
                {users.data?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <span className="muted">접수일</span>
              <input type="date" required value={form.workDate} onChange={(e) => set("workDate", e.target.value)} />
              <span className="muted">기한</span>
              <input type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
              <span className="muted">소요(분)</span>
              <input type="number" min={0} step={10} value={form.spentMinutes} onChange={(e) => set("spentMinutes", e.target.value)} />
              <span className="muted">프로젝트</span>
              {data.convertedProjectId
                ? <button type="button" className="btn-link" style={{ textAlign: "left" }} onClick={() => navigate(`/projects/${data.convertedProjectId}`)}>전환된 프로젝트 보기</button>
                : <button type="button" className="btn-link" style={{ textAlign: "left" }} onClick={() => setAsk("convert")}>프로젝트로 전환</button>}
            </aside>
          </form>
        )}
      </div>

      {ask === "delete" && data && (
        <ConfirmDialog title="운영업무를 삭제할까요?" confirmLabel="삭제" danger busy={remove.isPending}
                       onConfirm={() => remove.mutate()} onCancel={() => setAsk(null)}>
          <p><strong>{data.title}</strong> 기록과 요청 내용·처리 내역이 함께 지워지며 되돌릴 수 없어요.</p>
        </ConfirmDialog>
      )}
      {ask === "discard" && (
        <ConfirmDialog title="저장하지 않고 닫을까요?" confirmLabel="저장 안 하고 닫기" danger
                       onConfirm={onClose} onCancel={() => setAsk(null)}>
          <p>고친 내용이 아직 저장되지 않았어요.</p>
        </ConfirmDialog>
      )}
      {ask === "convert" && data && (
        <ConfirmDialog title="프로젝트로 전환할까요?" confirmLabel="전환" busy={convert.isPending}
                       onConfirm={() => convert.mutate()} onCancel={() => setAsk(null)}>
          <p><strong>{data.title}</strong>(으)로 새 프로젝트를 만들고 편집 화면으로 이동해요.{dirty ? " 저장하지 않은 내용은 반영되지 않아요." : ""}</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
