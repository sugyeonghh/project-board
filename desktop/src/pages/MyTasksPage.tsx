import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { MyTaskItem } from "../api/types";
import { Badge, Chips, Loading } from "../components/ui";
import { md, taskStatusLabel } from "../lib/format";

const GROUPS: { key: MyTaskItem["group"]; label: string; color?: string; bg: string }[] = [
  { key: "late", label: "기한 지남", color: "var(--red-text)", bg: "var(--red-soft-2)" },
  { key: "today", label: "오늘", color: "var(--accent-strong)", bg: "var(--blue-soft)" },
  { key: "week", label: "이번 주", bg: "var(--surface-2)" },
  { key: "later", label: "다음 주 이후", bg: "var(--surface-2)" },
];
type Filter = "all" | "task" | "ops";
type View = "open" | "done";

export default function MyTasksPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<View>("open");
  const { data, error } = useQuery({
    queryKey: ["my-tasks", view],
    queryFn: () => api.get<MyTaskItem[]>(view === "done" ? "/my-tasks?done=true" : "/my-tasks"),
  });

  // 체크하면 완료 처리: 할일은 상태 DONE, 운영업무는 DONE, 정기 작업은 이번 회차 완료
  const complete = useMutation({
    mutationFn: (t: MyTaskItem) =>
      t.source === "TASK" ? api.put(`/tasks/${t.id}`, { status: "DONE" })
        : t.source === "OPS" ? api.put(`/ops/${t.id}`, { status: "DONE" })
          : api.post(`/routines/${t.id}/toggle`),
    onSuccess: () => qc.invalidateQueries(),
  });

  const items = (data ?? []).filter((t) => filter === "all" || (filter === "task" ? t.source === "TASK" : t.source !== "TASK"));
  const header = (
    <div className="row wrap">
      <div className="grow">
        <h1>내 할일</h1>
        <p className="muted" style={{ marginTop: 6, fontSize: 14 }}>프로젝트 할일 · 운영업무 · 정기 작업을 한곳에</p>
      </div>
      <Chips<View> value={view} onChange={setView} options={[{ value: "open", label: "남은 할일" }, { value: "done", label: "완료한 항목" }]} />
    </div>
  );
  const filterChips = (
    <Chips value={filter} onChange={setFilter} options={[
      { value: "all", label: "전체" }, { value: "task", label: "프로젝트 할일" }, { value: "ops", label: view === "done" ? "운영업무" : "운영업무 · 정기 작업" },
    ]} />
  );

  if (!data) return <>{header}<Loading error={error} /></>;

  if (view === "done") {
    return (
      <>
        {header}
        {filterChips}
        {items.length === 0 && <div className="card empty">완료한 항목이 없어요.</div>}
        {items.length > 0 && (
          <section className="card" style={{ overflow: "hidden" }}>
            <div className="row" style={{ padding: "14px 20px", background: "var(--green-soft-2)" }}>
              <h2 style={{ fontSize: 16 }}>완료한 항목</h2><span className="muted">{items.length}건 · 최근 완료 순</span>
            </div>
            {items.map((t) => (
              <div key={`${t.source}-${t.id}`} className="list-row">
                <span aria-hidden style={{ width: 18, textAlign: "center", color: "#2f9e5b", fontWeight: 700 }}>✓</span>
                <Link to={t.projectId ? `/projects/${t.projectId}?task=${t.id}` : t.source === "OPS" ? `/ops?open=${t.id}` : "/ops"} className="grow" style={{ color: "var(--muted)" }}>
                  <div style={{ textDecoration: "line-through" }}>{t.title}</div><div className="muted">{t.projectName}</div>
                </Link>
                <span className="muted" style={{ fontSize: 13 }}>마감 {md(t.dueDate)}</span>
                <span style={{ width: 84, textAlign: "right", fontSize: 13, color: "var(--green-text)" }}>{t.doneOn ? `${md(t.doneOn)} 완료` : "완료"}</span>
              </div>
            ))}
          </section>
        )}
      </>
    );
  }

  return (
    <>
      {header}
      <section className="grid-stats">
        {GROUPS.map((g) => (
          <div key={g.key} className="card card-pad stat">
            <p>{g.label}</p><p style={{ color: g.color }}>{items.filter((t) => t.group === g.key).length}</p>
          </div>
        ))}
      </section>
      {filterChips}
      {items.length === 0 && <div className="card empty">남은 할일이 없어요.</div>}
      {GROUPS.map((g) => {
        const list = items.filter((t) => t.group === g.key);
        if (!list.length) return null;
        return (
          <section key={g.key} className="card" style={{ overflow: "hidden" }}>
            <div className="row" style={{ padding: "14px 20px", background: g.bg }}>
              <h2 style={{ fontSize: 16 }}>{g.label}</h2><span className="muted">{list.length}건</span>
            </div>
            {list.map((t) => (
              <div key={`${t.source}-${t.id}`} className="list-row">
                <input type="checkbox" aria-label={`${t.title} 완료`} style={{ width: 18, height: 18, padding: 0 }}
                       onChange={() => complete.mutate(t)} />
                <Link to={t.projectId ? `/projects/${t.projectId}?task=${t.id}` : t.source === "OPS" ? `/ops?open=${t.id}` : "/ops"} className="grow" style={{ color: "var(--text)" }}>
                  <div>{t.title}</div><div className="muted">{t.projectName}</div>
                </Link>
                <Badge status={t.status}>{taskStatusLabel[t.status as keyof typeof taskStatusLabel] ?? "진행 중"}</Badge>
                <span style={{ width: 48, textAlign: "right", fontSize: 13, color: g.color ?? "var(--muted)", fontWeight: g.color ? 700 : 400 }}>
                  {g.key === "today" ? "오늘" : md(t.dueDate)}
                </span>
              </div>
            ))}
          </section>
        );
      })}
    </>
  );
}
