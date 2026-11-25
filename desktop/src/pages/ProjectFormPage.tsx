import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { ProjectDetail, ProjectRequest, ProjectStatus, UserRef } from "../api/types";
import { projectStatusLabel } from "../lib/format";
import { useAuth } from "../lib/auth";

/** 새 프로젝트 / 프로젝트 편집 */
export default function ProjectFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ["users"], queryFn: () => api.get<UserRef[]>("/users") });
  const [form, setForm] = useState<ProjectRequest>({ priority: 2, status: "IN_PROGRESS" });
  const [error, setError] = useState("");
  const { user } = useAuth();
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get<ProjectDetail>(`/projects/${id}`).then((p) => {
      // 편집은 참여자(책임자 포함)만
      if (!user || !(p.owner?.id === user.id || p.members.some((m) => m.id === user.id))) { setForbidden(true); return; }
      setForm({
      name: p.name, description: p.description ?? "", goal: p.goal ?? "", scope: p.scope ?? "",
      outOfScope: p.outOfScope ?? "", doneCriteria: p.doneCriteria ?? "", stakeholders: p.stakeholders ?? "",
      status: p.status, priority: p.priority, ownerId: p.owner?.id, memberIds: p.members.map((m) => m.id),
      startDate: p.startDate ?? "", endDate: p.endDate ?? "", jiraKey: p.jiraKey ?? "",
      });
    });
  }, [id, user]);

  const set = <K extends keyof ProjectRequest>(k: K, v: ProjectRequest[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const body = { ...form, startDate: form.startDate || undefined, endDate: form.endDate || undefined };
    try {
      const saved = id ? await api.put<ProjectDetail>(`/projects/${id}`, body) : await api.post<ProjectDetail>("/projects", body);
      qc.invalidateQueries();
      navigate(`/projects/${saved.id}`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const area = (k: keyof ProjectRequest, label: string, hint: string) => (
    <label className="field">{label}
      <textarea rows={3} placeholder={hint} value={(form[k] as string) ?? ""} onChange={(e) => set(k, e.target.value as never)} />
    </label>
  );

  if (forbidden) {
    return (
      <div className="stack" style={{ maxWidth: 560 }}>
        <h1>프로젝트 편집</h1>
        <p>이 프로젝트의 참여자만 편집할 수 있어요. 편집이 필요하면 책임자에게 참여자로 추가해 달라고 요청해 주세요.</p>
        <div><button className="btn" onClick={() => navigate(`/projects/${id}`)}>프로젝트로 돌아가기</button></div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="stack" style={{ maxWidth: 860 }}>
      <h1>{id ? "프로젝트 편집" : "새 프로젝트"}</h1>
      <section className="card card-pad stack">
        <label className="field">프로젝트 이름
          <input required value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} />
        </label>
        <label className="field">한 줄 설명
          <input value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          <label className="field">상태
            <select value={form.status} onChange={(e) => set("status", e.target.value as ProjectStatus)}>
              {Object.entries(projectStatusLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="field">우선순위
            <select value={form.priority} onChange={(e) => set("priority", Number(e.target.value))}>
              <option value={1}>높음</option><option value={2}>보통</option><option value={3}>낮음</option>
            </select>
          </label>
          <label className="field">시작일<input type="date" value={form.startDate ?? ""} onChange={(e) => set("startDate", e.target.value)} /></label>
          <label className="field">종료 예정일<input type="date" value={form.endDate ?? ""} onChange={(e) => set("endDate", e.target.value)} /></label>
          <label className="field">책임자
            <select value={form.ownerId ?? ""} onChange={(e) => set("ownerId", e.target.value ? Number(e.target.value) : undefined)}>
              <option value="">(나)</option>
              {users.data?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
          <label className="field">Jira 프로젝트 키 (연동 예정)
            <input value={form.jiraKey ?? ""} onChange={(e) => set("jiraKey", e.target.value)} placeholder="예: FINPG" />
          </label>
        </div>
        <div className="field">
          <span>참여자 (함께 수정할 수 있는 사람)</span>
          <div className="row wrap" style={{ gap: 8 }}>
            {users.data?.map((u) => {
              const on = form.memberIds?.includes(u.id) ?? false;
              return (
                <button key={u.id} type="button" className={`chip ${on ? "on" : ""}`} aria-pressed={on}
                        onClick={() => set("memberIds", on ? form.memberIds!.filter((x) => x !== u.id) : [...(form.memberIds ?? []), u.id])}>
                  {u.name}
                </button>
              );
            })}
          </div>
        </div>
      </section>
      <section className="card card-pad stack">
        <h2>프로젝트 개요</h2>
        {area("goal", "목표", "예) 12월 12일까지 ○○ 연동을 운영에 반영한다")}
        {area("scope", "범위", "한 줄에 하나씩")}
        {area("outOfScope", "제외 범위", "한 줄에 하나씩")}
        {area("doneCriteria", "완료 기준", "한 줄에 하나씩")}
        {area("stakeholders", "이해관계자 · 관련 시스템", "한 줄에 하나씩")}
      </section>
      {error && <p className="error">{error}</p>}
      <div className="row"><button className="btn btn-primary">저장</button><button type="button" className="btn" onClick={() => navigate(-1)}>취소</button></div>
    </form>
  );
}
