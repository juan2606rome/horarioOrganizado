import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import CustomPicker from '../components/CustomPicker';
import { AuditEvent, AuditService, AuditType } from '../services/auditService';
import { TeamMember } from '../types';

const YEAR = 2026;

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DAYS_ES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const AUDIT_TYPES: { label: string; value: AuditType }[] = [
  { label: 'AV1', value: 'AV1' },
  { label: 'AV2', value: 'AV2' },
  { label: 'AV3', value: 'AV3' },
];

const getDaysInMonth = (year: number, month: number) =>
  new Date(year, month, 0).getDate();

const getFirstDayOfMonth = (year: number, month: number) => {
  const day = new Date(year, month - 1, 1).getDay();
  return day === 0 ? 6 : day - 1;
};

const formatDate = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const today = new Date();
const todayStr = formatDate(
  today.getFullYear(),
  today.getMonth() + 1,
  today.getDate(),
);

interface Props {
  members: TeamMember[];
}

const AuditCalendarScreen: React.FC<Props> = ({ members }) => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayEvents, setDayEvents] = useState<AuditEvent[]>([]);
  const [dayModalVisible, setDayModalVisible] = useState(false);

  const [formVisible, setFormVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AuditEvent | null>(null);

  const [memberId, setMemberId] = useState('');
  const [tipo, setTipo] = useState<AuditType | ''>('');
  const [cumplido, setCumplido] = useState(false);
  const [detalle, setDetalle] = useState('');
  const [saving, setSaving] = useState(false);

  const loadEvents = useCallback(async () => {
    try {
      const data = await AuditService.getAuditEvents();
      setEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading audit events:', err);
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

  const monthOptions = useMemo(
    () => members.map((m) => ({ label: m.name, value: m.id })),
    [members]
  );

  const memberById = useCallback(
    (id: string) => members.find((m) => m.id === id),
    [members]
  );

  const openCreate = (date: string) => {
    setSelectedDate(date);
    setEditingEvent(null);
    setMemberId(members[0]?.id || '');
    setTipo('AV1');
    setCumplido(false);
    setDetalle('');
    setFormVisible(true);
  };

  const openEdit = (ev: AuditEvent) => {
    setSelectedDate(ev.date);
    setEditingEvent(ev);
    setMemberId(ev.memberId);
    setTipo(ev.tipo);
    setCumplido(ev.cumplido);
    setDetalle(ev.detalle || '');
    setFormVisible(true);
  };

  const onDayPress = (date: string) => {
    const evs = events.filter((e) => e.date === date);
    setSelectedDate(date);
    setDayEvents(evs);

    if (evs.length === 0) {
      openCreate(date);
      return;
    }

    setDayModalVisible(true);
  };

  const save = async () => {
    if (!selectedDate || !memberId || !tipo) return;

    setSaving(true);
    try {
      const payload = {
        memberId,
        date: selectedDate,
        tipo,
        cumplido,
        detalle,
      };

      if (editingEvent) {
        await AuditService.updateAuditEvent(editingEvent.id, payload);
      } else {
        await AuditService.createAuditEvent(payload);
      }

      setFormVisible(false);
      setEditingEvent(null);
      await loadEvents();
    } catch (err) {
      console.error('Error guardando auditoría:', err);
    } finally {
      setSaving(false);
    }
  };

  const removeEvent = async (id: string) => {
    try {
      await AuditService.deleteAuditEvent(id);
      setDayModalVisible(false);
      await loadEvents();
    } catch (err) {
      console.error('Error eliminando auditoría:', err);
    }
  };

  const monthsToRender =
    selectedMonth !== null
      ? [selectedMonth]
      : Array.from({ length: 12 }, (_, i) => i + 1);

  const totals = useMemo(() => {
    const base = {
      AV1: 0,
      AV2: 0,
      AV3: 0,
      cumplidos: 0,
      noCumplidos: 0,
    };

    for (const ev of events) {
      base[ev.tipo]++;
      if (ev.cumplido) base.cumplidos++;
      else base.noCumplidos++;
    }

    return base;
  }, [events]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Cargando auditorías...</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.statsBar}>
          <Stat label="AV1" value={totals.AV1} />
          <Stat label="AV2" value={totals.AV2} />
          <Stat label="AV3" value={totals.AV3} />
          <Stat label="Cumplidas" value={totals.cumplidos} />
          <Stat label="No cumplidas" value={totals.noCumplidos} />
        </View>

        <View style={styles.filterSection}>
          <Text style={styles.filterTitle}>Filtrar por mes</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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

        {monthsToRender.map((month) => {
          const daysInMonth = getDaysInMonth(YEAR, month);
          const firstDayOffset = getFirstDayOfMonth(YEAR, month);

          const monthEvents = events.filter((e) => {
            const [, m] = e.date.split('-').map(Number);
            return m === month;
          });

          const monthCounts = {
            AV1: monthEvents.filter((e) => e.tipo === 'AV1').length,
            AV2: monthEvents.filter((e) => e.tipo === 'AV2').length,
            AV3: monthEvents.filter((e) => e.tipo === 'AV3').length,
          };

          const cells: Array<{ day: number | null; date: string | null }> = [];
          for (let i = 0; i < firstDayOffset; i++) cells.push({ day: null, date: null });
          for (let d = 1; d <= daysInMonth; d++) {
            cells.push({ day: d, date: formatDate(YEAR, month, d) });
          }
          while (cells.length % 7 !== 0) cells.push({ day: null, date: null });

          return (
            <View key={month} style={styles.monthCard}>
              <View style={styles.monthHeader}>
                <View>
                  <Text style={styles.monthTitle}>{MONTHS_ES[month - 1]}</Text>
                  <Text style={styles.monthSub}>{YEAR}</Text>
                </View>

                <View style={styles.monthBadges}>
                  <MiniBadge text={`AV1 ${monthCounts.AV1}`} />
                  <MiniBadge text={`AV2 ${monthCounts.AV2}`} />
                  <MiniBadge text={`AV3 ${monthCounts.AV3}`} />
                </View>
              </View>

              <View style={styles.weekRow}>
                {DAYS_ES.map((d) => (
                  <Text key={d} style={styles.weekDay}>{d}</Text>
                ))}
              </View>

              {Array.from({ length: cells.length / 7 }).map((_, rowIdx) => (
                <View key={rowIdx} style={styles.row}>
                  {cells.slice(rowIdx * 7, rowIdx * 7 + 7).map((cell, colIdx) => {
                    if (!cell.day || !cell.date) {
                      return <View key={colIdx} style={styles.emptyCell} />;
                    }

                    const dayEvents = events.filter((e) => e.date === cell.date);
                    const isToday = cell.date === todayStr;

                    return (
                      <TouchableOpacity
                        key={colIdx}
                        style={[styles.dayCell, isToday && styles.todayCell, dayEvents.length > 0 && styles.dayCellWithEvents]}
                        onPress={() => onDayPress(cell.date!)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.dayNum, isToday && styles.todayNum]}>{cell.day}</Text>

                        {dayEvents.slice(0, 2).map((ev) => {
                          const m = memberById(ev.memberId);
                          return (
                            <View key={ev.id} style={styles.eventPill}>
                              <View
                                style={[
                                  styles.eventDot,
                                  { backgroundColor: m?.color || '#2563EB' },
                                ]}
                              />
                              <Text style={styles.eventText} numberOfLines={1}>
                                {ev.tipo} · {m?.initials || '??'}
                              </Text>
                            </View>
                          );
                        })}

                        {dayEvents.length > 2 && (
                          <Text style={styles.moreText}>+{dayEvents.length - 2} más</Text>
                        )}
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

      <Modal visible={dayModalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setDayModalVisible(false)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Auditorías del día</Text>
              <TouchableOpacity onPress={() => setDayModalVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView>
              {dayEvents.map((ev) => {
                const m = memberById(ev.memberId);
                return (
                  <TouchableOpacity
                    key={ev.id}
                    style={styles.modalItem}
                    onPress={() => {
                      setDayModalVisible(false);
                      openEdit(ev);
                    }}
                  >
                    <Text style={styles.modalItemType}>{ev.tipo}</Text>
                    <Text style={styles.modalItemName}>
                      {m?.name || 'Ingeniero'}
                    </Text>
                    <Text style={styles.modalItemDetail}>
                      {ev.cumplido ? 'Cumplido' : 'No cumplido'}
                    </Text>
                    {ev.detalle ? (
                      <Text style={styles.modalItemDesc}>{ev.detalle}</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => {
                  setDayModalVisible(false);
                  if (selectedDate) openCreate(selectedDate);
                }}
              >
                <Text style={styles.addBtnText}>+ Nueva auditoría</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={formVisible} transparent animationType="slide">
        <View style={styles.formOverlay}>
          <View style={styles.formSheet}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>
                {editingEvent ? 'Editar auditoría' : 'Nueva auditoría'}
              </Text>
              <TouchableOpacity onPress={() => setFormVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView>
              <CustomPicker
                label="Ingeniero"
                value={memberId}
                options={monthOptions}
                onSelect={setMemberId}
                placeholder="Seleccionar ingeniero..."
                searchable
              />

              <CustomPicker
                label="Tipo"
                value={tipo}
                options={AUDIT_TYPES}
                onSelect={(v) => setTipo(v as AuditType)}
                placeholder="Seleccionar tipo..."
              />

              <View style={styles.checkRow}>
                <Text style={styles.checkLabel}>¿Cumplido?</Text>
                <TouchableOpacity
                  style={[styles.checkBtn, cumplido && styles.checkBtnActive]}
                  onPress={() => setCumplido((v) => !v)}
                >
                  <Text style={[styles.checkBtnText, cumplido && styles.checkBtnTextActive]}>
                    {cumplido ? 'Sí' : 'No'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.fieldWrapper}>
                <Text style={styles.fieldLabel}>Descripción</Text>
                <TextInput
                  style={styles.textArea}
                  value={detalle}
                  onChangeText={setDetalle}
                  placeholder="Escribe una observación..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                />
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.saveBtnText}>
                    {editingEvent ? 'Actualizar' : 'Guardar'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const Stat = ({ label, value }: { label: string; value: number }) => (
  <View style={styles.statBox}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const MiniBadge = ({ text }: { text: string }) => (
  <View style={styles.miniBadge}>
    <Text style={styles.miniBadgeText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  content: { padding: 14 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 10, color: '#6B7280', fontWeight: '600' },

  statsBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  statBox: {
    flexGrow: 1,
    minWidth: 96,
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 12,
  },
  statValue: { fontSize: 20, fontWeight: '900', color: '#111827' },
  statLabel: { fontSize: 11, color: '#6B7280', fontWeight: '700', marginTop: 2 },

  filterSection: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  filterTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  monthChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    marginRight: 6,
  },
  monthChipActive: { backgroundColor: '#2563EB' },
  monthChipText: { color: '#6B7280', fontWeight: '700' },
  monthChipTextActive: { color: '#FFF' },

  monthCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 14,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  monthTitle: { fontSize: 18, fontWeight: '900', color: '#111827' },
  monthSub: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  monthBadges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' },
  miniBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  miniBadgeText: { fontSize: 10, fontWeight: '800', color: '#3730A3' },

  weekRow: { flexDirection: 'row', backgroundColor: '#F8FAFC', paddingVertical: 8 },
  weekDay: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '800', color: '#64748B' },
  row: { flexDirection: 'row', paddingHorizontal: 4, paddingVertical: 2 },
  emptyCell: { flex: 1, minHeight: 92, margin: 2 },
  dayCell: {
    flex: 1,
    minHeight: 92,
    margin: 2,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 6,
  },
  todayCell: { borderColor: '#2563EB', borderWidth: 2, backgroundColor: '#EFF6FF' },
  dayCellWithEvents: { backgroundColor: '#FFFFFF' },
  dayNum: { fontSize: 12, fontWeight: '900', color: '#374151' },
  todayNum: { color: '#2563EB' },
  eventPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFF',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginTop: 5,
  },
  eventDot: { width: 7, height: 7, borderRadius: 999 },
  eventText: { flex: 1, fontSize: 10, fontWeight: '700', color: '#334155' },
  moreText: { marginTop: 4, fontSize: 10, fontWeight: '800', color: '#3730A3' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'center',
    padding: 20,
  },
  modalSheet: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: { fontSize: 16, fontWeight: '900', color: '#111827' },
  modalClose: { fontSize: 18, color: '#6B7280', fontWeight: '800' },

  modalItem: {
    margin: 16,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    backgroundColor: '#FAFAFA',
  },
  modalItemType: { fontSize: 12, fontWeight: '900', color: '#2563EB' },
  modalItemName: { fontSize: 14, fontWeight: '800', color: '#111827', marginTop: 4 },
  modalItemDetail: { fontSize: 13, color: '#059669', fontWeight: '700', marginTop: 4 },
  modalItemDesc: { fontSize: 13, color: '#6B7280', marginTop: 4 },

  addBtn: {
    margin: 16,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    alignItems: 'center',
  },
  addBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' },

  formOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  formSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    maxHeight: '90%',
  },
  formTitle: { fontSize: 18, fontWeight: '900', color: '#111827' },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },

  checkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
  },
  checkLabel: { fontSize: 14, fontWeight: '800', color: '#374151' },
  checkBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
  },
  checkBtnActive: { backgroundColor: '#DCFCE7' },
  checkBtnText: { fontWeight: '900', color: '#4B5563' },
  checkBtnTextActive: { color: '#166534' },

  fieldWrapper: { marginBottom: 14 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#374151',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  textArea: {
    minHeight: 110,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    textAlignVertical: 'top',
  },
  saveBtn: {
    borderRadius: 14,
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' },
});

export default AuditCalendarScreen;