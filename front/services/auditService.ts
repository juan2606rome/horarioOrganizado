
const BASE_URL = 'https://horarioorganizado.onrender.com';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const message =
      typeof payload === 'string'
        ? payload
        : (payload as any)?.error || 'Error inesperado';

    throw new Error(message);
  }

  return payload as T;
}

const generateAuditId = () => {
  return `audit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
};

export type AuditType = 'AV1' | 'AV2' | 'AV3';

export interface AuditEvent {
  id: string;
  memberId: string;
  memberName?: string;
  memberColor?: string;
  memberInitials?: string;
  date: string;
  tipo: AuditType;
  cumplido: boolean;
  detalle: string;
  createdAt?: string;
  updatedAt?: string;
}

export const AuditService = {
  getAuditEvents: (params?: {
    memberId?: string;
    year?: number;
    month?: number;
  }) => {
    const q = new URLSearchParams();

    if (params?.memberId) q.set('memberId', params.memberId);
    if (params?.year) q.set('year', String(params.year));
    if (params?.month) q.set('month', String(params.month));

    const suffix = q.toString() ? `?${q.toString()}` : '';
    return request<AuditEvent[]>(`/audit-events${suffix}`);
  },

  createAuditEvent: (data: Omit<AuditEvent, 'id' | 'createdAt' | 'updatedAt'>) =>
    request<AuditEvent>('/audit-events', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        id: generateAuditId(),
      }),
    }),

  updateAuditEvent: (
    id: string,
    data: Partial<Omit<AuditEvent, 'id' | 'createdAt' | 'updatedAt'>>
  ) =>
    request<AuditEvent>(`/audit-events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteAuditEvent: (id: string) =>
    request<{ ok: true }>(`/audit-events/${id}`, {
      method: 'DELETE',
    }),
};