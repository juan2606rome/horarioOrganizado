export interface TeamMember {
  id: string;
  name: string;
  color: string;
  initials: string;
}

export interface CalendarEvent {
  id: string;
  memberId: string;
  date: string; // YYYY-MM-DD
  tipo: string;
  departamento: string;
  municipio: string;
  detalle: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventType {
  id: string;
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
}

export interface Department {
  id: string;
  name: string;
  municipalities: string[];
}

export type ModalMode = 'create' | 'edit' | 'view';
