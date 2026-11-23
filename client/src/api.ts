import type { BootstrapResponse, RfqDocument } from '../../shared/schema.js';

const baseUrl = import.meta.env.BASE_URL || '/';
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)
  || (baseUrl !== '/' ? `${baseUrl.replace(/\/$/, '')}/api` : '/api');

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function getBootstrap(): Promise<BootstrapResponse> {
  return request<BootstrapResponse>('/bootstrap');
}

export async function analyzeRfq(id: string): Promise<RfqDocument> {
  return request<RfqDocument>(`/rfqs/${encodeURIComponent(id)}/analyze`, { method: 'POST' });
}

export async function chatRfq(id: string, message: string, actor?: string): Promise<RfqDocument> {
  return request<RfqDocument>(`/rfqs/${encodeURIComponent(id)}/chat`, {
    method: 'POST',
    body: JSON.stringify({ message, actor }),
  });
}

export async function approveRfq(id: string, actor: string): Promise<RfqDocument> {
  return request<RfqDocument>(`/rfqs/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    body: JSON.stringify({ actor }),
  });
}

export async function overrideRfq(id: string, lineId: string, actor: string, reason: string): Promise<RfqDocument> {
  return request<RfqDocument>(`/rfqs/${encodeURIComponent(id)}/override`, {
    method: 'POST',
    body: JSON.stringify({ lineId, actor, reason }),
  });
}

export async function createTextRfq(input: {
  title: string;
  customerId: string;
  rawText: string;
}): Promise<RfqDocument> {
  return request<RfqDocument>('/rfqs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function uploadRfq(input: {
  title: string;
  customerId: string;
  file: File;
}): Promise<RfqDocument> {
  const form = new FormData();
  form.append('title', input.title);
  form.append('customerId', input.customerId);
  form.append('file', input.file);
  return request<RfqDocument>('/rfqs', { method: 'POST', body: form });
}

export async function resetDemo(): Promise<{ documents: RfqDocument[] }> {
  return request<{ documents: RfqDocument[] }>('/reset-demo', { method: 'POST' });
}

export async function downloadExport(id: string, format: 'csv' | 'pdf'): Promise<void> {
  const response = await fetch(`${API_BASE}/rfqs/${encodeURIComponent(id)}/export.${format}`);
  if (!response.ok) {
    throw new ApiError(await readError(response), response.status);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `quotesentry-${id}.${format}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!response.ok) {
    let code: string | undefined;
    try {
      const payload = await response.json() as { error?: string; code?: string };
      code = payload.code;
      throw new ApiError(payload.error || `请求失败（HTTP ${response.status}）`, response.status, code);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(`请求失败（HTTP ${response.status}）`, response.status);
    }
  }
  return response.json() as Promise<T>;
}

async function readError(response: Response): Promise<string> {
  try {
    const payload = await response.json() as { error?: string };
    return payload.error || `请求失败（HTTP ${response.status}）`;
  } catch {
    return `请求失败（HTTP ${response.status}）`;
  }
}
