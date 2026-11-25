import { useState, type FormEvent } from "react";
import { getServer, setServer } from "../api/client";
import { useAuth } from "../lib/auth";

export default function LoginPage() {
  const { login } = useAuth();
  const [server, setServerUrl] = useState(getServer());
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      setServer(server.trim());
      await login(username.trim(), password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <form onSubmit={submit} className="card" style={{ width: "100%", maxWidth: 400, padding: 32, display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="logo"><span>PM</span><span>프로젝트 보드</span></div>
        <p className="muted" style={{ fontSize: 14 }}>팀 서버에 로그인해 주세요.</p>
        <label className="field">서버 주소
          <input value={server} onChange={(e) => setServerUrl(e.target.value)} placeholder="http://서버주소:8080" required />
        </label>
        <label className="field">아이디
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required autoFocus />
        </label>
        <label className="field">비밀번호
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>{busy ? "로그인 중…" : "로그인"}</button>
      </form>
    </div>
  );
}
