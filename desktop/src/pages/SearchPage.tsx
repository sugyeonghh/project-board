import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { SearchResult } from "../api/types";

const TYPES: [SearchResult["type"], string][] = [
  ["PROJECT", "프로젝트"], ["TASK", "할일"], ["NOTE", "노트"], ["ATTACHMENT", "첨부파일"],
  ["COMMENT", "코멘트"], ["MEMO", "메모"], ["OPS", "운영업무"], ["CHANGE", "변경 이력"],
];

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const [input, setInput] = useState(q);
  const [tab, setTab] = useState<"ALL" | SearchResult["type"]>("ALL");
  useEffect(() => setInput(q), [q]);
  const { data, isFetching } = useQuery({
    queryKey: ["search", q], enabled: q.trim().length >= 2,
    queryFn: () => api.get<SearchResult[]>(`/search?q=${encodeURIComponent(q)}`),
  });
  const results = data ?? [];

  const href = (r: SearchResult) => {
    switch (r.type) {
      case "TASK": case "COMMENT": return `/projects/${r.projectId}?task=${r.id}`;
      case "MEMO": return "/memos";
      case "OPS": return "/ops";
      default: return r.projectId ? `/projects/${r.projectId}` : "/";
    }
  };
  const highlight = (text: string) => {
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (!q || i < 0) return text;
    return <>{text.slice(0, i)}<mark>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
  };

  return (
    <>
      <h1>통합 검색</h1>
      <form onSubmit={(e) => { e.preventDefault(); setParams(input.trim() ? { q: input.trim() } : {}); }}>
        <input aria-label="통합 검색어" style={{ width: "100%", height: 52, fontSize: 16, border: "2px solid var(--accent)", borderRadius: 12 }}
               placeholder="프로젝트, 할일, 노트, 첨부파일, 코멘트, 메모, 운영업무, 변경 이력" value={input} onChange={(e) => setInput(e.target.value)} autoFocus />
      </form>
      <div className="tabs" role="tablist">
        {([["ALL", "전체"], ...TYPES] as [string, string][]).map(([v, l]) => (
          <button key={v} role="tab" aria-selected={tab === v} className={`tab ${tab === v ? "on" : ""}`} onClick={() => setTab(v as typeof tab)}>
            {l} <span className="muted">{v === "ALL" ? results.length : results.filter((r) => r.type === v).length}</span>
          </button>
        ))}
      </div>
      {q.trim().length < 2 && <div className="card empty">두 글자 이상 입력해 주세요.</div>}
      {isFetching && <div className="empty">찾는 중…</div>}
      {q.trim().length >= 2 && !isFetching && results.length === 0 && <div className="card empty">"{q}"에 대한 결과가 없어요.</div>}
      {TYPES.filter(([t]) => tab === "ALL" || tab === t).map(([t, label]) => {
        const items = results.filter((r) => r.type === t);
        if (!items.length) return null;
        return (
          <section key={t} className="card" style={{ overflow: "hidden" }}>
            <div className="thead row" style={{ padding: "12px 20px" }}><h2 style={{ fontSize: 15, color: "var(--text)" }}>{label}</h2><span>{items.length}건</span></div>
            {items.map((r) => (
              <Link key={`${r.type}${r.id}`} to={href(r)} className="list-row" style={{ display: "block", color: "var(--text)" }}>
                <div style={{ fontSize: 15 }}>{highlight(r.title)}</div>
                <div className="muted" style={{ marginTop: 3 }}>{r.context}</div>
              </Link>
            ))}
          </section>
        );
      })}
    </>
  );
}
