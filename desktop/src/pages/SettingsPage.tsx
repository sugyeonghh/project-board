import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getServer } from "../api/client";
import type { AiSettings, ReportSettings, UserInfo, UserRef } from "../api/types";
import { useAuth } from "../lib/auth";
import { useTheme, type ThemePref } from "../lib/theme";

export default function SettingsPage() {
  const { user } = useAuth();
  const admin = user?.role === "ADMIN";
  return (
    <div className="stack" style={{ maxWidth: 920, gap: 20 }}>
      <h1>설정</h1>
      <ThemeSection />
      {admin && <AiSection />}
      {admin && <ReportSection />}
      {admin && <UsersSection />}
      <PasswordSection />
      <section className="card card-pad stack" style={{ gap: 10 }}>
        <h2 style={{ fontSize: 18 }}>외부 연동</h2>
        {[["Jira", "프로젝트·할일 상태 동기화, 이슈 키 연결"], ["Confluence", "일일 업무 일지·주간보고를 지정한 스페이스에 게시"]].map(([n, d]) => (
          <div key={n} className="row wrap" style={{ padding: "14px 16px", border: "1px solid var(--line)", borderRadius: 10 }}>
            <span className="grow"><div style={{ fontWeight: 500, fontSize: 15 }}>{n}</div><div className="muted">{d}</div></span>
            <span className="badge badge-gray">준비 중</span>
          </div>
        ))}
        <p className="muted">연결된 서버: {getServer()}</p>
      </section>
      {!admin && <p className="muted">AI 연결과 보고서 설정은 관리자만 바꿀 수 있어요.</p>}
    </div>
  );
}

function AiSection() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["ai-settings"], queryFn: () => api.get<AiSettings>("/settings/ai") });
  const [provider, setProvider] = useState("CLAUDE");
  const [model, setModel] = useState("");
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);
  useEffect(() => { if (data) { setProvider(data.provider); setModel(data.model); } }, [data]);

  const save = useMutation({
    mutationFn: (clearKey: boolean) => api.put<AiSettings>("/settings/ai", { provider, model, apiKey: key || null, clearKey }),
    onSuccess: () => { setKey(""); qc.invalidateQueries({ queryKey: ["ai-settings"] }); qc.invalidateQueries({ queryKey: ["ai-status"] }); },
  });
  const runTest = useMutation({ mutationFn: () => api.post<{ ok: boolean; message: string }>("/settings/ai/test"), onSuccess: setTest });

  return (
    <section className="card card-pad stack">
      <div className="row"><h2 className="grow" style={{ fontSize: 18 }}>AI 연결</h2>
        <span className={`badge badge-${data?.hasKey ? "green" : "gray"}`}>{data?.hasKey ? "키 등록됨" : "미연결"}</span></div>
      <p className="muted" style={{ fontSize: 14 }}>일일 업무 일지와 주간보고를 AI가 다듬고 요약할 때 사용해요. 키가 없어도 기본 초안은 만들 수 있어요.</p>
      {data && !data.secretKeyReady && (
        <p className="error">서버에 PMBOARD_SECRET_KEY가 설정되지 않아 키를 저장할 수 없어요. 서버 관리자에게 README의 "서버 실행" 항목을 확인해 달라고 해 주세요.</p>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
        <label className="field">AI 제공사
          <select value={provider} onChange={(e) => setProvider(e.target.value)}>
            <option value="CLAUDE">Claude (Anthropic)</option><option value="OPENAI">OpenAI</option>
          </select>
        </label>
        <label className="field">모델 (비우면 기본값)
          <input value={model} onChange={(e) => setModel(e.target.value)} placeholder={provider === "CLAUDE" ? "예: claude-sonnet-5-5" : "모델 이름 필수"} />
        </label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>API 키 {data?.hasKey && <span className="muted">(이미 등록됨 · 바꿀 때만 입력)</span>}
          <span className="row">
            <input className="grow" type={show ? "text" : "password"} autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="발급받은 API 키를 붙여넣으세요" />
            <button type="button" className="btn" onClick={() => setShow(!show)}>{show ? "숨기기" : "보기"}</button>
          </span>
        </label>
      </div>
      <p className="muted">키는 서버에 암호화해서 저장하고, 저장한 뒤에는 화면에 다시 보여주지 않아요. 보고서에 들어가는 내용만 AI로 전송돼요.</p>
      {(save.error || runTest.error) && <p className="error">{((save.error ?? runTest.error) as Error).message}</p>}
      {test && <p style={{ color: test.ok ? "var(--green-text)" : "var(--red-text)" }}>{test.message}</p>}
      <div className="row wrap">
        <button className="btn btn-primary" onClick={() => save.mutate(false)} disabled={save.isPending}>저장</button>
        <button className="btn" onClick={() => runTest.mutate()} disabled={!data?.hasKey || runTest.isPending}>{runTest.isPending ? "확인 중…" : "연결 테스트"}</button>
        {data?.hasKey && <button className="btn" onClick={() => confirm("등록된 AI 키를 삭제할까요?") && save.mutate(true)}>키 삭제</button>}
      </div>
    </section>
  );
}

function ReportSection() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["report-settings"], queryFn: () => api.get<ReportSettings>("/settings/report") });
  const [form, setForm] = useState<ReportSettings | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (data) setForm(data); }, [data]);
  const save = useMutation({
    mutationFn: () => api.put<ReportSettings>("/settings/report", form),
    onSuccess: () => { setSaved(true); qc.invalidateQueries({ queryKey: ["report-settings"] }); },
  });
  if (!form) return null;
  const set = (patch: Partial<ReportSettings>) => { setForm({ ...form, ...patch }); setSaved(false); };
  return (
    <section className="card card-pad stack">
      <h2 style={{ fontSize: 18 }}>보고서 자동 작성</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
        <label className="field">일일 업무 일지 생성 시각 (평일)
          <input type="time" value={form.dailyTime} onChange={(e) => set({ dailyTime: e.target.value })} />
        </label>
        <label className="field">주간보고 생성
          <span className="row">
            <select className="grow" value={form.weeklyDay} onChange={(e) => set({ weeklyDay: Number(e.target.value) })}>
              {["월", "화", "수", "목", "금", "토", "일"].map((d, i) => <option key={d} value={i + 1}>매주 {d}요일{i === 0 ? " (지난주)" : ""}</option>)}
            </select>
            <input type="time" aria-label="주간보고 생성 시각" value={form.weeklyTime} onChange={(e) => set({ weeklyTime: e.target.value })} />
          </span>
        </label>
        <label className="field">문체
          <select value={form.style} onChange={(e) => set({ style: e.target.value })}>
            <option value="BULLET">개조식 (~함, ~예정)</option><option value="POLITE">존댓말 문장형</option>
          </select>
        </label>
        <label className="field">만든 뒤
          <select value={form.after} onChange={(e) => set({ after: e.target.value })}>
            <option value="DRAFT">초안으로 두기</option><option value="PUBLISH">바로 게시 완료로 표시</option>
          </select>
        </label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>AI 작성 지침 (팀 양식)
          <textarea rows={6} value={form.guide} onChange={(e) => set({ guide: e.target.value })} />
        </label>
      </div>
      <div className="row"><button className="btn btn-primary" onClick={() => save.mutate()}>{saved ? "저장됨" : "저장"}</button>
        {save.error && <span className="error">{(save.error as Error).message}</span>}</div>
    </section>
  );
}

function UsersSection() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["users"], queryFn: () => api.get<UserRef[]>("/users") });
  const [form, setForm] = useState({ username: "", displayName: "", password: "", role: "USER" });
  const add = useMutation({
    mutationFn: () => api.post<UserInfo>("/users", form),
    onSuccess: () => { setForm({ username: "", displayName: "", password: "", role: "USER" }); qc.invalidateQueries({ queryKey: ["users"] }); },
  });
  return (
    <section className="card card-pad stack">
      <h2 style={{ fontSize: 18 }}>팀원 계정</h2>
      <p className="muted" style={{ fontSize: 14 }}>계정을 만들어 주면 각자 앱에서 로그인해 같은 프로젝트를 함께 관리해요.</p>
      <div className="row wrap" style={{ gap: 8 }}>{data?.map((u) => <span key={u.id} className="badge badge-gray" style={{ padding: "6px 12px" }}>{u.name}</span>)}</div>
      <form className="row wrap" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
        <input required placeholder="아이디" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <input required placeholder="이름" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
        <input required type="password" placeholder="첫 비밀번호" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="USER">팀원</option><option value="ADMIN">관리자</option></select>
        <button className="btn btn-primary">계정 만들기</button>
      </form>
      {add.error && <p className="error">{(add.error as Error).message}</p>}
    </section>
  );
}

/** 미리보기 색: [배경, 카드, 줄, 강조] */
const THEMES: { value: ThemePref; label: string; desc: string; swatch: string[][] }[] = [
  { value: "light", label: "밝은 테마", desc: "항상 밝게", swatch: [["#f6f7f9", "#ffffff", "#d5d9e0", "#2f5bea"]] },
  { value: "dark", label: "어두운 테마", desc: "항상 어둡게", swatch: [["#0f1217", "#181c24", "#3a4250", "#5b7ff0"]] },
  { value: "system", label: "시스템 설정", desc: "윈도우 설정을 따라 자동으로", swatch: [["#f6f7f9", "#ffffff", "#d5d9e0", "#2f5bea"], ["#0f1217", "#181c24", "#3a4250", "#5b7ff0"]] },
];

function ThemeSection() {
  const [pref, setPref] = useTheme();
  return (
    <section className="card card-pad stack" style={{ gap: 12 }}>
      <div>
        <h2 style={{ fontSize: 18 }}>화면 테마</h2>
        <p className="muted" style={{ marginTop: 4 }}>이 PC에만 적용돼요.</p>
      </div>
      <div className="theme-pick" role="radiogroup" aria-label="화면 테마">
        {THEMES.map((t) => (
          <button key={t.value} type="button" role="radio" aria-checked={pref === t.value}
                  className={`theme-opt${pref === t.value ? " on" : ""}`} onClick={() => setPref(t.value)}>
            <span className="theme-swatch" aria-hidden>
              {t.swatch.map(([bg, card, line, accent], i) => (
                <span key={i} style={{ background: bg }}>
                  <i style={{ background: accent, width: "45%" }} />
                  <i style={{ background: card, border: `1px solid ${line}`, height: 18 }} />
                  <i style={{ background: line, width: "70%" }} />
                </span>
              ))}
            </span>
            <span>
              <span style={{ display: "block", fontWeight: 500 }}>{pref === t.value ? "● " : ""}{t.label}</span>
              <span className="muted">{t.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function PasswordSection() {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const change = useMutation({ mutationFn: () => api.put("/me/password", { currentPassword: cur, newPassword: next }), onSuccess: () => { setCur(""); setNext(""); } });
  return (
    <section className="card card-pad stack">
      <h2 style={{ fontSize: 18 }}>내 비밀번호 변경</h2>
      <form className="row wrap" onSubmit={(e) => { e.preventDefault(); change.mutate(); }}>
        <input required type="password" placeholder="현재 비밀번호" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
        <input required type="password" placeholder="새 비밀번호" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        <button className="btn">변경</button>
        {change.isSuccess && <span style={{ color: "var(--green-text)" }}>변경했어요</span>}
        {change.error && <span className="error">{(change.error as Error).message}</span>}
      </form>
    </section>
  );
}
