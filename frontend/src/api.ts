import { BACKEND_URL } from './config';

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.message === 'string') return body.message;
    if (Array.isArray(body?.message)) return body.message.join(', ');
  } catch {
    /* ignore */
  }
  return `Request failed (${res.status})`;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, init);
  if (!res.ok) {
    throw new ApiError(await parseErrorMessage(res), res.status);
  }

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function apiFetchNullable<T>(path: string, init?: RequestInit): Promise<T | null> {
  const res = await fetch(`${BACKEND_URL}${path}`, init);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new ApiError(await parseErrorMessage(res), res.status);
  }

  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text) as T;
}
