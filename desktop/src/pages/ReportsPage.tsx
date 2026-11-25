import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Report, ReportType } from "../api/types";
import { Chips } from "../components/ui";
import { Markdown } from "../lib/markdown";
import { md, todayIso } from "../lib/format";
import { useAuth } from "../lib/auth";

type Tab = "DAILY" | "WEEKLY" | "ARCHIVE";
const SECTIONS: { key: string; daily: string; weekly: string }[] = [
  { key: "done", daily: "오늘 한 일", weekly: "금주 완료" },
  { key: "doing", daily: "진행 중", weekly: "진행 중" },
  { key: "ops", daily: "운영업무", weekly: "운영업무" },
  { key: "changes", daily: "변경 사항", weekly: "변경 사항" },
  { key: "blocked", daily: "이슈 · 막힌 일", weekly: "이슈 및 요청사항" },
  { key: "next", daily: "내일 할 일", weekly: "차주 계획" },
];

export default function ReportsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("DAILY");
  const [date, setDate] = useState(todayIso());
  const [include, setInclude] = useState<string[]>(SECTIONS.map((s) => s.key));
  const [report, setReport] = useState<Report | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const ai = useQuery({ queryKey: ["ai-status"], queryFn: () => api.get<{ connected: boolean; provider: string }>("/reports/ai-status") });
  const connected = ai.data?.connected ?? false;

  const generate = useMutation({
    mutationFn: (useAi: boolean) => api.post<Report>("/reports/generate", { type: tab as ReportType, date, useAi, include }),
    onSuccess: (r) => { setReport(r); setEdit(null); setCopied(false); qc.invalidateQueries({ queryKey: ["reports"] }); },
  });
  const save = useMutation({
    mutationFn: (body: { content?: string; status?: string }) => api.put<Report>(`/reports/${report!.id}`, body),
    onSuccess: (r) => { setReport(r); setEdit(null); qc.invalidateQueries({ queryKey: ["reports"] }); },
  });

  useEffect(() => { setReport(null); setEdit(null); }, [tab]);

  const copy = async () => {
    await navigator.clipboard.writeText(report!.content);
    setCopied(true);
  };

  return (
    <>
      <div className="row wrap">
        <div className="grow">
          <h1>보고서 자동 작성</h1>
          <p className="muted" style={{ marginTop: 6, fontSize: 14 }}>할일·운영업무·변경 이력을 모아 일일 업무 일지와 주간보고 초안을 만들어요</p>
        </div>
        <span className={`badge badge-${connected ? "green" : "gray"}`} style={{ padding: "8px 12px" }}>
          {connected ? `AI 연결됨 · ${ai.data?.provider}` : "AI 미연결"}
        </span>
      </div>
      {!connected && tab !== "ARCHIVE" && (
        <div className="row wrap" style={{ padding: "14px 18px", borderRadius: 12, background: "#fff8e6", border: "1px solid #f2dfa6" }}>
          <span className="grow" style={{ minWidth: 300, color: "#5c4a12", lineHeight: 1.6 }}>
            AI가 아직 연결되지 않았어요. 지금은 데이터를 양식에 맞춰 정리한 <strong>기본 초안</strong>만 만들 수 있어요.
            {user?.role === "ADMIN" ? " 설정에서 API 키를 연결하면 AI가 문장을 다듬고 요약해 줘요." : " 관리자에게 AI 연결을 요청해 주세요."}
          </span>
          {user?.role === "ADMIN" && <Link to="/settings" className="btn" style={{ lineHeight: "40px" }}>설정에서 AI 연결하기 →</Link>}
        </div>
      )}
      <div className="tabs" role="tablist">
        {([["DAILY", "일일 업무 일지"], ["WEEKLY", "주간보고"], ["ARCHIVE", "모아보기"]] as [Tab, string][]).map(([v, l]) => (
          <button key={v} role="tab" aria-selected={tab === v} className={`tab ${tab === v ? "on" : ""}`} onClick={() => setTab(v)}>{l}</button>
        ))}
      </div>

      {tab === "ARCHIVE" ? <Archive onOpen={(r) => { setTab(r.type); setTimeout(() => setReport(r)); }} /> : (
        <div className="row wrap" style={{ alignItems: "flex-start", gap: 20 }}>
          <aside className="stack" style={{ flex: "1 1 300px", minWidth: 0 }}>
            <section className="card card-pad stack" style={{ gap: 14 }}>
              <h2 style={{ fontSize: 16 }}>작성 옵션</h2>
              <label className="field">{tab === "DAILY" ? "날짜" : "그 주의 아무 날짜"}
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <div>
                <p style={{ fontSize: 13, marginBottom: 4 }}>포함할 내용</p>
                {SECTIONS.map((s) => (
                  <label key={s.key} className="row" style={{ padding: "6px 0", cursor: "pointer" }}>
                    <input type="checkbox" style={{ width: 17, height: 17, padding: 0 }} checked={include.includes(s.key)}
                           onChange={() => setInclude(include.includes(s.key) ? include.filter((k) => k !== s.key) : [...include, s.key])} />
                    {tab === "DAILY" ? s.daily : s.weekly}
                  </label>
                ))}
              </div>
            </section>
            <section className="card card-pad stack" style={{ gap: 10 }}>
              <button className="btn btn-primary" style={{ height: 46 }} disabled={!connected || generate.isPending} onClick={() => generate.mutate(true)}>AI로 작성</button>
              <button className="btn" style={{ height: 46 }} disabled={generate.isPending} onClick={() => generate.mutate(false)}>기본 초안 만들기 (AI 없이)</button>
              <p className="muted">설정한 시각에 자동으로도 만들어져요{user?.role === "ADMIN" ? " · 설정에서 변경" : ""}</p>
            </section>
          </aside>

          <section className="card" style={{ flex: "999 1 520px", minWidth: 0 }}>
            <div className="card-head">
              <h2 className="grow" style={{ fontSize: 16 }}>{tab === "DAILY" ? "일일 업무 일지" : "주간보고"} 초안</h2>
              {report && (
                <>
                  <span className={`badge badge-${report.method === "AI" ? "blue" : "gray"}`}>{report.method === "AI" ? "AI 작성" : "기본 초안"}</span>
                  <span className={`badge badge-${report.status === "PUBLISHED" ? "green" : "orange"}`}>{report.status === "PUBLISHED" ? "게시됨" : "초안"}</span>
                  {edit === null && <button className="btn btn-sm" onClick={() => setEdit(report.content)}>편집</button>}
                  <button className="btn btn-sm" onClick={copy}>{copied ? "복사됨" : "복사"}</button>
                  {report.status === "DRAFT" && <button className="btn btn-sm btn-primary" onClick={() => save.mutate({ status: "PUBLISHED" })}>게시 완료로 표시</button>}
                </>
              )}
            </div>
            {generate.isPending && <div className="empty" style={{ color: "#1e40af" }}>자료를 모아 정리하는 중…</div>}
            {generate.error && <p className="error" style={{ padding: 20 }}>{(generate.error as Error).message}</p>}
            {!report && !generate.isPending && <div className="empty">왼쪽에서 옵션을 고르고 작성 버튼을 눌러 주세요.</div>}
            {report && !generate.isPending && (edit === null ? (
              <div style={{ padding: "22px 26px 28px" }}><Markdown text={report.content} /></div>
            ) : (
              <div className="stack" style={{ padding: 20 }}>
                <textarea rows={22} value={edit} onChange={(e) => setEdit(e.target.value)} />
                <div className="row"><button className="btn btn-primary" onClick={() => save.mutate({ content: edit })}>저장</button>
                  <button className="btn" onClick={() => setEdit(null)}>취소</button></div>
              </div>
            ))}
          </section>
        </div>
      )}
    </>
  );
}

function Archive({ onOpen }: { onOpen: (r: Report) => void }) {
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [month, setMonth] = useState(months[0]);
  const [kind, setKind] = useState<"ALL" | ReportType>("ALL");
  const [open, setOpen] = useState<number | null>(null);
  const { data } = useQuery({ queryKey: ["reports", month], queryFn: () => api.get<Report[]>(`/reports?month=${month}`) });
  const list = (data ?? []).filter((r) => kind === "ALL" || r.type === kind);

  // 같은 주(월요일 기준)끼리 묶기
  const weeks = new Map<string, Report[]>();
  list.forEach((r) => {
    const d = new Date(r.periodStart);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const key = `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, "0")} 주`;
    weeks.set(key, [...(weeks.get(key) ?? []), r]);
  });

  return (
    <div className="row wrap" style={{ alignItems: "flex-start", gap: 20 }}>
      <nav className="card stack" style={{ flex: "1 1 200px", padding: 12, gap: 2 }} aria-label="월 선택">
        <p style={{ fontSize: 13, fontWeight: 700, margin: "4px 8px 8px" }}>월별 보관함</p>
        {months.map((m) => (
          <button key={m} className={`chip ${m === month ? "on" : ""}`} style={{ border: 0, borderRadius: 8, textAlign: "left", height: 40 }}
                  onClick={() => setMonth(m)}>{m.replace("-", "년 ")}월</button>
        ))}
      </nav>
      <section className="stack" style={{ flex: "999 1 560px", minWidth: 0 }}>
        <div className="row wrap">
          <h2 className="grow" style={{ fontSize: 20 }}>{month.replace("-", "년 ")}월 보고서</h2>
          <Chips value={kind} onChange={setKind} options={[{ value: "ALL", label: "전체" }, { value: "DAILY", label: "일일 일지" }, { value: "WEEKLY", label: "주간보고" }]} />
        </div>
        <div className="grid-stats">
          <div className="card card-pad stat"><p>일일 업무 일지</p><p>{data?.filter((r) => r.type === "DAILY").length ?? 0}</p></div>
          <div className="card card-pad stat"><p>주간보고</p><p>{data?.filter((r) => r.type === "WEEKLY").length ?? 0}</p></div>
          <div className="card card-pad stat"><p>게시됨</p><p>{data?.filter((r) => r.status === "PUBLISHED").length ?? 0}</p></div>
          <div className="card card-pad stat"><p>초안 (미게시)</p><p>{data?.filter((r) => r.status === "DRAFT").length ?? 0}</p></div>
        </div>
        {list.length === 0 && <div className="card empty">이 달의 보고서가 없어요.</div>}
        {[...weeks.entries()].map(([label, items]) => (
          <div key={label} className="card" style={{ overflow: "hidden" }}>
            <div className="thead" style={{ padding: "10px 18px", fontSize: 14, fontWeight: 700, color: "#111827" }}>{label}</div>
            {items.map((r) => (
              <div key={r.id} style={{ borderTop: "1px solid #eef0f3" }}>
                <button className="list-row clickable" aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)}>
                  <span style={{ width: 60, fontSize: 13 }}>{md(r.periodStart)}</span>
                  <span className={`badge badge-${r.type === "WEEKLY" ? "blue" : "gray"}`} style={{ borderRadius: 6 }}>{r.type === "WEEKLY" ? "주간보고" : "일일 일지"}</span>
                  <span className="grow">{r.title}</span>
                  <span className={`badge badge-${r.status === "PUBLISHED" ? "green" : "orange"}`}>{r.status === "PUBLISHED" ? "게시됨" : "초안"}</span>
                </button>
                {open === r.id && (
                  <div className="row wrap" style={{ padding: "4px 18px 14px 96px", fontSize: 13 }}>
                    <span className="grow muted">{r.content.split("\n").filter((l) => l.startsWith("- ")).length}개 항목 · {r.method === "AI" ? "AI 작성" : "기본 초안"}</span>
                    <button className="btn btn-sm" onClick={() => onOpen(r)}>열기</button>
                    <button className="btn btn-sm" onClick={() => navigator.clipboard.writeText(r.content)}>복사</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}
