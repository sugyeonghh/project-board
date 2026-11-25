import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { ProjectStatus, YearGroup } from "../api/types";
import { Badge, Chips, Loading } from "../components/ui";
import { md, projectStatusLabel } from "../lib/format";

/** 종료된 프로젝트: 연도별(최신순) */
export default function ArchivePage() {
  const [params, setParams] = useSearchParams();
  const year = params.get("year") ?? "ALL";
  const result = (params.get("result") ?? "ALL") as "ALL" | ProjectStatus;
  const { data, error } = useQuery({ queryKey: ["archive"], queryFn: () => api.get<YearGroup[]>("/projects/archive") });
  if (!data) return <Loading error={error} />;
  const set = (k: string, v: string) => { const n = new URLSearchParams(params); if (v === "ALL") n.delete(k); else n.set(k, v); setParams(n); };
  const groups = data.filter((g) => year === "ALL" || String(g.year) === year)
    .map((g) => ({ ...g, projects: g.projects.filter((p) => result === "ALL" || p.status === result) }))
    .filter((g) => g.projects.length);

  return (
    <>
      <div>
        <h1>종료된 프로젝트</h1>
        <p className="muted" style={{ marginTop: 6, fontSize: 14 }}>끝난 프로젝트의 결과, 노트, 첨부파일을 연도별로 보관해요</p>
      </div>
      <div className="row wrap">
        <Chips value={year} onChange={(v) => set("year", v)} options={[{ value: "ALL", label: "전체 연도" }, ...data.map((g) => ({ value: String(g.year), label: `${g.year}년` }))]} />
        <Chips value={result} onChange={(v) => set("result", v)} options={[{ value: "ALL", label: "전체 결과" }, { value: "DONE", label: "완료" }, { value: "CANCELLED", label: "중단" }]} />
      </div>
      {groups.length === 0 && <div className="card empty">해당하는 프로젝트가 없어요.</div>}
      {groups.map((g) => (
        <section key={g.year} className="stack" style={{ gap: 14 }}>
          <div className="row" style={{ borderBottom: "2px solid #111827", paddingBottom: 8 }}>
            <h2 style={{ fontSize: 22 }}>{g.year}</h2><span className="muted">{g.projects.length}건</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {g.projects.map((p) => (
              <article key={p.id} className="card card-pad stack" style={{ gap: 10 }}>
                <div className="row"><Badge status={p.status}>{projectStatusLabel[p.status]}</Badge>
                  <span className="muted">{md(p.startDate)} – {md(p.closedOn ?? p.endDate)}</span></div>
                <h3 style={{ fontSize: 17 }}>{p.name}</h3>
                <p style={{ lineHeight: 1.6, color: "#374151" }}>{p.description}</p>
                <p className="muted">책임자 {p.owner?.name} · 할일 {p.totalCount}개 · 완료 {p.doneCount}개</p>
                <Link to={`/projects/${p.id}`} className="btn" style={{ textAlign: "center", lineHeight: "40px" }}>프로젝트 열기</Link>
              </article>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
