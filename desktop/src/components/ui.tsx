import { useEffect, type ReactNode } from "react";
import { tone } from "../lib/format";

export function Badge({ status, children }: { status: string; children: ReactNode }) {
  return <span className={`badge badge-${tone(status)}`}>{children}</span>;
}

export function Progress({ value, color = "#2f5bea" }: { value: number; color?: string }) {
  return (
    <span className="row" style={{ gap: 8, flex: 1 }}>
      <span className="bar"><span style={{ width: `${value}%`, background: color }} /></span>
      <span style={{ fontSize: 13, fontWeight: 500, width: 38, textAlign: "right" }}>{value}%</span>
    </span>
  );
}

export function Chips<T extends string>({ value, options, onChange }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="row wrap" style={{ gap: 8 }}>
      {options.map((o) => (
        <button key={o.value} type="button" className={`chip ${o.value === value ? "on" : ""}`}
                aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Loading({ error }: { error?: unknown }) {
  if (error) return <div className="empty error">{(error as Error).message}</div>;
  return <div className="empty">불러오는 중…</div>;
}

/**
 * 앱 안에서 띄우는 확인 창. 브라우저 confirm()은 데스크톱 앱(WebView)에서 안 뜨거나 막힐 수 있어서 직접 그린다.
 * Esc 또는 바깥 클릭 = 취소. 처음 포커스는 취소 버튼에 두어 Enter 한 번으로 지워지지 않게 한다.
 */
export function ConfirmDialog({ title, children, confirmLabel = "확인", danger, busy, onConfirm, onCancel }: {
  title: string; children?: ReactNode; confirmLabel?: string; danger?: boolean; busy?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="card card-pad stack"
           style={{ width: "min(440px, 100%)", gap: 14 }}>
        <h2 id="confirm-title" style={{ fontSize: 18 }}>{title}</h2>
        {children && <div style={{ fontSize: 14, lineHeight: 1.6, color: "#374151" }}>{children}</div>}
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button className="btn" autoFocus onClick={onCancel} disabled={busy}>취소</button>
          <button className={`btn ${danger ? "btn-danger-solid" : "btn-primary"}`} onClick={onConfirm} disabled={busy}>
            {busy ? "처리 중…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
