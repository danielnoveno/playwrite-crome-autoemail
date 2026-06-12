// Small fetch wrapper. API base URL + token are stored in localStorage so the
// same build works when served by the local Express server (relative URLs)
// or when deployed on Vercel pointing at a tunnel URL.

export function getApiBase(): string {
  const fromEnv = (import.meta as any).env?.VITE_API_BASE || '';
  const stored = localStorage.getItem('apiBase') || '';
  return (stored || fromEnv).replace(/\/+$/, '');
}

export function getToken(): string {
  return localStorage.getItem('apiToken') || '';
}

export function saveSettings(apiBase: string, token: string) {
  localStorage.setItem('apiBase', apiBase.trim());
  localStorage.setItem('apiToken', token.trim());
}

export function screenshotUrl(name: string): string {
  const token = getToken();
  return `${getApiBase()}/api/screenshots/${encodeURIComponent(name)}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
}

export async function api<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(opts.headers as Record<string, string>) };
  if (opts.body && !(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getToken();
  if (token) headers['x-dashboard-token'] = token;

  const res = await fetch(getApiBase() + path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || `HTTP ${res.status}`);
  return data as T;
}

export const get = <T = any>(path: string) => api<T>(path);
export const post = <T = any>(path: string, body?: any) =>
  api<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined });
export const put = <T = any>(path: string, body: any) =>
  api<T>(path, { method: 'PUT', body: JSON.stringify(body) });

export interface Job {
  id: string;
  type: string;
  label: string;
  command: string;
  status: 'running' | 'stopping' | 'success' | 'failed' | 'stopped';
  exitCode: number | null;
  startedAt: string;
  endedAt: string | null;
  lineCount: number;
}

export interface LogLine { t: string; s: 'out' | 'err'; m: string; }
