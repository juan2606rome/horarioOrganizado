// data/HOLIDAYS.ts

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
}

export const HOLIDAYS: Holiday[] = [
  { date: '2026-01-01', name: 'Año Nuevo' },
  { date: '2026-01-12', name: 'Reyes Magos' },
  { date: '2026-03-23', name: 'Día de San José' },
  { date: '2026-04-02', name: 'Jueves Santo' },
  { date: '2026-04-03', name: 'Viernes Santo' },
  { date: '2026-05-01', name: 'Día del Trabajo' },
  { date: '2026-05-18', name: 'Ascensión del Señor' },
  { date: '2026-06-08', name: 'Corpus Christi' },
  { date: '2026-06-15', name: 'Sagrado Corazón de Jesús' },
  { date: '2026-06-29', name: 'San Pedro y San Pablo' },
  { date: '2026-07-20', name: 'Día de la Independencia' },
  { date: '2026-08-07', name: 'Batalla de Boyacá' },
  { date: '2026-08-17', name: 'Asunción de la Virgen' },
  { date: '2026-10-12', name: 'Día de la Diversidad Étnica y Cultural' },
  { date: '2026-11-02', name: 'Todos los Santos' },
  { date: '2026-11-16', name: 'Independencia de Cartagena' },
  { date: '2026-12-08', name: 'Inmaculada Concepción' },
  { date: '2026-12-25', name: 'Navidad' },
];

export const getHoliday = (date: string): Holiday | undefined => {
  return HOLIDAYS.find((h) => h.date === date);
};

export const isHoliday = (date: string): boolean => {
  return HOLIDAYS.some((h) => h.date === date);
};