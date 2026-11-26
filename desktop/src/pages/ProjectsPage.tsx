import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { ProjectSummary } from "../api/types";
import { Badge, Loading, Progress } from "../components/ui";
import { md, priorityLabel, projectStatusLabel } from "../lib/format";

/** 사이드바 "프로젝트 상세": 내가 책임자·참여자인 진행 중 프로젝트를 골라 상세로 들어간다 (팀 전체는 대시보드) */
export default function ProjectsPage() {
  const { data, error } = useQuery({ queryKey: ["projects", "mine"], queryFn: () => api.get<ProjectSummary[]>("/projects?mine=true") });
  if (!data) return <Loading error={error} />;
  return (
    <>
      <div className="row"><div className="grow"><h1>내 프로젝트</h1><p className="muted" style={{ marginTop: 6, fontSize: 14 }}>내가 책임자·참여자인 진행 중 프로젝트 · 팀 전체는 대시보드에서 볼 수 있어요</p></div><Link to="/projects/new" className="btn btn-primary" style={{ lineHeight: "40px" }}>+ 새 프로젝트</Link></div>
      {data.length === 0 && <div className="card empty">참여 중인 진행 프로젝트가 없어요.</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {data.map((p) => (
          <Link key={p.id} to={`/projects/${p.id}`} className="card card-pad" style={{ color: "var(--text)", display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="row"><Badge status={p.status}>{projectStatusLabel[p.status]}</Badge><span className="muted">우선순위 {priorityLabel[p.priority]}</span></div>
            <h2>{p.name}</h2>
            <p className="muted" style={{ fontSize: 13 }}>{p.description}</p>
            <Progress value={p.progress} />
            <p className="muted">{p.owner?.name} · {md(p.startDate)} – {md(p.endDate)}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
