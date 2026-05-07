import { EventType } from '../types';

export const EVENT_TYPES: EventType[] = [
  {
    id: 'visita_domiciliaria',
    label: 'Visita Domiciliaria',
    color: '#059669',
    bgColor: '#D1FAE5',
    textColor: '#065F46',
  },
  {
    id: 'reunion',
    label: 'Reunión de Equipo',
    color: '#2563EB',
    bgColor: '#DBEAFE',
    textColor: '#1E3A8A',
  },
  {
    id: 'evento_comunitario',
    label: 'Evento Comunitario',
    color: '#7C3AED',
    bgColor: '#EDE9FE',
    textColor: '#4C1D95',
  },
  {
    id: 'capacitacion',
    label: 'Capacitación',
    color: '#D97706',
    bgColor: '#FEF3C7',
    textColor: '#92400E',
  },
  {
    id: 'jornada_salud',
    label: 'Jornada de Salud',
    color: '#DC2626',
    bgColor: '#FEE2E2',
    textColor: '#7F1D1D',
  },
  {
    id: 'trabajo_campo',
    label: 'Trabajo de Campo',
    color: '#0891B2',
    bgColor: '#CFFAFE',
    textColor: '#164E63',
  },
  {
    id: 'administrativo',
    label: 'Administrativo',
    color: '#4B5563',
    bgColor: '#F3F4F6',
    textColor: '#1F2937',
  },
  {
    id: 'otro',
    label: 'Otro',
    color: '#6B7280',
    bgColor: '#F9FAFB',
    textColor: '#374151',
  },
];

export const getEventType = (id: string): EventType =>
  EVENT_TYPES.find((e) => e.id === id) || EVENT_TYPES[EVENT_TYPES.length - 1];
