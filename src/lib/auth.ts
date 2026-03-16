// src/lib/auth.ts
// Shared auth helpers used by Login, Register, and other components

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  is_demo?: boolean;
  email_verified?: boolean;
  has_password?: boolean;
}

export class DemoRestrictedError extends Error {
  constructor() {
    super('demo_restricted');
    this.name = 'DemoRestrictedError';
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('sd-auth-token');
}

export function setToken(token: string): void {
  localStorage.setItem('sd-auth-token', token);
  window.dispatchEvent(new Event('sd:login'));
}

export function clearToken(): void {
  localStorage.removeItem('sd-auth-token');
  localStorage.removeItem('sd-auth-user');
}

export function getUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('sd-auth-user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setUser(user: AuthUser): void {
  localStorage.setItem('sd-auth-user', JSON.stringify(user));
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export function isDemoAccount(): boolean {
  return getUser()?.is_demo === true;
}

export async function createDemoSession(): Promise<void> {
  const res = await fetch('/api/auth/demo', { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Failed to create demo session');
  }
  const data: { token: string; user: AuthUser } = await res.json();
  setToken(data.token);
  setUser(data.user);
}

export async function apiGet<T>(path: string): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    if (err.error === 'demo_restricted') throw new DemoRestrictedError();
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    if (err.error === 'demo_restricted') throw new DemoRestrictedError();
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    if (err.error === 'demo_restricted') throw new DemoRestrictedError();
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export async function apiDelete(path: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    if (err.error === 'demo_restricted') throw new DemoRestrictedError();
    throw new Error(err.error || res.statusText);
  }
}
