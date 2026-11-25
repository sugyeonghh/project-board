// 서버 호출. 서버 주소와 로그인 토큰은 이 PC에만 저장된다.

const SERVER_KEY = "pm.server";
const TOKEN_KEY = "pm.token";

export const DEFAULT_SERVER = "http://localhost:8080";

export function getServer(): string {
  return localStorage.getItem(SERVER_KEY) || DEFAULT_SERVER;
}
export function setServer(url: string) {
  localStorage.setItem(SERVER_KEY, url.replace(/\/+$/, ""));
}
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** 토큰 만료 등으로 401이 오면 로그인 화면으로 돌려보낸다 */
export const UNAUTHORIZED_EVENT = "pm:unauthorized";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch(`${getServer()}/api${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, "서버에 연결할 수 없어요. 서버 주소와 네트워크를 확인해 주세요.");
  }
  if (res.status === 401 && path !== "/auth/login") {
    setToken(null);
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
  if (!res.ok) {
    let message = `요청 실패 (${res.status})`;
    try {
      const data = await res.json();
      if (data?.message) message = data.message;
    } catch {
      /* 본문 없음 */
    }
    throw new ApiError(res.status, message);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
  upload: <T>(path: string, form: FormData) => request<T>("POST", path, form),
  /** 첨부파일 내려받기용: 인증 헤더를 붙여 Blob으로 받는다 */
  async blob(path: string): Promise<Blob> {
    const res = await fetch(`${getServer()}/api${path}`, {
      headers: { Authorization: `Bearer ${getToken() ?? ""}` },
    });
    if (!res.ok) throw new ApiError(res.status, "파일을 받지 못했어요.");
    return res.blob();
  },
};
