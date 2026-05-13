import React, { useState } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getEventType } from '../data/eventTypes';
import { CalendarEvent, TeamMember } from '../types';
import DayCell from './DayCell';
import TaskModal from './TaskModal';

interface MonthCalendarProps {
  year: number;
  month: number; // 1-12
  member: TeamMember | null;
  events: CalendarEvent[];
  onEventsChanged: () => void;
  readOnly?: boolean;
}

const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const DAYS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const MONTHS_ES_SHORT = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

const getDaysInMonth = (year: number, month: number) =>
  new Date(year, month, 0).getDate();

const getFirstDayOfMonth = (year: number, month: number) => {
  // Monday = 0
  const day = new Date(year, month - 1, 1).getDay();
  return day === 0 ? 6 : day - 1;
};

const formatDate = (year: number, month: number, day: number): string =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const today = new Date();
const todayStr = formatDate(
  today.getFullYear(),
  today.getMonth() + 1,
  today.getDate(),
);

const MonthCalendar: React.FC<MonthCalendarProps> = ({
  year,
  month,
  member,
  events,
  onEventsChanged,
  readOnly = false,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayEvents, setDayEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [multiEventVisible, setMultiEventVisible] = useState(false);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOffset = getFirstDayOfMonth(year, month);

  const cells: Array<{ day: number | null; date: string | null }> = [];
  for (let i = 0; i < firstDayOffset; i++) cells.push({ day: null, date: null });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, date: formatDate(year, month, d) });
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, date: null });

  const getEventsForDate = (date: string) =>
    events.filter((e) => e.date === date);

  const openCreateModal = (date: string) => {
    if (readOnly) return;
    setSelectedDate(date);
    setSelectedEvent(null);
    setModalVisible(true);
  };

  const openEditModal = (date: string, ev: CalendarEvent) => {
    if (readOnly) return;
    setSelectedDate(date);
    setSelectedEvent(ev);
    setModalVisible(true);
  };

  const handleDayPress = (date: string) => {
    if (readOnly) return;

    const evts = getEventsForDate(date);

    setSelectedDate(date);
    setDayEvents(evts);

    // Si no hay eventos, abre crear.
    // Si hay 1 o más, abre el picker para editar una o agregar otra.
    if (evts.length === 0) {
      setSelectedEvent(null);
      setModalVisible(true);
      return;
    }

    setMultiEventVisible(true);
  };

  const monthEventCount = events.filter((e) => {
    const [, m] = e.date.split('-').map(Number);
    return m === month;
  }).length;

  const monthEventsVisible = events.filter((e) => {
    const [, m] = e.date.split('-').map(Number);
    return m === month;
  });

  return (
    <View style={styles.container}>
      <View style={[styles.monthHeader, member && { borderLeftColor: member.color }]}>
        <View>
          <Text style={styles.monthName}>{MONTHS_ES[month - 1]}</Text>
          <Text style={styles.monthYear}>{year}</Text>
        </View>

        {monthEventCount > 0 && (
          <View style={[styles.countBadge, member && { backgroundColor: member.color }]}>
            <Text style={styles.countText}>{monthEventCount}</Text>
          </View>
        )}
      </View>

      <View style={styles.weekRow}>
        {DAYS_ES.map((d) => (
          <Text key={d} style={styles.weekDay}>
            {d}
          </Text>
        ))}
      </View>

      {Array.from({ length: cells.length / 7 }).map((_, rowIdx) => (
        <View key={rowIdx} style={styles.row}>
          {cells.slice(rowIdx * 7, rowIdx * 7 + 7).map((cell, colIdx) => (
            <DayCell
              key={`${rowIdx}-${colIdx}`}
              day={cell.day}
              date={cell.date}
              events={cell.date ? getEventsForDate(cell.date) : []}
              isToday={cell.date === todayStr}
              onPress={handleDayPress}
              memberColor={member?.color}
            />
          ))}
        </View>
      ))}

      {multiEventVisible && selectedDate && (
        <MultiEventPicker
          visible={multiEventVisible}
          events={dayEvents}
          date={selectedDate}
          member={member}
          onSelectEvent={(ev) => {
            setSelectedEvent(ev);
            setMultiEventVisible(false);
            setModalVisible(true);
          }}
          onAddNew={() => {
            setSelectedEvent(null);
            setMultiEventVisible(false);
            setModalVisible(true);
          }}
          onClose={() => setMultiEventVisible(false)}
        />
      )}

      <TaskModal
        visible={modalVisible}
        date={selectedDate}
        member={member}
        existingEvent={selectedEvent}
        onClose={() => {
          setModalVisible(false);
          setSelectedEvent(null);
        }}
        onSaved={() => {
          setModalVisible(false);
          setSelectedEvent(null);
          onEventsChanged();
        }}
        onDeleted={() => {
          setModalVisible(false);
          setSelectedEvent(null);
          onEventsChanged();
        }}
      />
    </View>
  );
};

interface MultiEventPickerProps {
  visible: boolean;
  events: CalendarEvent[];
  date: string;
  member: TeamMember | null;
  onSelectEvent: (ev: CalendarEvent) => void;
  onAddNew: () => void;
  onClose: () => void;
}

const MultiEventPicker: React.FC<MultiEventPickerProps> = ({
  visible,
  events,
  date,
  member,
  onSelectEvent,
  onAddNew,
  onClose,
}) => {
  const [, monthStr, dayStr] = date.split('-');
  const label = `${parseInt(dayStr, 10)} ${MONTHS_ES_SHORT[parseInt(monthStr, 10) - 1]}`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={mpStyles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={mpStyles.sheet}>
          <View style={mpStyles.header}>
            <Text style={mpStyles.title}>Actividades · {label}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={mpStyles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={events}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={mpStyles.emptyWrap}>
                <Text style={mpStyles.emptyText}>No hay actividades para este día.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const et = getEventType(item.tipo);

              return (
                <TouchableOpacity
                  style={[mpStyles.item, { borderLeftColor: et.color }]}
                  onPress={() => onSelectEvent(item)}
                  activeOpacity={0.75}
                >
                  <View style={[mpStyles.itemBadge, { backgroundColor: et.bgColor }]}>
                    <Text style={[mpStyles.itemType, { color: et.color }]}>{et.label}</Text>
                  </View>
                  <Text style={mpStyles.itemDept}>
                    {item.departamento} — {item.municipio}
                  </Text>
                  {item.detalle ? (
                    <Text style={mpStyles.itemDetalle} numberOfLines={1}>
                      {item.detalle}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            }}
          />

          <TouchableOpacity
            style={[mpStyles.addBtn, member && { backgroundColor: member.color }]}
            onPress={onAddNew}
            activeOpacity={0.85}
          >
            <Text style={mpStyles.addBtnText}>+ Agregar nueva actividad</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const mpStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: '#FFF',
    borderRadius: 22,
    overflow: 'hidden',
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  close: {
    fontSize: 18,
    color: '#6B7280',
    padding: 4,
  },
  item: {
    padding: 16,
    borderLeftWidth: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  itemBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 6,
  },
  itemType: {
    fontSize: 12,
    fontWeight: '800',
  },
  itemDept: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
  },
  itemDetalle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  addBtn: {
    margin: 16,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  addBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
  },
  emptyWrap: {
    padding: 18,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#6B7280',
  },
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  monthName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.3,
  },
  monthYear: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
    marginTop: 1,
  },
  countBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  weekRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
});

export default MonthCalendar;