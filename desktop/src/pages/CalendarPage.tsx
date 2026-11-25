import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { CalendarEvent } from "../api/types";
import { daysBetween, md, toIso, todayIso } from "../lib/format";
import { Chips } from "../components/ui";

type Scope = "mine" | "all";
const SCOPE_KEY = "pm.calendar.scope";

/** 일정 종류 필터. 여러 개를 켜고 끌 수 있고, 선택은 이 PC에 기억한다. */
type Kind = "project" | "milestone" | "task" | "ops";
const KINDS: { value: Kind; label: string }[] = [
  { value: "project", label: "프로젝트 일정" },
  { value: "milestone", label: "마일스톤" },
  { value: "task", label: "할일" },
  { value: "ops", label: "운영업무" },
];
const KINDS_KEY = "pm.calendar.kinds";
const kindOf = (e: CalendarEvent): Kind =>
  e.type === "TASK" ? "task" : e.type === "MILESTONE" ? "milestone" : e.type === "OPS" ? "ops" : "project";
function loadKinds(): Set<Kind> {
  try {
    const saved = JSON.parse(localStorage.getItem(KINDS_KEY) ?? "null") as Kind[] | null;
    if (Array.isArray(saved)) return new Set(saved.filter((k) => KINDS.some((x) => x.value === k)));
  } catch { /* 저장값이 깨졌으면 전부 보기 */ }
  return new Set(KINDS.map((k) => k.value));
}

const PALETTE = ["#2f5bea", "#ea7a1a", "#7c3aed", "#dc4b4b", "#2f9e5b", "#0e7490"];

/** 기간 일정 한 줄(레인) 높이: 이름 11px + 얇은 선 3px */
const LANE_H = 17;
/** 날짜 숫자 아래에서 기간 선이 시작하는 위치 */
const LANE_TOP = 32;

const isPeriod = (e: CalendarEvent) => !!e.endDate && e.endDate > e.date;

interface Segment { e: CalendarEvent; col: number; span: number; lane: number; head: boolean; tail: boolean }

/** 한 주(7일) 안에 걸치는 기간 일정을 잘라서, 겹치지 않게 줄(레인)을 나눈다 */
function weekSegments(periods: CalendarEvent[], ws: string, we: string): { segs: Segment[]; lanes: number } {
  const laneEnds: number[] = [];
  const segs: Segment[] = [];
  const inWeek = periods
    .filter((e) => e.date <= we && e.endDate! >= ws)
    .sort((a, b) => (a.date === b.date ? b.endDate!.localeCompare(a.endDate!) : a.date.localeCompare(b.date)));
  for (const e of inWeek) {
    const s = e.date > ws ? e.date : ws;
    const t = e.endDate! < we ? e.endDate! : we;
    const col = daysBetween(ws, s);
    const span = daysBetween(s, t) + 1;
    let lane = laneEnds.findIndex((end) => end < col);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(col + span - 1); } else laneEnds[lane] = col + span - 1;
    segs.push({ e, col, span, lane, head: e.date >= ws, tail: e.endDate! <= we });
  }
  return { segs, lanes: laneEnds.length };
}

export default function CalendarPage() {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = new Date(first);
  gridStart.setDate(1 - first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); return d; });
  const weeks = Array.from({ length: 6 }, (_, i) => days.slice(i * 7, i * 7 + 7));
  const from = toIso(days[0]);
  const to = toIso(days[41]);
  // 기본은 내가 책임자·참여자인 프로젝트만. 선택은 이 PC에 기억한다.
  const [scope, setScope] = useState<Scope>(() => (localStorage.getItem(SCOPE_KEY) === "all" ? "all" : "mine"));
  const changeScope = (v: Scope) => { localStorage.setItem(SCOPE_KEY, v); setScope(v); };
  const { data } = useQuery({
    queryKey: ["calendar", from, to, scope],
    queryFn: () => api.get<CalendarEvent[]>(`/calendar?from=${from}&to=${to}&mine=${scope === "mine"}`),
  });
  const [kinds, setKinds] = useState<Set<Kind>>(loadKinds);
  const toggleKind = (k: Kind) => {
    const next = new Set(kinds);
    if (next.has(k)) next.delete(k); else next.add(k);
    localStorage.setItem(KINDS_KEY, JSON.stringify([...next]));
    setKinds(next);
  };
  const allKinds = kinds.size === KINDS.length;
  const showAllKinds = () => {
    const next = new Set(KINDS.map((k) => k.value));
    localStorage.setItem(KINDS_KEY, JSON.stringify([...next]));
    setKinds(next);
  };
  const events = (data ?? []).filter((e) => kinds.has(kindOf(e)));
  const hiddenCount = (data?.length ?? 0) - events.length;
  const periods = events.filter(isPeriod);
  const singles = events.filter((e) => !isPeriod(e));

  // 색은 필터와 상관없이 전체 일정 기준으로 정해서, 필터를 바꿔도 프로젝트 색이 그대로 유지되게 한다
  const allProjects = [...new Set((data ?? []).map((e) => e.projectName))];
  const projects = allProjects.filter((name) => events.some((e) => e.projectName === name));
  const color = (name: string) => (name === "운영업무" ? "#8a93a1" : PALETTE[allProjects.indexOf(name) % PALETTE.length]);
  const today = todayIso();
  const move = (n: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));
  // 다가오는 일정: 아직 끝나지 않은 것 (기간 일정은 진행 중이어도 포함)
  const upcoming = events.filter((e) => (e.endDate ?? e.date) >= today).slice(0, 12);
  const href = (e: CalendarEvent) => (e.projectId ? `/projects/${e.projectId}${e.type === "TASK" ? `?task=${e.id}` : ""}` : `/ops?open=${e.id}`);
  const icon = (e: CalendarEvent) => (e.type === "MILESTONE" ? "◆ " : e.type === "PROJECT" || e.type === "PROJECT_START" ? "▶ " : e.type === "PROJECT_END" ? "■ " : "");
  const bold = (e: CalendarEvent) => e.type !== "TASK" && e.type !== "OPS";
  const when = (e: CalendarEvent) => (isPeriod(e) ? `${md(e.date)} – ${md(e.endDate)}` : md(e.date));

  return (
    <>
      <div className="row wrap">
        <h1 style={{ marginRight: 8 }}>{cursor.getFullYear()}년 {cursor.getMonth() + 1}월</h1>
        <button className="btn" aria-label="이전 달" onClick={() => move(-1)}>‹</button>
        <button className="btn" aria-label="다음 달" onClick={() => move(1)}>›</button>
        <button className="btn" onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }}>오늘</button>
        <span style={{ marginLeft: 12 }}>
          <Chips<Scope> value={scope} onChange={changeScope} options={[{ value: "mine", label: "내 프로젝트" }, { value: "all", label: "전체" }]} />
        </span>
        <span className="muted" style={{ marginLeft: "auto" }}>── 기간 일정 · ▶ 프로젝트 · ◆ 마일스톤 · 할일 마감 · 운영업무 기한</span>
      </div>
      <div className="row wrap" style={{ gap: 8 }} role="group" aria-label="일정 종류 필터">
        <span className="muted" style={{ fontSize: 13, marginRight: 2 }}>보기</span>
        {KINDS.map((k) => (
          <button key={k.value} type="button" className={`chip ${kinds.has(k.value) ? "on" : ""}`} aria-pressed={kinds.has(k.value)}
                  onClick={() => toggleKind(k.value)}>
            {kinds.has(k.value) ? "✓ " : ""}{k.label}
          </button>
        ))}
        {!allKinds && <button type="button" className="btn-link" onClick={showAllKinds}>모두 보기</button>}
        {hiddenCount > 0 && <span className="muted" style={{ fontSize: 13 }}>· 이번 화면에서 {hiddenCount}건 숨김</span>}
      </div>
      <div className="row wrap" style={{ gap: 12 }}>
        {projects.map((p) => <span key={p} className="row" style={{ gap: 6, fontSize: 13 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: color(p) }} />{p}</span>)}
      </div>
      <div className="row wrap" style={{ alignItems: "flex-start", gap: 20 }}>
        <section className="card table-scroll" style={{ flex: "999 1 640px", minWidth: 0 }}>
          <div style={{ minWidth: 700 }}>
            <div className="cal thead" style={{ borderBottom: "1px solid #e4e7ec" }}>
              {"일월화수목금토".split("").map((d, i) => <span key={d} style={{ padding: "10px 12px", color: i === 0 ? "#b91c1c" : i === 6 ? "#1e40af" : undefined }}>{d}</span>)}
            </div>
            {weeks.map((week) => {
              const ws = toIso(week[0]);
              const we = toIso(week[6]);
              const { segs, lanes } = weekSegments(periods, ws, we);
              return (
                <div key={ws} style={{ position: "relative" }}>
                  <div className="cal">
                    {week.map((d) => {
                      const iso = toIso(d);
                      const inMonth = d.getMonth() === cursor.getMonth();
                      const dayEvents = singles.filter((e) => e.date === iso);
                      return (
                        <div key={iso} className="cal-cell" style={{ background: inMonth ? "#fff" : "#fafafb" }}>
                          <span style={{ alignSelf: "flex-start", minWidth: 24, height: 24, borderRadius: 999, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center",
                            ...(iso === today ? { background: "#2f5bea", color: "#fff", fontWeight: 700 } : { color: inMonth ? undefined : "#9aa1ac" }) }}>{d.getDate()}</span>
                          {/* 기간 선이 지나갈 자리 */}
                          {lanes > 0 && <span aria-hidden style={{ height: lanes * LANE_H, flex: "none" }} />}
                          {dayEvents.slice(0, 3).map((e) => (
                            <Link key={`${e.type}${e.id}`} to={href(e)} title={`${e.projectName} · ${e.title}`} className={`cal-event ${bold(e) ? "ms" : ""}`}
                                  style={{ borderLeft: 0, boxShadow: `inset 3px 0 0 ${color(e.projectName)}` }}>
                              {icon(e)}{e.title}
                            </Link>
                          ))}
                          {dayEvents.length > 3 && <span className="muted" style={{ paddingLeft: 6 }}>+{dayEvents.length - 3}개 더</span>}
                        </div>
                      );
                    })}
                  </div>
                  {segs.map(({ e, col, span, lane, head, tail }) => {
                    const c = color(e.projectName);
                    return (
                      <Link key={`${e.type}${e.id}-${ws}`} to={href(e)} title={`${e.projectName} · ${e.title} (${when(e)})`}
                            style={{ position: "absolute", top: LANE_TOP + lane * LANE_H, height: LANE_H - 2,
                              left: `calc(${(col / 7) * 100}% + ${head ? 6 : 0}px)`, width: `calc(${(span / 7) * 100}% - ${(head ? 6 : 0) + (tail ? 6 : 0)}px)`,
                              display: "flex", flexDirection: "column", justifyContent: "flex-end", color: "#374151", textDecoration: "none" }}>
                        <span style={{ fontSize: 10, lineHeight: "11px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          fontWeight: bold(e) ? 700 : 400, paddingLeft: head ? 0 : 4 }}>
                          {head ? "" : "… "}{icon(e)}{e.title}
                        </span>
                        <span style={{ height: 3, background: c, opacity: e.type === "PROJECT" ? 0.55 : 1,
                          borderRadius: `${head ? 2 : 0}px ${tail ? 2 : 0}px ${tail ? 2 : 0}px ${head ? 2 : 0}px` }} />
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </section>
        <aside className="card card-pad" style={{ flex: "1 1 280px", minWidth: 0 }}>
          <h2 style={{ fontSize: 16 }}>다가오는 일정</h2>
          {upcoming.length === 0 && <p className="muted" style={{ marginTop: 8 }}>{scope === "mine" ? "내 프로젝트에 예정된 일정이 없어요." : "예정된 일정이 없어요."}</p>}
          {upcoming.map((e) => (
            <Link key={`${e.type}${e.id}`} to={href(e)} className="row" style={{ padding: "10px 0", borderTop: "1px solid #eef0f3", color: "#111827", alignItems: "flex-start" }}>
              <span style={{ width: isPeriod(e) ? 92 : 44, fontWeight: 700, flex: "none", fontSize: isPeriod(e) ? 13 : undefined }}>{when(e)}</span>
              <span className="grow"><div style={{ fontWeight: bold(e) ? 700 : 400 }}>{icon(e)}{e.title}</div>
                <div className="muted">{e.projectName}{isPeriod(e) && e.date <= today ? " · 진행 중" : ""}</div></span>
            </Link>
          ))}
        </aside>
      </div>
    </>
  );
}
