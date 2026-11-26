import { useEffect, useRef, useState } from "react";
import type { Milestone, Task } from "../api/types";
import { daysBetween, md, todayIso, toIso, parseIso } from "../lib/format";

/** 눈금 단위: 기간이 길수록 1주 → 2주 → 1개월 → 3개월 → 6개월 → 1년으로 넓힌다 */
type Unit = "week" | "week2" | "month" | "quarter" | "half" | "year";
const UNITS: Unit[] = ["week", "week2", "month", "quarter", "half", "year"];
const MIN_TICK_PX = 56; // 눈금 라벨 사이 최소 간격

function ticks(from: string, to: string, unit: Unit): string[] {
  const out: string[] = [];
  const cur = parseIso(from);
  if (unit === "week" || unit === "week2") {
    cur.setDate(cur.getDate() - ((cur.getDay() + 6) % 7)); // 그 주 월요일
    const step = unit === "week" ? 7 : 14;
    while (toIso(cur) <= to) {
      if (toIso(cur) >= from) out.push(toIso(cur));
      cur.setDate(cur.getDate() + step);
    }
    return out;
  }
  const months = unit === "month" ? 1 : unit === "quarter" ? 3 : unit === "half" ? 6 : 12;
  const d = new Date(cur.getFullYear(), Math.floor(cur.getMonth() / months) * months, 1); // 1·4·7·10월 등 단위의 첫 달
  while (toIso(d) <= to) {
    if (toIso(d) >= from) out.push(toIso(d));
    d.setMonth(d.getMonth() + months);
  }
  return out;
}

function tickLabel(iso: string, unit: Unit, first: boolean): string {
  if (unit === "week" || unit === "week2") return md(iso);
  const [y, m] = iso.split("-").map(Number);
  if (unit === "year") return `${y}년`;
  return first || m === 1 ? `${y}.${m}월` : `${m}월`;
}

/** 라벨 폭 추정 (11px 글꼴: 한글·전각 ≈ 11px, 그 밖 ≈ 6.5px) */
function textWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += /[\u3131-\uD79D\u3000-\u303F\uFF00-\uFFEF]/.test(ch) ? 11 : 6.5;
  return w;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

const COLOR: Record<string, string> = { DONE: "#2f9e5b", IN_PROGRESS: "#2f5bea", BLOCKED: "#dc4b4b", TODO: "var(--line-strong)" };

/** 프로젝트 상단 "일정 · 마일스톤": 주 단위 축 + 마일스톤 ◆ + 할일 막대 + 오늘 선 */
export default function ScheduleStrip({ start, end, milestones, tasks }: {
  start: string | null; end: string | null; milestones: Milestone[]; tasks: Task[];
}) {
  const [trackRef, trackWidth] = useWidth<HTMLDivElement>();
  const dated = tasks.filter((t) => t.startDate || t.dueDate);
  const all = [start, end, ...milestones.flatMap((m) => [m.startDate, m.dueDate]), ...dated.flatMap((t) => [t.startDate, t.dueDate])]
    .filter((d): d is string => !!d).sort();
  if (all.length < 2) {
    return <p className="muted">시작일·종료일, 마일스톤, 할일 날짜를 넣으면 여기에 일정이 그려져요.</p>;
  }
  const from = start ?? all[0];
  const to = end ?? all[all.length - 1];
  const span = Math.max(daysBetween(from, to) + 1, 7);
  const pct = (d: string) => `${Math.min(100, Math.max(0, (daysBetween(from, d) / span) * 100)).toFixed(2)}%`;
  const today = todayIso();
  const next = milestones.find((m) => !m.done && m.dueDate >= today);
  const isPeriod = (m: Milestone) => !!m.startDate && m.startDate < m.dueDate;
  const when = (m: Milestone) => (isPeriod(m) ? `${md(m.startDate)}–${md(m.dueDate)}` : md(m.dueDate));

  // 화면 폭에 눈금이 겹치지 않게 들어가는 가장 촘촘한 단위를 고른다
  const width = trackWidth || 600;
  const unit = UNITS.find((u) => ticks(from, to, u).length <= Math.max(2, Math.floor(width / MIN_TICK_PX))) ?? "year";
  const axis = ticks(from, to, unit);
  const frac = (d: string) => Math.min(1, Math.max(0, daysBetween(from, d) / span));

  // 마일스톤 라벨: 날짜순으로 놓되, 앞 라벨과 겹치면 아래 줄로 내린다.
  // 기간 마일스톤은 시작~종료 막대로 그리고 라벨은 막대 가운데에 둔다.
  const LANE_H = 16;
  const anchor = (m: Milestone) => (isPeriod(m) ? (frac(m.startDate!) + frac(m.dueDate)) / 2 : frac(m.dueDate));
  const placed = [...milestones].sort((a, b) => anchor(a) - anchor(b)).map((m) => {
    const label = `${m.name} ${when(m)}`;
    const f = anchor(m);
    const align: "left" | "center" | "right" = f > 0.85 ? "right" : f < 0.08 ? "left" : "center";
    const w = textWidth(label);
    const x = f * width;
    const left = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
    return { m, label, align, f, left, right: left + w };
  });
  const laneEnds: number[] = [];
  const lanes = placed.map((pl) => {
    let lane = laneEnds.findIndex((end) => end + 8 <= pl.left);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(pl.right); } else laneEnds[lane] = pl.right;
    return { ...pl, lane };
  });
  const msHeight = 26 + Math.max(1, laneEnds.length) * LANE_H + 8;

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row wrap" style={{ gap: "8px 18px" }}>
        <h2 style={{ fontSize: 16 }}>일정 · 마일스톤</h2>
        {next && <span style={{ fontSize: 13 }}>다음 마일스톤 <strong>{next.name} {when(next)} {next.startDate && next.startDate <= today ? "(진행 중)" : `(D-${daysBetween(today, next.startDate && next.startDate > today ? next.startDate : next.dueDate)})`}</strong></span>}
        {end && today <= end && <span className="muted">종료까지 {daysBetween(today, end)}일</span>}
      </div>
      <div className="table-scroll">
        <div className="gantt">
          {today >= from && today <= to && (
            <span className="today-line" style={{ left: `calc(192px + (100% - 192px) * ${(daysBetween(from, today) + 0.5) / span})` }} />
          )}
          <div className="gantt-row">
            <span />
            <div ref={trackRef} style={{ position: "relative", height: 18, fontSize: 11, color: "var(--muted)" }}>
              {axis.map((w, i) => (
                <span key={w} style={{ position: "absolute", left: pct(w), whiteSpace: "nowrap",
                  transform: frac(w) > 0.94 ? "translateX(-100%)" : undefined }}>{tickLabel(w, unit, i === 0)}</span>
              ))}
            </div>
          </div>
          <div className="gantt-row">
            <strong style={{ fontSize: 13 }}>마일스톤</strong>
            <div style={{ position: "relative", height: msHeight, background: "var(--surface-2)", borderRadius: 8 }}>
              {lanes.map(({ m, label, align, f, lane }) => {
                const left = `${(f * 100).toFixed(2)}%`;
                const shift = align === "right" ? "-100%" : align === "center" ? "-50%" : "0";
                const tone = m.done ? "#2f9e5b" : m === next ? "#ea7a1a" : "#8a93a1";
                return (
                  <span key={m.id} title={label}>
                    {isPeriod(m) ? (
                      <span style={{ position: "absolute", top: 9, height: 10, left: pct(m.startDate!), borderRadius: 5,
                        width: `${((daysBetween(m.startDate!, m.dueDate) + 1) / span) * 100}%`, minWidth: 10,
                        background: m.done ? tone : `${tone}33`, border: `2px solid ${tone}`, boxSizing: "border-box" }} />
                    ) : (
                      <span style={{ position: "absolute", top: 8, left, width: 12, height: 12, marginLeft: -6, transform: "rotate(45deg)",
                        background: m.done ? tone : "var(--card)", border: m.done ? 0 : `2px solid ${tone}` }} />
                    )}
                    {lane > 0 && <span style={{ position: "absolute", top: 22, left, width: 1, height: lane * LANE_H + 4, background: "var(--input)" }} />}
                    <span style={{ position: "absolute", top: 26 + lane * LANE_H, left, transform: `translateX(${shift})`, fontSize: 11, whiteSpace: "nowrap",
                      lineHeight: `${LANE_H}px`, padding: "0 3px", background: "var(--surface-2)", zIndex: 1, fontWeight: m === next ? 700 : 400, color: m.done ? "var(--green-text)" : "var(--text-2)" }}>{label}</span>
                  </span>
                );
              })}
            </div>
          </div>
          {dated.slice(0, 12).map((t) => {
            const a = t.startDate ?? t.dueDate!;
            const b = t.dueDate ?? t.startDate!;
            return (
              <div key={t.id} className="gantt-row">
                <span style={{ fontSize: 13, color: "var(--text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</span>
                <div className="gantt-track">
                  <span title={`${md(a)} – ${md(b)}`} style={{ left: pct(a), width: `${((daysBetween(a, b) + 1) / span) * 100}%`, background: COLOR[t.status] }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
