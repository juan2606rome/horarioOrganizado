// services/calendarService.ts

export type TeamMember = {
  id: string;
  name: string;
  color: string;
  initials: string;
  sortOrder?: number;
  active?: boolean;
};

export type CalendarEvent = {
  id: string;
  memberId: string;
  memberName?: string;
  memberColor?: string;
  memberInitials?: string;
  date: string;
  tipo: string;
  departamento: string;
  municipio: string;
  detalle: string;
  createdAt?: string;
  updatedAt?: string;
};

// 🔥 TU MICROSERVICIO DE RENDER
const BASE_URL = 'https://horarioorganizado.onrender.com';

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    }, 
    ...options,
  });

  const isJson = res.headers
    .get('content-type')
    ?.includes('application/json');

  const payload = isJson
    ? await res.json()
    : await res.text();

  if (!res.ok) {
    const message =
      typeof payload === 'string'
        ? payload
        : payload?.error || 'Error inesperado';

    throw new Error(message);
  }

  return payload as T;
}

// 🔥 GENERADOR SIMPLE DE IDS para la base de datos

const generateId = () => {
  return `event_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 9)}`;
};

export const CalendarService = {
  // ─── MEMBERS ───────────────────────────
  getMembers: () =>
    request<TeamMember[]>('/members'),

  // ─── EVENTS ────────────────────────────
  getEvents: (params?: {
    memberId?: string;
    year?: number;
    month?: number;
  }) => {
    const q = new URLSearchParams();

    if (params?.memberId) {
      q.set('memberId', params.memberId);
    }

    if (params?.year) {
      q.set('year', String(params.year));
    }

    if (params?.month) {
      q.set('month', String(params.month));
    }

    const suffix = q.toString()
      ? `?${q.toString()}`
      : '';

    return request<CalendarEvent[]>(
      `/events${suffix}`
    );
  },

  // ─── COMBINED ──────────────────────────
  getCombined: (year: number, month: number) =>
    request<CalendarEvent[]>(
      `/combined?year=${year}&month=${month}`
    ),

  // ─── EVENT DETAIL ──────────────────────
  getEventById: (id: string) =>
    request<CalendarEvent>(`/events/${id}`),

  // ─── CREATE EVENT ──────────────────────
  createEvent: (
    data: Omit<CalendarEvent, 'id'>
  ) =>
    request<CalendarEvent>('/events', {
      method: 'POST',

      body: JSON.stringify({
        ...data,

        // 🔥 EL BACKEND AHORA EXIGE ID
        id: generateId(),
      }),
    }),

  // ─── UPDATE EVENT ──────────────────────
  updateEvent: (
    id: string,
    data: Partial<Omit<CalendarEvent, 'id'>>
  ) =>
    request<CalendarEvent>(`/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // ─── DELETE EVENT ──────────────────────
  deleteEvent: (id: string) =>
    request<{ ok: true }>(`/events/${id}`, {
      method: 'DELETE',
    }),
};