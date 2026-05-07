import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getEventType } from '../data/eventTypes';
import { TEAM_MEMBERS } from '../data/teamMembers';
import { CalendarService } from '../services/calendarService';
import { CalendarEvent, TeamMember } from '../types';

const YEAR = 2026;

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

const DAYS_ES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const getDaysInMonth = (year: number, month: number) =>
  new Date(year, month, 0).getDate();

const getFirstDayOfMonth = (year: number, month: number) => {
  const day = new Date(year, month - 1, 1).getDay();
  return day === 0 ? 6 : day - 1;
};

const formatDate = (year: number, month: number, day: number): string =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const todayStr = formatDate(
  new Date().getFullYear(),
  new Date().getMonth() + 1,
  new Date().getDate(),
);

const CombinedScreen: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const [dayModalVisible, setDayModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState<CalendarEvent[]>([]);

  const loadEvents = useCallback(async () => {
    try {
      const data = await CalendarService.getEvents();
      setEvents(data);
    } catch (err) {
      console.error('Error loading events:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const onRefresh = () => {
    setRefreshing(true);
    loadEvents();
  };

  const getEventsForDate = (date: string) => events.filter((e) => e.date === date);

  const getMemberById = (id: string): TeamMember | undefined =>
    TEAM_MEMBERS.find((m) => m.id === id);

  const openDayModal = (date: string) => {
    const dayEvents = getEventsForDate(date);
    if (dayEvents.length === 0) return;
    setSelectedDate(date);
    setSelectedDayEvents(dayEvents);
    setDayModalVisible(true);
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Cargando horario combinado...</Text>
      </View>
    );
  }

  const months =
    selectedMonth !== null
      ? [selectedMonth]
      : Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2563EB']}
          />
        }
      >
        <View style={styles.filterSection}>
          <Text style={styles.filterTitle}>Filtrar por mes:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthScroll}>
            <TouchableOpacity
              style={[styles.monthChip, selectedMonth === null && styles.monthChipActive]}
              onPress={() => setSelectedMonth(null)}
              activeOpacity={0.8}
            >
              <Text style={[styles.monthChipText, selectedMonth === null && styles.monthChipTextActive]}>
                Todos
              </Text>
            </TouchableOpacity>

            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.monthChip, selectedMonth === m && styles.monthChipActive]}
                onPress={() => setSelectedMonth(selectedMonth === m ? null : m)}
                activeOpacity={0.8}
              >
                <Text style={[styles.monthChipText, selectedMonth === m && styles.monthChipTextActive]}>
                  {MONTHS_ES[m - 1].slice(0, 3)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.memberLegend}>
          <Text style={styles.legendTitle}>Integrantes:</Text>
          <View style={styles.legendRow}>
            {TEAM_MEMBERS.map((m) => (
              <View key={m.id} style={styles.memberChip}>
                <View style={[styles.memberDot, { backgroundColor: m.color }]} />
                <Text style={styles.memberChipText}>{m.name}</Text>
              </View>
            ))}
          </View>
        </View>

        {months.map((month) => {
          const daysInMonth = getDaysInMonth(YEAR, month);
          const firstDayOffset = getFirstDayOfMonth(YEAR, month);

          const monthEvents = events.filter((e) => {
            const [, m] = e.date.split('-').map(Number);
            return m === month;
          });

          const cells: Array<{ day: number | null; date: string | null }> = [];
          for (let i = 0; i < firstDayOffset; i++) cells.push({ day: null, date: null });
          for (let d = 1; d <= daysInMonth; d++) {
            cells.push({ day: d, date: formatDate(YEAR, month, d) });
          }
          while (cells.length % 7 !== 0) cells.push({ day: null, date: null });

          return (
            <View key={month} style={styles.monthBlock}>
              <View style={styles.monthHeader}>
                <Text style={styles.monthName}>
                  {MONTHS_ES[month - 1]} {YEAR}
                </Text>
                <View style={styles.monthBadge}>
                  <Text style={styles.monthBadgeText}>{monthEvents.length} act.</Text>
                </View>
              </View>

              <View style={styles.weekRow}>
                {DAYS_ES.map((d) => (
                  <Text key={d} style={styles.weekDay}>
                    {d}
                  </Text>
                ))}
              </View>

              {Array.from({ length: cells.length / 7 }).map((_, rowIdx) => (
                <View key={rowIdx} style={styles.gridRow}>
                  {cells.slice(rowIdx * 7, rowIdx * 7 + 7).map((cell, colIdx) => {
                    if (!cell.day || !cell.date) {
                      return <View key={colIdx} style={styles.emptyCell} />;
                    }

                    const dayEvts = getEventsForDate(cell.date);
                    const isToday = cell.date === todayStr;

                    return (
                      <TouchableOpacity
                        key={colIdx}
                        style={[
                          styles.dayCell,
                          isToday && styles.todayCell,
                          dayEvts.length > 0 && styles.hasEventsCell,
                        ]}
                        activeOpacity={0.75}
                        onPress={() => openDayModal(cell.date!)}
                      >
                        <Text style={[styles.cellDay, isToday && styles.todayDayText]}>
                          {cell.day}
                        </Text>

                        <View style={styles.eventStack}>
                          {dayEvts.slice(0, 3).map((ev) => {
                            const m = getMemberById(ev.memberId);
                            const et = getEventType(ev.tipo);
                            const chipColor = m?.color || et.color;

                            return (
                              <View
                                key={ev.id}
                                style={[styles.eventChip, { borderLeftColor: chipColor }]}
                              >
                                <View style={[styles.eventChipDot, { backgroundColor: chipColor }]} />
                                <Text style={styles.eventChipText} numberOfLines={1}>
                                  {m?.initials} · {et.label}
                                </Text>
                              </View>
                            );
                          })}

                          {dayEvts.length > 3 && (
                            <View style={styles.moreChip}>
                              <Text style={styles.moreChipText}>+{dayEvts.length - 3} más</Text>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal
        visible={dayModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDayModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setDayModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalSheet}
            activeOpacity={1}
            onPress={() => {}}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedDate
                  ? `${selectedDate.split('-')[2]} ${
                      MONTHS_ES_SHORT[parseInt(selectedDate.split('-')[1], 10) - 1]
                    } · ${selectedDayEvents.length} actividades`
                  : 'Actividades'}
              </Text>
              <TouchableOpacity onPress={() => setDayModalVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedDayEvents.map((ev) => {
                const m = getMemberById(ev.memberId);
                const et = getEventType(ev.tipo);

                return (
                  <View key={ev.id} style={styles.modalItem}>
                    <View style={styles.modalItemTop}>
                      <View style={[styles.memberInitialBadge, { backgroundColor: m?.color || '#2563EB' }]}>
                        <Text style={styles.memberInitialText}>{m?.initials || '—'}</Text>
                      </View>
                      <Text style={styles.modalMemberName}>{m?.name || 'Integrante'}</Text>
                    </View>

                    <View style={[styles.modalTypeBadge, { backgroundColor: et.bgColor }]}>
                      <Text style={[styles.modalTypeText, { color: et.color }]}>{et.label}</Text>
                    </View>

                    <Text style={styles.modalLocation}>
                      {ev.municipio}, {ev.departamento}
                    </Text>

                    {ev.detalle ? (
                      <Text style={styles.modalDetalle}>{ev.detalle}</Text>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  content: {
    padding: 12,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  filterSection: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  filterTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.5,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  monthScroll: {
    flexDirection: 'row',
  },
  monthChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 6,
  },
  monthChipActive: {
    backgroundColor: '#2563EB',
  },
  monthChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  monthChipTextActive: {
    color: '#FFF',
  },
  memberLegend: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  legendTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.5,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  memberDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  memberChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  monthBlock: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
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
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  monthName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.3,
  },
  monthBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  monthBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  weekRow: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    color: '#1E40AF',
  },
  gridRow: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  emptyCell: {
    flex: 1,
    margin: 2,
    minHeight: 92,
  },
  dayCell: {
    flex: 1,
    margin: 2,
    minHeight: 92,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 6,
  },
  todayCell: {
    borderWidth: 2,
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  hasEventsCell: {
    backgroundColor: '#FFFFFF',
  },
  cellDay: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    alignSelf: 'flex-start',
  },
  todayDayText: {
    color: '#2563EB',
    fontWeight: '900',
  },
  eventStack: {
    marginTop: 6,
    gap: 4,
  },
  eventChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFF',
    borderRadius: 8,
    borderLeftWidth: 3,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  eventChipDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  eventChipText: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },
  moreChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  moreChipText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#3730A3',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 18,
  },
  modalSheet: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    maxHeight: '80%',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    flex: 1,
    paddingRight: 10,
  },
  modalClose: {
    fontSize: 18,
    color: '#6B7280',
    fontWeight: '700',
  },
  modalItem: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#FAFAFA',
  },
  modalItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  memberInitialBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitialText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
  },
  modalMemberName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  modalTypeBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 6,
  },
  modalTypeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  modalLocation: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  modalDetalle: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
});

export default CombinedScreen;