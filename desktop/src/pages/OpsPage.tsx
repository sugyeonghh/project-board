import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Ops, OpsCategory, Routine, RoutineCycle } from "../api/types";
import { Chips, ConfirmDialog, Loading } from "../components/ui";
import OpsModal from "../components/OpsModal";
import { md, opsCategoryLabel } from "../lib/format";

const CAT_TONE: Record<OpsCategory, string> = { REQUEST: "blue", INCIDENT: "red", ROUTINE: "green", SIMPLE: "gray" };
const CYCLE: Record<RoutineCycle, string> = { DAILY: "매일", WEEKLY: "매주", MONTHLY: "매월" };
const DOW = ["", "월", "화", "수", "목", "금", "토", "일"];
/** 업무 기록 한 줄의 칸 너비. 완료 여부와 상관없이 같은 칸에 같은 너비로 놓아 줄이 어긋나지 않게 한다. */
const OPS_COLS = "76px minmax(0, 1fr) 132px 96px 112px";

export default function OpsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"ALL" | OpsCategory>("ALL");
  const [draft, setDraft] = useState({ title: "", category: "REQUEST" as OpsCategory, requester: "" });
  const [routine, setRoutine] = useState({ name: "", cycle: "WEEKLY" as RoutineCycle, day: 1 });
  const [params, setParams] = useSearchParams();
  const openId = params.get("open") ? Number(params.get("open")) : null;
  const setOpen = (id: number | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("open", String(id)); else next.delete("open");
    setParams(next, { replace: true });
  };
  const [convertAsk, setConvertAsk] = useState<Ops | null>(null);
  const ops = useQuery({ queryKey: ["ops"], queryFn: () => api.get<Ops[]>("/ops") });
  const routines = useQuery({ queryKey: ["routines"], queryFn: () => api.get<Routine[]>("/routines") });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["ops"] }); qc.invalidateQueries({ queryKey: ["routines"] }); qc.invalidateQueries({ queryKey: ["my-tasks"] }); };

  const add = useMutation({ mutationFn: () => api.post("/ops", draft), onSuccess: () => { setDraft({ ...draft, title: "", requester: "" }); refresh(); } });
  const toggle = useMutation({ mutationFn: (o: Ops) => api.put(`/ops/${o.id}`, { status: o.status === "DONE" ? "OPEN" : "DONE" }), onSuccess: refresh });
  const spent = useMutation({ mutationFn: ({ id, m }: { id: number; m: number }) => api.put(`/ops/${id}`, { spentMinutes: m }), onSuccess: refresh });
  const convert = useMutation({
    mutationFn: (id: number) => api.post<{ projectId: number }>(`/ops/${id}/convert`),
    onSuccess: (r) => { qc.invalidateQueries(); navigate(`/projects/${r.projectId}/edit`); },
  });
  const toggleRoutine = useMutation({ mutationFn: (id: number) => api.post(`/routines/${id}/toggle`), onSuccess: refresh });
  const addRoutine = useMutation({
    mutationFn: () => api.post("/routines", {
      name: routine.name, cycle: routine.cycle,
      dayOfWeek: routine.cycle === "WEEKLY" ? routine.day : undefined,
      dayOfMonth: routine.cycle === "MONTHLY" ? routine.day : undefined,
    }),
    onSuccess: () => { setRoutine({ ...routine, name: "" }); refresh(); },
  });

  if (!ops.data) return <Loading error={ops.error} />;
  const list = ops.data.filter((o) => filter === "ALL" || o.category === filter);
  const submit = (e: FormEvent) => { e.preventDefault(); if (draft.title.trim()) add.mutate(); };
  const done = ops.data.filter((o) => o.status === "DONE");

  return (
    <>
      <div>
        <h1>운영 · 단순 업무</h1>
        <p className="muted" style={{ marginTop: 6, fontSize: 14 }}>프로젝트로 만들기엔 작은 일, 요청 처리, 장애 대응, 정기 점검을 기록해요 · 커지면 프로젝트로 전환</p>
      </div>
      <form className="card card-pad row wrap" onSubmit={submit}>
        <input className="grow" style={{ minWidth: 280 }} aria-label="업무 내용" placeholder="예) BC월세 결제 실패 건 재처리 요청"
               value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        <input aria-label="요청자" placeholder="요청자 (선택)" value={draft.requester} onChange={(e) => setDraft({ ...draft, requester: e.target.value })} />
        <select aria-label="분류" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as OpsCategory })}>
          {Object.entries(opsCategoryLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button className="btn btn-primary" disabled={add.isPending}>기록</button>
      </form>

      {openId && <OpsModal opsId={openId} onClose={() => setOpen(null)} />}
      {convertAsk && (
        <ConfirmDialog title="프로젝트로 전환할까요?" confirmLabel="전환" busy={convert.isPending}
                       onConfirm={() => convert.mutate(convertAsk.id)} onCancel={() => setConvertAsk(null)}>
          <p><strong>{convertAsk.title}</strong>(으)로 새 프로젝트를 만들고 편집 화면으로 이동해요.</p>
        </ConfirmDialog>
      )}
      <div className="row wrap" style={{ alignItems: "flex-start", gap: 20 }}>
        <section className="card" style={{ flex: "999 1 560px", minWidth: 0 }}>
          <div className="card-head">
            <h2 className="grow">업무 기록 <span className="muted" style={{ fontWeight: 400 }}>최근 30일</span></h2>
            <Chips value={filter} onChange={setFilter} options={[
              { value: "ALL", label: `전체 ${ops.data.length}` },
              ...(Object.keys(opsCategoryLabel) as OpsCategory[]).map((c) => ({ value: c, label: `${opsCategoryLabel[c]} ${ops.data!.filter((o) => o.category === c).length}` })),
            ]} />
          </div>
          {list.length === 0 && <div className="empty">기록이 없어요.</div>}
          {list.length > 0 && (
            <div className="table-scroll">
              <div style={{ minWidth: 640 }}>
                {list.map((o) => {
                  const isDone = o.status === "DONE";
                  return (
                    <div key={o.id} className="list-row" style={{ display: "grid", gridTemplateColumns: OPS_COLS, gap: 12, alignItems: "center" }}>
                      <span><span className={`badge badge-${CAT_TONE[o.category]}`} style={{ borderRadius: 6 }}>{opsCategoryLabel[o.category]}</span></span>
                      <button type="button" className="ops-open" onClick={() => setOpen(o.id)} title="눌러서 상세 보기">
                        <div style={{ fontWeight: 500, color: isDone ? "#5b6472" : undefined, textDecoration: isDone ? "line-through" : undefined,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.title}</div>
                        <div className="muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          요청 {o.requester || "—"} · 담당 {o.assignee?.name ?? "—"} · {md(o.workDate)}
                          {o.description ? " · 요청 내용 ✎" : ""}{o.resolution ? " · 처리 내역 ✓" : ""}
                        </div>
                      </button>
                      <label className="row muted" style={{ gap: 6, justifyContent: "flex-end" }}>소요
                        <input type="number" min={0} step={10} style={{ width: 72, height: 34 }} defaultValue={o.spentMinutes ?? ""} key={`${o.id}-${o.spentMinutes}`}
                               onBlur={(e) => e.target.value && Number(e.target.value) !== o.spentMinutes && spent.mutate({ id: o.id, m: Number(e.target.value) })} />분
                      </label>
                      <button className={`btn btn-sm ${isDone ? "" : "btn-primary"}`} style={{ width: "100%" }} onClick={() => toggle.mutate(o)}
                              title={isDone ? "누르면 다시 진행 중으로" : undefined}>
                        {isDone ? "✓ 완료됨" : "완료 처리"}
                      </button>
                      <span style={{ textAlign: "right", fontSize: 13 }}>
                        {o.convertedProjectId ? <span className="muted">프로젝트로 전환됨</span> : (
                          <button className="btn-link" onClick={() => setConvertAsk(o)}>프로젝트로 전환</button>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <aside className="stack" style={{ flex: "1 1 300px", minWidth: 0 }}>
          <section className="card card-pad">
            <h2 style={{ fontSize: 16 }}>정기 작업</h2>
            <p className="muted" style={{ margin: "4px 0 8px" }}>주기에 맞춰 내 할일에 올라와요</p>
            {(["DAILY", "WEEKLY", "MONTHLY"] as RoutineCycle[]).map((c) => {
              const items = routines.data?.filter((r) => r.cycle === c) ?? [];
              if (!items.length) return null;
              return (
                <div key={c} style={{ padding: "8px 0", borderTop: "1px solid #eef0f3" }}>
                  <p style={{ fontSize: 12, fontWeight: 700, margin: "4px 0" }}>{CYCLE[c]}</p>
                  {items.map((r) => (
                    <label key={r.id} className="row" style={{ padding: "6px 0", cursor: "pointer" }}>
                      <input type="checkbox" checked={r.done} onChange={() => toggleRoutine.mutate(r.id)} style={{ width: 17, height: 17, padding: 0 }} />
                      <span className="grow" style={r.done ? { color: "#5b6472", textDecoration: "line-through" } : undefined}>{r.name}</span>
                      <span className="muted">{md(r.nextDue)}</span>
                    </label>
                  ))}
                </div>
              );
            })}
            <form className="stack" style={{ gap: 8, marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); if (routine.name.trim()) addRoutine.mutate(); }}>
              <input aria-label="정기 작업 이름" placeholder="새 정기 작업" value={routine.name} onChange={(e) => setRoutine({ ...routine, name: e.target.value })} />
              <div className="row">
                <select aria-label="주기" value={routine.cycle} onChange={(e) => setRoutine({ ...routine, cycle: e.target.value as RoutineCycle })}>
                  {Object.entries(CYCLE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                {routine.cycle === "WEEKLY" && (
                  <select aria-label="요일" value={routine.day} onChange={(e) => setRoutine({ ...routine, day: Number(e.target.value) })}>
                    {DOW.slice(1).map((d, i) => <option key={d} value={i + 1}>{d}요일</option>)}
                  </select>
                )}
                {routine.cycle === "MONTHLY" && (
                  <input type="number" min={1} max={31} aria-label="날짜" style={{ width: 80 }} value={routine.day}
                         onChange={(e) => setRoutine({ ...routine, day: Number(e.target.value) })} />
                )}
                <button className="btn btn-sm">추가</button>
              </div>
            </form>
          </section>
          <section className="card card-pad">
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>최근 30일 요약</h2>
            {[
              ["처리한 업무", done.length], ["장애 대응", ops.data.filter((o) => o.category === "INCIDENT").length],
              ["요청 처리", ops.data.filter((o) => o.category === "REQUEST").length],
              ["진행 중", ops.data.length - done.length],
              ["소요 시간 합계", `${Math.round(ops.data.reduce((s, o) => s + (o.spentMinutes ?? 0), 0) / 6) / 10}시간`],
            ].map(([l, v]) => (
              <div key={l} className="row" style={{ justifyContent: "space-between", padding: "6px 0" }}><span>{l}</span><strong>{typeof v === "number" ? `${v}건` : v}</strong></div>
            ))}
          </section>
        </aside>
      </div>
    </>
  );
}
