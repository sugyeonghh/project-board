import { Fragment, type ReactNode } from "react";

/** 보고서·노트용 아주 작은 Markdown 표시기: 제목(#, ##, ###), 목록(-), 굵게(**), 문단만 지원 */
export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      out.push(<ul key={`ul${out.length}`}>{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>);
      list = [];
    }
  };
  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (/^\s*[-*] /.test(line)) {
      list.push(line.replace(/^\s*[-*] /, ""));
      return;
    }
    flush();
    if (line.startsWith("### ")) out.push(<h4 key={i}>{inline(line.slice(4))}</h4>);
    else if (line.startsWith("## ")) out.push(<h3 key={i}>{inline(line.slice(3))}</h3>);
    else if (line.startsWith("# ")) out.push(<h2 key={i}>{inline(line.slice(2))}</h2>);
    else if (line.trim()) out.push(<p key={i}>{inline(line)}</p>);
  });
  flush();
  return <div className="markdown">{out}</div>;
}

function inline(s: string): ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>,
  );
}
