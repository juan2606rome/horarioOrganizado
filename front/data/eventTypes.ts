import { EventType } from '../types';

export const EVENT_TYPES: EventType[] = [
  {
    id: 'mesa_sostenibilidad_1',
    label: 'Mesa de sostenibilidad 1',
    color: '#059669',
    bgColor: '#D1FAE5',
    textColor: '#065F46',
  },
  {
    id: 'mesa_sostenibilidad_2',
    label: 'Mesa de sostenibilidad 2',
    color: '#2563EB',
    bgColor: '#DBEAFE',
    textColor: '#1E3A8A',
  },
  {
    id: 'socializacion',
    label: 'Socialización',
    color: '#7C3AED',
    bgColor: '#EDE9FE',
    textColor: '#4C1D95',
  },
  {
    id: 'av1',
    label: 'AV1',
    color: '#D97706',
    bgColor: '#FEF3C7',
    textColor: '#92400E',
  },
  {
    id: 'av2',
    label: 'AV2',
    color: '#DC2626',
    bgColor: '#FEE2E2',
    textColor: '#7F1D1D',
  },
  {
    id: 'av3',
    label: 'AV3',
    color: '#0891B2',
    bgColor: '#CFFAFE',
    textColor: '#164E63',
  },
  {
    id: 'fecha_entrega_obra',
    label: 'Fecha de entrega obra',
    color: '#4B5563',
    bgColor: '#F3F4F6',
    textColor: '#1F2937',
  },
  {
    id: 'agenda_institucional',
    label: 'Agenda institucional',
    color: '#9333EA',
    bgColor: '#F3E8FF',
    textColor: '#581C87',
  },
  {
    id: 'dialogos_gobernanza',
    label: 'Diálogos de Gobernanza',
    color: '#0F766E',
    bgColor: '#CCFBF1',
    textColor: '#134E4A',
  },
  {
    id: 'visitas_pertinencia',
    label: 'Visitas de pertinencia',
    color: '#EA580C',
    bgColor: '#FFEDD5',
    textColor: '#9A3412',
  },
  {
    id: 'feria',
    label: 'Feria',
    color: '#DB2777',
    bgColor: '#FCE7F3',
    textColor: '#831843',
  },
  {
    id: 'pactos_de_gobernanza',
    label: 'Pactos de gobernanza',
    color: 'rgb(219, 39, 195)',
    bgColor: '#EDE9FE',
    textColor: '#871d95',
  },
  {
    id: 'otra_actividad',
    label: 'Otra actividad',
    color: '#6B7280',
    bgColor: '#F9FAFB',
    textColor: '#374151',
  },
];

export const getEventType = (id: string): EventType =>
  EVENT_TYPES.find((e) => e.id === id) ||
  EVENT_TYPES[EVENT_TYPES.length - 1];