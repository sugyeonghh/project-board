import { useState, type FormEvent } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { ProjectSummary, YearGroup } from "../api/types";
import { useAuth } from "../lib/auth";

const MENU = [
  { to: "/", label: "대시보드", end: true },
  { to: "/my", label: "내 할일" },
  { to: "/projects", label: "프로젝트 상세" },
  { to: "/ops", label: "운영업무" },
  { to: "/reports", label: "보고서" },
  { to: "/memos", label: "메모장" },
  { to: "/calendar", label: "캘린더" },
  { to: "/settings", label: "설정" },
];

const DOT: Record<string, string> = { AT_RISK: "#ea7a1a", BLOCKED: "#dc4b4b", PLANNED: "#8a93a1" };

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  // 사이드바에는 내가 책임자·참여자인 진행 중 프로젝트만 (팀 전체는 대시보드)
  const projects = useQuery({ queryKey: ["projects", "mine"], queryFn: () => api.get<ProjectSummary[]>("/projects?mine=true") });
  const archive = useQuery({ queryKey: ["archive"], queryFn: () => api.get<YearGroup[]>("/projects/archive") });

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="logo"><span>PM</span><span>프로젝트 보드</span></NavLink>
        <form onSubmit={onSearch} className="grow" style={{ maxWidth: 420 }}>
          <input className="search-box" style={{ width: "100%" }} aria-label="통합 검색" value={q}
                 onChange={(e) => setQ(e.target.value)} placeholder="통합 검색 · 프로젝트, 할일, 노트, 파일" />
        </form>
        <div className="row" style={{ marginLeft: "auto" }}>
          <button className="btn btn-primary" onClick={() => navigate("/projects/new")}>+ 새 프로젝트</button>
          <span className="muted">{user?.displayName}</span>
          <button className="btn btn-sm" onClick={logout}>로그아웃</button>
        </div>
      </header>
      <div className="body">
        <nav className="sidebar" aria-label="메뉴">
          {MENU.map((m) => (
            <NavLink key={m.to} to={m.to} end={m.end} className={({ isActive }) => (isActive ? "active" : "")}>
              {m.label}
            </NavLink>
          ))}
          <p className="section">내 진행 중 프로젝트</p>
          {projects.data?.length === 0 && <p className="muted" style={{ fontSize: 12, padding: "2px 12px" }}>참여 중인 프로젝트가 없어요</p>}
          {projects.data?.map((p) => (
            <NavLink key={p.id} to={`/projects/${p.id}`} className={({ isActive }) => (isActive ? "active" : "")}
                     style={{ fontSize: 13 }}>
              <span className="dot" style={{ background: DOT[p.status] ?? "#2f5bea" }} />
              <span className="grow" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
            </NavLink>
          ))}
          {archive.data && archive.data.length > 0 && <p className="section">종료된 프로젝트</p>}
          {archive.data?.map((y) => (
            <NavLink key={y.year} to={`/archive?year=${y.year}`} style={{ fontSize: 13, justifyContent: "space-between" }}>
              <span>{y.year}년</span><span className="muted">{y.projects.length}건</span>
            </NavLink>
          ))}
        </nav>
        <main className="main">
          <div className="page"><Outlet /></div>
        </main>
      </div>
    </div>
  );
}
