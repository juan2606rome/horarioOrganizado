import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { CalendarEvent, TeamMember } from '../types';
import { CalendarService } from '../services/calendarService';
import { TEAM_MEMBERS } from '../data/teamMembers';
import { getEventType } from '../data/eventTypes';

const YEAR = 2026;
const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
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

interface CombinedScreenProps {}

const CombinedScreen: React.FC<CombinedScreenProps> = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    try {
      const data = await CalendarService.getAllEvents();
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

  const getEventsForDate = (date: string) =>
    events.filter((e) => e.date === date);

  const getMemberById = (id: string): TeamMember | undefined =>
    TEAM_MEMBERS.find((m) => m.id === id);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Cargando horario combinado...</Text>
      </View>
    );
  }

  const months = selectedMonth !== null ? [selectedMonth] : Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563EB']} />
      }
    >
      {/* Month filter */}
      <View style={styles.filterSection}>
        <Text style={styles.filterTitle}>Filtrar por mes:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthScroll}>
          <TouchableOpacity
            style={[styles.monthChip, selectedMonth === null && styles.monthChipActive]}
            onPress={() => setSelectedMonth(null)}
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
            >
              <Text style={[styles.monthChipText, selectedMonth === m && styles.monthChipTextActive]}>
                {MONTHS_ES[m - 1].slice(0, 3)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Member legend */}
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

      {/* Combined monthly calendars */}
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
              <Text style={styles.monthName}>{MONTHS_ES[month - 1]} {YEAR}</Text>
              <View style={styles.monthBadge}>
                <Text style={styles.monthBadgeText}>{monthEvents.length} act.</Text>
              </View>
            </View>

            {/* Day headers */}
            <View style={styles.weekRow}>
              {DAYS_ES.map((d) => (
                <Text key={d} style={styles.weekDay}>{d}</Text>
              ))}
            </View>

            {/* Rows */}
            {Array.from({ length: cells.length / 7 }).map((_, rowIdx) => (
              <View key={rowIdx} style={styles.gridRow}>
                {cells.slice(rowIdx * 7, rowIdx * 7 + 7).map((cell, colIdx) => {
                  if (!cell.day || !cell.date) {
                    return <View key={colIdx} style={styles.emptyCell} />;
                  }
                  const dayEvts = getEventsForDate(cell.date);
                  const isToday = cell.date === todayStr;
                  const isExpanded = expandedDay === cell.date;

                  return (
                    <View key={colIdx} style={styles.dayCellWrapper}>
                      <TouchableOpacity
                        style={[
                          styles.combinedCell,
                          isToday && styles.todayCell,
                          dayEvts.length > 0 && styles.hasEventsCell,
                        ]}
                        onPress={() =>
                          setExpandedDay(isExpanded ? null : (cell.date ?? null))
                        }
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.cellDay, isToday && styles.todayDayText]}>
                          {cell.day}
                        </Text>
                        {/* Member dots */}
                        <View style={styles.memberDots}>
                          {dayEvts.map((ev) => {
                            const m = getMemberById(ev.memberId);
                            return m ? (
                              <View
                                key={ev.id}
                                style={[styles.smallDot, { backgroundColor: m.color }]}
                              />
                            ) : null;
                          })}
                        </View>
                      </TouchableOpacity>

                      {/* Expanded day popup */}
                      {isExpanded && dayEvts.length > 0 && (
                        <View style={styles.expandedPopup}>
                          {dayEvts.map((ev) => {
                            const m = getMemberById(ev.memberId);
                            const et = getEventType(ev.tipo);
                            return (
                              <View key={ev.id} style={[styles.expandedItem, { borderLeftColor: m?.color || '#ccc' }]}>
                                <View style={styles.expandedItemHeader}>
                                  <View style={[styles.memberInitialBadge, { backgroundColor: m?.color }]}>
                                    <Text style={styles.memberInitialText}>{m?.initials}</Text>
                                  </View>
                                  <Text style={styles.expandedMemberName}>{m?.name}</Text>
                                </View>
                                <View style={[styles.expandedTypeBadge, { backgroundColor: et.bgColor }]}>
                                  <Text style={[styles.expandedTypeText, { color: et.color }]}>{et.label}</Text>
                                </View>
                                <Text style={styles.expandedLocation}>{ev.municipio}, {ev.departamento}</Text>
                                {ev.detalle ? <Text style={styles.expandedDetalle}>{ev.detalle}</Text> : null}
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        );
      })}

      <View style={{ height: 40 }} />
    </ScrollView>
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
    zIndex: 1,
  },
  dayCellWrapper: {
    flex: 1,
    zIndex: 1,
  },
  emptyCell: {
    flex: 1,
    margin: 2,
    minHeight: 52,
  },
  combinedCell: {
    flex: 1,
    margin: 2,
    minHeight: 52,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 5,
    alignItems: 'center',
  },
  todayCell: {
    borderWidth: 2,
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  hasEventsCell: {
    backgroundColor: '#F8FAFF',
  },
  cellDay: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    alignSelf: 'flex-start',
  },
  todayDayText: {
    color: '#2563EB',
    fontWeight: '800',
  },
  memberDots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    marginTop: 4,
    justifyContent: 'center',
  },
  smallDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  expandedPopup: {
    position: 'absolute',
    top: 58,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 999,
    padding: 8,
    minWidth: 160,
  },
  expandedItem: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  expandedItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 5,
  },
  memberInitialBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitialText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFF',
  },
  expandedMemberName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  expandedTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 4,
  },
  expandedTypeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  expandedLocation: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '500',
  },
  expandedDetalle: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
});

export default CombinedScreen;
