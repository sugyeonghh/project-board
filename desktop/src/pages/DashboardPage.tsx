import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Dashboard } from "../api/types";
import { Badge, Loading, Progress } from "../components/ui";
import { md, projectStatusLabel, todayIso } from "../lib/format";

const COLS = "110px 2.2fr 1fr 1.4fr 0.9fr 0.6fr 1.8fr";
const PRI_STYLE: Record<number, CSSProperties> = {
  1: { borderColor: "#f3b4b4", background: "#fdecec", color: "#9b1c1c" },
  2: { borderColor: "#f5cda7", background: "#fff6ec", color: "#9a3412" },
  3: { borderColor: "#d5d9e0", background: "#f6f7f9", color: "#374151" },
};
const BAR: Record<string, string> = { AT_RISK: "#ea7a1a", BLOCKED: "#dc4b4b" };

export default function DashboardPage() {
  const qc = useQueryClient();
  const { data, error } = useQuery({ queryKey: ["dashboard"], queryFn: () => api.get<Dashboard>("/dashboard") });
  const priority = useMutation({
    mutationFn: ({ id, value }: { id: number; value: number }) => api.patch(`/projects/${id}/priority`, { priority: value }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
  if (!data) return <Loading error={error} />;
  const active = [...data.active].sort((a, b) => a.priority - b.priority);

  return (
    <>
      <div>
        <h1>전체 프로젝트 현황</h1>
        <p className="muted" style={{ marginTop: 6, fontSize: 14 }}>{todayIso()} 기준 · 진행 중 {data.activeCount}건</p>
      </div>
      <section className="grid-stats">
        <div className="card card-pad stat"><p>진행 중 프로젝트</p><p>{data.activeCount}</p></div>
        <div className="card card-pad stat"><p>이번 주 마감 할일</p><p>{data.dueThisWeek}</p></div>
        <div className="card card-pad stat"><p>지연 위험</p><p style={{ color: "#b45309" }}>{data.atRiskCount}</p></div>
        <div className="card card-pad stat"><p>막힌 일 (Blocked)</p><p style={{ color: "#b91c1c" }}>{data.blockedCount}</p></div>
      </section>

      <section className="card">
        <div className="card-head"><h2 className="grow">진행 중 프로젝트</h2><span className="muted">우선순위 높은 순</span></div>
        <div className="table-scroll">
          <div style={{ minWidth: 1000 }}>
            <div className="thead" style={{ display: "grid", gridTemplateColumns: COLS, gap: 16, padding: "12px 20px" }}>
              <span>우선순위</span><span>프로젝트</span><span>상태</span><span>진행률</span><span>책임자</span><span>마감</span><span>다음 단계 / 막힌 일</span>
            </div>
            {active.length === 0 && <div className="empty">진행 중인 프로젝트가 없어요. 오른쪽 위 "새 프로젝트"로 시작하세요.</div>}
            {active.map((p) => (
              <div key={p.id} style={{ display: "grid", gridTemplateColumns: COLS, gap: 16, alignItems: "center", padding: "14px 20px", borderTop: "1px solid #eef0f3" }}>
                <select aria-label={`${p.name} 우선순위`} value={p.priority} style={{ height: 34, ...PRI_STYLE[p.priority] }}
                        onChange={(e) => priority.mutate({ id: p.id, value: Number(e.target.value) })}>
                  <option value={1}>● 높음</option><option value={2}>● 보통</option><option value={3}>● 낮음</option>
                </select>
                <Link to={`/projects/${p.id}`} style={{ color: "#111827", minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 15 }}>{p.name}</div>
                  <div className="muted">{p.description}</div>
                </Link>
                <span><Badge status={p.status}>{projectStatusLabel[p.status]}</Badge></span>
                <Progress value={p.progress} color={BAR[p.status]} />
                <span style={{ fontSize: 13 }}>{p.owner?.name ?? "—"}{p.memberCount > 1 ? ` 외 ${p.memberCount - 1}` : ""}</span>
                <span style={{ fontSize: 13 }}>{md(p.endDate)}</span>
                <span style={{ fontSize: 13, color: "#374151" }}>{p.nextStep ?? "—"}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 16 }}>
        <section className="card">
          <div className="card-head"><h2 className="grow">이번 주 마감 할일</h2><Link to="/my" style={{ fontSize: 13 }}>내 할일 →</Link></div>
          {data.dueTasks.length === 0 && <div className="empty">이번 주 마감인 할일이 없어요.</div>}
          {data.dueTasks.map((t) => (
            <Link key={t.id} to={`/projects/${t.projectId}?task=${t.id}`} className="list-row" style={{ color: "#111827" }}>
              <span className="grow"><div>{t.title}</div><div className="muted">{t.projectName}</div></span>
              <span className="badge badge-gray">{t.assignee?.name ?? "미지정"}</span>
              <span className="muted" style={{ width: 40, textAlign: "right" }}>{md(t.dueDate)}</span>
            </Link>
          ))}
        </section>
        <section className="card">
          <div className="card-head"><h2>막힌 일 · 리스크</h2></div>
          {data.blocked.length === 0 && <div className="empty">막힌 일이 없어요.</div>}
          {data.blocked.map((b) => (
            <Link key={b.task.id} to={`/projects/${b.task.projectId}?task=${b.task.id}`} className="list-row" style={{ color: "#111827", display: "block" }}>
              <div className="row"><span className="badge badge-red">{b.days}일째</span><strong style={{ fontWeight: 500 }}>{b.task.title}</strong></div>
              <div className="muted" style={{ marginTop: 4 }}>{b.task.projectName}{b.task.blockedReason ? ` · ${b.task.blockedReason}` : ""}</div>
            </Link>
          ))}
        </section>
      </div>

      <section className="card">
        <div className="card-head"><h2 className="grow">종료된 프로젝트</h2><Link to="/archive" style={{ fontSize: 13 }}>연도별 전체 보기 →</Link></div>
        {data.closedByYear.length === 0 && <div className="empty">아직 종료된 프로젝트가 없어요.</div>}
        {data.closedByYear.map((y) => (
          <div key={y.year}>
            <div className="thead" style={{ padding: "10px 20px", fontSize: 14, fontWeight: 700, color: "#111827", borderTop: "1px solid #eef0f3" }}>
              {y.year} <span className="muted">{y.projects.length}건</span>
            </div>
            {y.projects.map((p) => (
              <Link key={p.id} to={`/projects/${p.id}`} className="list-row" style={{ color: "#111827" }}>
                <span className="grow" style={{ fontWeight: 500 }}>{p.name}</span>
                <Badge status={p.status}>{projectStatusLabel[p.status]}</Badge>
                <span className="muted">{md(p.startDate)} – {md(p.closedOn ?? p.endDate)}</span>
                <span style={{ fontSize: 13 }}>{p.owner?.name}</span>
              </Link>
            ))}
          </div>
        ))}
      </section>
    </>
  );
}
