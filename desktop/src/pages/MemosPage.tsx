import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Memo } from "../api/types";
import { Chips, Loading } from "../components/ui";
import { md } from "../lib/format";

/** 프로젝트 밖의 개인 메모장 (본인만 보임) */
export default function MemosPage() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [tag, setTag] = useState("");
  const [filter, setFilter] = useState<"ALL" | "PIN">("ALL");
  const { data, error } = useQuery({ queryKey: ["memos"], queryFn: () => api.get<Memo[]>("/memos") });
  const refresh = () => qc.invalidateQueries({ queryKey: ["memos"] });
  const add = useMutation({ mutationFn: () => api.post("/memos", { body: draft, tag: tag || null }), onSuccess: () => { setDraft(""); refresh(); } });
  const pin = useMutation({ mutationFn: (m: Memo) => api.put(`/memos/${m.id}`, { pinned: !m.pinned }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: number) => api.del(`/memos/${id}`), onSuccess: refresh });

  if (!data) return <Loading error={error} />;
  const list = data.filter((m) => filter === "ALL" || m.pinned);
  return (
    <>
      <div>
        <h1>메모장</h1>
        <p className="muted" style={{ marginTop: 6, fontSize: 14 }}>프로젝트에 속하지 않는 생각, 회의 중 메모, 아이디어를 빠르게 적어 두는 곳 · 나만 볼 수 있어요</p>
      </div>
      <section className="card card-pad stack" style={{ gap: 10 }}>
        <textarea rows={3} aria-label="새 메모" placeholder="떠오른 내용을 바로 적어 보세요" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <div className="row">
          <input aria-label="태그" placeholder="태그 (선택)" value={tag} onChange={(e) => setTag(e.target.value)} />
          <button className="btn btn-primary" style={{ marginLeft: "auto" }} disabled={!draft.trim()} onClick={() => add.mutate()}>메모 저장</button>
        </div>
      </section>
      <Chips value={filter} onChange={setFilter} options={[{ value: "ALL", label: "전체" }, { value: "PIN", label: "고정" }]} />
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
        {list.map((m) => (
          <article key={m.id} className="card card-pad stack" style={{ gap: 12, ...(m.pinned ? { background: "#fffbeb", borderColor: "#f2e2a8" } : {}) }}>
            <div className="row">
              <span className="muted grow">{md(m.updatedAt)}</span>
              <button className="btn-link" aria-pressed={m.pinned} onClick={() => pin.mutate(m)}>{m.pinned ? "고정 해제" : "고정"}</button>
            </div>
            <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.65, flex: 1 }}>{m.body}</p>
            <div className="row" style={{ borderTop: "1px solid #eef0f3", paddingTop: 10 }}>
              {m.tag && <span className="badge badge-gray" style={{ borderRadius: 6 }}>{m.tag}</span>}
              <button className="btn-link" style={{ marginLeft: "auto", color: "#9b1c1c" }} onClick={() => confirm("메모를 삭제할까요?") && remove.mutate(m.id)}>삭제</button>
            </div>
          </article>
        ))}
      </section>
      {list.length === 0 && <div className="card empty">메모가 없어요.</div>}
    </>
  );
}
