const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

export interface SessionUser {
  sub: string;
  name: string;
  role: 'ADMIN' | 'WORKER';
  lang: string;
}

export function getToken(): string | null {
  return localStorage.getItem('bf_token');
}

export function getSessionUser(): SessionUser | null {
  const raw = localStorage.getItem('bf_user');
  return raw ? (JSON.parse(raw) as SessionUser) : null;
}

export function saveSession(token: string, user: SessionUser) {
  localStorage.setItem('bf_token', token);
  localStorage.setItem('bf_user', JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem('bf_token');
  localStorage.removeItem('bf_user');
}

async function req(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401) {
    clearSession();
    window.location.href = '/';
    throw new Error('unauthorized');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? `request failed: ${res.status}`);
  return data;
}

export const api = {
  login: (body: { badgeCode?: string; pin?: string }) =>
    req('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  myJobs: () => req('/work-orders/my'),
  job: (id: string) => req(`/work-orders/${id}`),
  start: (id: string) => req(`/work-orders/${id}/start`, { method: 'POST' }),
  report: (id: string, body: { shotCount: number; goodQty: number; ngQty: number }, idempotencyKey?: string) =>
    req(`/work-orders/${id}/report`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
    }),
  complete: (id: string) => req(`/work-orders/${id}/complete`, { method: 'POST' }),
  createOrder: (body: object) => req('/work-orders', { method: 'POST', body: JSON.stringify(body) }),
  machines: () => req('/machines'),
  molds: () => req('/molds'),
  maintenanceDue: () => req('/molds/maintenance-due'),
  maintain: (id: string, note?: string) =>
    req(`/molds/${id}/maintain`, { method: 'POST', body: JSON.stringify({ note }) }),
};
