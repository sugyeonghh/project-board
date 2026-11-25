import type { OpsCategory, ProjectStatus, TaskStatus } from "../api/types";

export const projectStatusLabel: Record<ProjectStatus, string> = {
  PLANNED: "계획", IN_PROGRESS: "진행 중", AT_RISK: "지연 위험", BLOCKED: "막힘", DONE: "완료", CANCELLED: "중단",
};
export const taskStatusLabel: Record<TaskStatus, string> = {
  TODO: "대기", IN_PROGRESS: "진행 중", BLOCKED: "막힘", DONE: "완료",
};
export const opsCategoryLabel: Record<OpsCategory, string> = {
  REQUEST: "요청 처리", INCIDENT: "장애 대응", ROUTINE: "정기 작업", SIMPLE: "단순 업무",
};
export const priorityLabel: Record<number, string> = { 1: "높음", 2: "보통", 3: "낮음" };
export const fieldLabel: Record<string, string> = {
  status: "상태", dueDate: "마감일", startDate: "시작일", assignee: "담당자", priority: "우선순위",
  title: "제목", name: "이름", endDate: "종료일", owner: "책임자", done: "완료", goal: "목표",
  scope: "범위", outOfScope: "제외 범위", doneCriteria: "완료 기준", created: "생성",
};

/** 상태값 → 배지 색 이름 (styles.css의 .badge-*) */
export function tone(status: string): string {
  switch (status) {
    case "IN_PROGRESS": case "OPEN": return "blue";
    case "AT_RISK": return "orange";
    case "BLOCKED": return "red";
    case "DONE": case "PUBLISHED": return "green";
    default: return "gray";
  }
}

export const todayIso = () => toIso(new Date());

export function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseIso(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** 2026-11-25 → 11.25 */
export function md(s: string | null | undefined): string {
  if (!s) return "—";
  const [, m, d] = s.slice(0, 10).split("-");
  return `${Number(m)}.${d}`;
}

export function dateTime(s: string): string {
  const d = new Date(s);
  return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / 86400000);
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export function ext(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "FILE" : name.slice(i + 1).toUpperCase().slice(0, 4);
}
