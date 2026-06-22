import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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

const AV_COLORS: Record<AuditType, { color: string; bg: string; text: string }> = {
  AV1: { color: '#D97706', bg: '#FEF3C7', text: '#92400E' },
  AV2: { color: '#2563EB', bg: '#DBEAFE', text: '#1E3A8A' },
  AV3: { color: '#7C3AED', bg: '#EDE9FE', text: '#4C1D95' },
};

const getDaysInMonth = (year: number, month: number) =>
  new Date(year, month, 0).getDate();

const getFirstDayOfMonth = (year: number, month: number) => {
  const day = new Date(year, month - 1, 1).getDay();
  return day === 0 ? 6 : day - 1;
};

const formatDate = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const todayStr = formatDate(
  new Date().getFullYear(),
  new Date().getMonth() + 1,
  new Date().getDate(),
);

interface Props {
  members: TeamMember[];
}

const AuditCalendarScreen: React.FC<Props> = ({ members }) => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');

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

  const memberOptions = useMemo(
    () => [
      { label: 'Todos los ingenieros', value: '' },
      ...members.map((m) => ({ label: m.name, value: m.id })),
    ],
    [members],
  );

  const memberById = useCallback(
    (id: string) => members.find((m) => m.id === id),
    [members],
  );

  const toggleMonth = (m: number) => {
    setSelectedMonths((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
    );
  };

  // Eventos filtrados por mes + ingeniero (para estadísticas y calendarios)
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const [, mo] = e.date.split('-').map(Number);
      const monthOk = selectedMonths.length === 0 || selectedMonths.includes(mo);
      const memberOk = !selectedMemberId || e.memberId === selectedMemberId;
      return monthOk && memberOk;
    });
  }, [events, selectedMonths, selectedMemberId]);

  // Stats sobre los eventos filtrados
  const stats = useMemo(() => {
    const base = {
      AV1: { total: 0, cumplidos: 0, noCumplidos: 0 },
      AV2: { total: 0, cumplidos: 0, noCumplidos: 0 },
      AV3: { total: 0, cumplidos: 0, noCumplidos: 0 },
    };
    for (const ev of filteredEvents) {
      const t = ev.tipo as AuditType;
      if (!base[t]) continue;
      base[t].total++;
      if (ev.cumplido) base[t].cumplidos++;
      else base[t].noCumplidos++;
    }
    return base;
  }, [filteredEvents]);

  const totalGeneral = stats.AV1.total + stats.AV2.total + stats.AV3.total;
  const totalCumplidos = stats.AV1.cumplidos + stats.AV2.cumplidos + stats.AV3.cumplidos;
  const totalNoCumplidos = stats.AV1.noCumplidos + stats.AV2.noCumplidos + stats.AV3.noCumplidos;

  const monthsToRender =
    selectedMonths.length > 0
      ? [...selectedMonths].sort((a, b) => a - b)
      : Array.from({ length: 12 }, (_, i) => i + 1);

  const openCreate = (date: string) => {
    setSelectedDate(date);
    setEditingEvent(null);
    setMemberId(selectedMemberId || members[0]?.id || '');
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
    // Para el modal del día, mostrar TODOS los eventos del día (sin filtro de miembro)
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
      const payload = { memberId, date: selectedDate, tipo, cumplido, detalle };
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
      setFormVisible(false);
      await loadEvents();
    } catch (err) {
      console.error('Error eliminando auditoría:', err);
    }
  };

  const hasActiveFilters = selectedMonths.length > 0 || !!selectedMemberId;

  const clearFilters = () => {
    setSelectedMonths([]);
    setSelectedMemberId('');
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Cargando auditorías...</Text>
      </View>
    );
  }

  const selectedMember = selectedMemberId ? memberById(selectedMemberId) : null;

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
            tintColor="#2563EB"
          />
        }
      >

        {/* ── FILTROS ── */}
        <View style={styles.filterCard}>
          <View style={styles.filterCardHeader}>
            <Text style={styles.filterCardTitle}>Filtros</Text>
            {hasActiveFilters && (
              <TouchableOpacity onPress={clearFilters} activeOpacity={0.7} style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>✕ Limpiar</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Filtro ingeniero */}
          <Text style={styles.filterLabel}>Profesional:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            <TouchableOpacity
              style={[styles.chip, !selectedMemberId && styles.chipActive]}
              onPress={() => setSelectedMemberId('')}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, !selectedMemberId && styles.chipTextActive]}>
                Todos
              </Text>
            </TouchableOpacity>
            {members.map((m) => {
              const active = selectedMemberId === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.chip,
                    active && styles.chipActiveMember,
                    active && { borderColor: m.color },
                  ]}
                  onPress={() => setSelectedMemberId(active ? '' : m.id)}
                  activeOpacity={0.8}
                >
                  {active && (
                    <View style={[styles.chipDot, { backgroundColor: m.color }]} />
                  )}
                  <Text
                    style={[
                      styles.chipText,
                      active && { color: m.color, fontWeight: '700' },
                    ]}
                    numberOfLines={1}
                  >
                    {m.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Filtro mes */}
          <Text style={[styles.filterLabel, { marginTop: 12 }]}>Administrador:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            <TouchableOpacity
              style={[styles.chip, selectedMonths.length === 0 && styles.chipActive]}
              onPress={() => setSelectedMonths([])}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, selectedMonths.length === 0 && styles.chipTextActive]}>
                Todos
              </Text>
            </TouchableOpacity>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
              const active = selectedMonths.includes(m);
              return (
                <TouchableOpacity
                  key={m}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleMonth(m)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {MONTHS_ES[m - 1].slice(0, 3)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── ESTADÍSTICAS ── */}
        <View style={styles.statsCard}>
          {/* Encabezado con contexto del filtro */}
          <View style={styles.statsHeader}>
            <View>
              <Text style={styles.statsTitle}>Resumen de auditorías</Text>
              <Text style={styles.statsSubtitle}>
                {selectedMember ? selectedMember.name : 'Todos los profesionales'}
                {selectedMonths.length === 1
                  ? ` · ${MONTHS_ES[selectedMonths[0] - 1]}`
                  : selectedMonths.length > 1
                  ? ` · ${selectedMonths.length} meses`
                  : ' · 2026 completo'}
              </Text>
            </View>
            {selectedMember && (
              <View style={[styles.memberAvatarLg, { backgroundColor: selectedMember.color }]}>
                <Text style={styles.memberAvatarLgText}>{selectedMember.initials}</Text>
              </View>
            )}
          </View>

          {/* Totales generales */}
          <View style={styles.totalesRow}>
            <View style={[styles.totalBox, styles.totalBoxBlue]}>
              <Text style={[styles.totalNum, { color: '#1E3A8A' }]}>{totalGeneral}</Text>
              <Text style={[styles.totalLbl, { color: '#3B82F6' }]}>Total</Text>
            </View>
            <View style={[styles.totalBox, styles.totalBoxGreen]}>
              <Text style={[styles.totalNum, { color: '#065F46' }]}>{totalCumplidos}</Text>
              <Text style={[styles.totalLbl, { color: '#059669' }]}>Cumplidas</Text>
            </View>
            <View style={[styles.totalBox, styles.totalBoxRed]}>
              <Text style={[styles.totalNum, { color: '#991B1B' }]}>{totalNoCumplidos}</Text>
              <Text style={[styles.totalLbl, { color: '#DC2626' }]}>No cumplidas</Text>
            </View>
          </View>

          {/* Desglose por tipo */}
          <View style={styles.desgloseSep} />
          <Text style={styles.desgloseTitle}>Desglose por tipo</Text>

          {(['AV1', 'AV2', 'AV3'] as AuditType[]).map((t) => {
            const s = stats[t];
            const c = AV_COLORS[t];
            const pct = s.total > 0 ? Math.round((s.cumplidos / s.total) * 100) : 0;
            return (
              <View key={t} style={styles.desgloseRow}>
                {/* Etiqueta tipo */}
                <View style={[styles.desgloseBadge, { backgroundColor: c.bg }]}>
                  <Text style={[styles.desgloseBadgeText, { color: c.text }]}>{t}</Text>
                </View>

                {/* Barra de progreso */}
                <View style={styles.barWrap}>
                  <View style={styles.barBg}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${pct}%` as any, backgroundColor: c.color },
                      ]}
                    />
                  </View>
                  <Text style={[styles.barPct, { color: c.color }]}>{pct}%</Text>
                </View>

                {/* Conteos */}
                <View style={styles.desgloseNums}>
                  <View style={styles.desgloseNumItem}>
                    <Text style={[styles.desgloseNum, { color: c.color }]}>{s.total}</Text>
                    <Text style={styles.desgloseNumLbl}>total</Text>
                  </View>
                  <View style={styles.desgloseNumSep} />
                  <View style={styles.desgloseNumItem}>
                    <Text style={[styles.desgloseNum, { color: '#059669' }]}>{s.cumplidos}</Text>
                    <Text style={styles.desgloseNumLbl}>✓</Text>
                  </View>
                  <View style={styles.desgloseNumSep} />
                  <View style={styles.desgloseNumItem}>
                    <Text style={[styles.desgloseNum, { color: '#DC2626' }]}>{s.noCumplidos}</Text>
                    <Text style={styles.desgloseNumLbl}>✗</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* ── CALENDARIOS ── */}
        {monthsToRender.map((month) => {
          const daysInMonth = getDaysInMonth(YEAR, month);
          const firstDayOffset = getFirstDayOfMonth(YEAR, month);

          // Para los badges del mes usamos filteredEvents
          const monthFiltered = filteredEvents.filter((e) => {
            const [, m] = e.date.split('-').map(Number);
            return m === month;
          });

          const monthStats = {
            AV1: monthFiltered.filter((e) => e.tipo === 'AV1').length,
            AV2: monthFiltered.filter((e) => e.tipo === 'AV2').length,
            AV3: monthFiltered.filter((e) => e.tipo === 'AV3').length,
            cumplidos: monthFiltered.filter((e) => e.cumplido).length,
            noCumplidos: monthFiltered.filter((e) => !e.cumplido).length,
          };

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
                <View style={styles.monthBadgesRow}>
                  {(['AV1', 'AV2', 'AV3'] as AuditType[]).map((t) =>
                    monthStats[t] > 0 ? (
                      <View key={t} style={[styles.monthMiniBadge, { backgroundColor: AV_COLORS[t].bg }]}>
                        <Text style={[styles.monthMiniBadgeText, { color: AV_COLORS[t].text }]}>
                          {t} {monthStats[t]}
                        </Text>
                      </View>
                    ) : null,
                  )}
                  {monthStats.cumplidos > 0 && (
                    <View style={styles.monthMiniBadgeGreen}>
                      <Text style={styles.monthMiniBadgeGreenText}>✓ {monthStats.cumplidos}</Text>
                    </View>
                  )}
                  {monthStats.noCumplidos > 0 && (
                    <View style={styles.monthMiniBadgeRed}>
                      <Text style={styles.monthMiniBadgeRedText}>✗ {monthStats.noCumplidos}</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.weekRow}>
                {DAYS_ES.map((d) => (
                  <Text key={d} style={styles.weekDay}>{d}</Text>
                ))}
              </View>

              {Array.from({ length: cells.length / 7 }).map((_, rowIdx) => (
                <View key={rowIdx} style={styles.gridRow}>
                  {cells.slice(rowIdx * 7, rowIdx * 7 + 7).map((cell, colIdx) => {
                    if (!cell.day || !cell.date) {
                      return <View key={colIdx} style={styles.emptyCell} />;
                    }

                    // Celdas del calendario: filtrar por ingeniero si hay filtro activo
                    const cellEvents = filteredEvents.filter((e) => e.date === cell.date);
                    const isToday = cell.date === todayStr;

                    return (
                      <TouchableOpacity
                        key={colIdx}
                        style={[
                          styles.dayCell,
                          isToday && styles.todayCell,
                          cellEvents.length > 0 && styles.hasCellEvents,
                        ]}
                        onPress={() => onDayPress(cell.date!)}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.dayNum, isToday && styles.todayNum]}>
                          {cell.day}
                        </Text>

                        <View style={styles.eventStack}>
                          {cellEvents.slice(0, 2).map((ev) => {
                            const m = memberById(ev.memberId);
                            const c = AV_COLORS[ev.tipo as AuditType] || AV_COLORS.AV1;
                            return (
                              <View
                                key={ev.id}
                                style={[styles.eventChip, { borderLeftColor: c.color }]}
                              >
                                <View style={[styles.eventDot, { backgroundColor: m?.color || c.color }]} />
                                <Text style={styles.eventChipText} numberOfLines={1}>
                                  {ev.tipo} · {m?.initials || '??'}
                                </Text>
                                {ev.cumplido && <Text style={styles.checkIcon}>✓</Text>}
                              </View>
                            );
                          })}
                          {cellEvents.length > 2 && (
                            <View style={styles.moreChip}>
                              <Text style={styles.moreChipText}>+{cellEvents.length - 2} más</Text>
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

      {/* ── MODAL: DÍA ── */}
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
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Auditorías · {selectedDate?.split('-')[2]}{' '}
                {selectedDate ? MONTHS_ES[parseInt(selectedDate.split('-')[1], 10) - 1] : ''}
              </Text>
              <TouchableOpacity onPress={() => setDayModalVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={dayEvents}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const m = memberById(item.memberId);
                const c = AV_COLORS[item.tipo as AuditType] || AV_COLORS.AV1;
                return (
                  <TouchableOpacity
                    style={[styles.dayModalItem, { borderLeftColor: c.color }]}
                    onPress={() => {
                      setDayModalVisible(false);
                      openEdit(item);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.dayModalItemTop}>
                      <View style={[styles.dayModalBadge, { backgroundColor: c.bg }]}>
                        <Text style={[styles.dayModalBadgeText, { color: c.text }]}>{item.tipo}</Text>
                      </View>
                      <View style={[styles.cumpliBadge, item.cumplido ? styles.cumpliSi : styles.cumpliNo]}>
                        <Text style={[styles.cumpliText, item.cumplido ? styles.cumpliSiText : styles.cumpliNoText]}>
                          {item.cumplido ? '✓ Cumplido' : '✗ No cumplido'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.dayModalMemberRow}>
                      {m && (
                        <View style={[styles.memberDot2, { backgroundColor: m.color }]}>
                          <Text style={styles.memberDot2Text}>{m.initials}</Text>
                        </View>
                      )}
                      <Text style={styles.dayModalMemberName}>{m?.name || 'Ingeniero'}</Text>
                    </View>
                    {item.detalle ? (
                      <Text style={styles.dayModalDetalle} numberOfLines={2}>{item.detalle}</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              }}
              ListFooterComponent={
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => {
                    setDayModalVisible(false);
                    if (selectedDate) openCreate(selectedDate);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.addBtnText}>+ Nueva auditoría</Text>
                </TouchableOpacity>
              }
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── MODAL: FORMULARIO ── */}
      <Modal
        visible={formVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFormVisible(false)}
      >
        <View style={styles.formOverlay}>
          <View style={styles.formSheet}>
            <View style={styles.formHeader}>
              <View style={{ flexShrink: 1, paddingRight: 10 }}>
                <Text style={styles.formTitle}>
                  {editingEvent ? 'Editar auditoría' : 'Nueva auditoría'}
                </Text>
                {selectedDate && (
                  <Text style={styles.formDate}>
                    {parseInt(selectedDate.split('-')[2], 10)} de{' '}
                    {MONTHS_ES[parseInt(selectedDate.split('-')[1], 10) - 1]} de {YEAR}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.formCloseBtn}
                onPress={() => setFormVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.formCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.formBody}>
                <CustomPicker
                  label="Ingeniero"
                  value={memberId}
                  options={memberOptions.filter((o) => o.value !== '')}
                  onSelect={setMemberId}
                  placeholder="Seleccionar ingeniero..."
                  searchable
                />

                <CustomPicker
                  label="Tipo de auditoría"
                  value={tipo}
                  options={AUDIT_TYPES}
                  onSelect={(v) => setTipo(v as AuditType)}
                  placeholder="Seleccionar tipo..."
                />

                <View style={styles.checkRow}>
                  <View>
                    <Text style={styles.checkLabel}>¿Cumplido?</Text>
                    <Text style={styles.checkHint}>
                      Indica si la auditoría fue completada
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.checkBtn,
                      cumplido ? styles.checkBtnSi : styles.checkBtnNo,
                    ]}
                    onPress={() => setCumplido((v) => !v)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.checkBtnText,
                        cumplido ? styles.checkBtnTextSi : styles.checkBtnTextNo,
                      ]}
                    >
                      {cumplido ? '✓  Sí' : '✗  No'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.fieldWrapper}>
                  <Text style={styles.fieldLabel}>Descripción (opcional)</Text>
                  <TextInput
                    style={styles.textArea}
                    value={detalle}
                    onChangeText={setDetalle}
                    placeholder="Escribe una observación o detalle..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.formActions}>
                  {editingEvent && (
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={async () => {
                        if (editingEvent) await removeEvent(editingEvent.id);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.deleteBtnText}>🗑  Eliminar</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={save}
                    disabled={saving}
                    activeOpacity={0.85}
                  >
                    {saving ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.saveBtnText}>
                        {editingEvent ? '✓  Actualizar' : '✓  Guardar'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  content: { padding: 12 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#6B7280', fontWeight: '600' },

  // ── FILTROS ──
  filterCard: {
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
  filterCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  filterCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  clearBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  clearBtnText: { fontSize: 11, fontWeight: '700', color: '#DC2626' },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  chipScroll: { flexDirection: 'row' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 6,
    gap: 5,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipActiveMember: { backgroundColor: '#F8FAFF' },
  chipDot: { width: 7, height: 7, borderRadius: 999 },
  chipText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  chipTextActive: { color: '#FFF' },

  // ── ESTADÍSTICAS ──
  statsCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  statsTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },
  statsSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 2, fontWeight: '500' },
  memberAvatarLg: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarLgText: { color: '#FFF', fontWeight: '900', fontSize: 13 },

  totalesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  totalBox: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  totalBoxBlue: { backgroundColor: '#EFF6FF' },
  totalBoxGreen: { backgroundColor: '#ECFDF5' },
  totalBoxRed: { backgroundColor: '#FEF2F2' },
  totalNum: { fontSize: 26, fontWeight: '900', letterSpacing: -1 },
  totalLbl: { fontSize: 11, fontWeight: '700', marginTop: 2 },

  desgloseSep: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 12,
  },
  desgloseTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  desgloseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  desgloseBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    minWidth: 44,
    alignItems: 'center',
  },
  desgloseBadgeText: { fontSize: 12, fontWeight: '900' },
  barWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  barBg: {
    flex: 1,
    height: 7,
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    overflow: 'hidden',
  },
  barFill: {
    height: 7,
    borderRadius: 999,
    minWidth: 4,
  },
  barPct: { fontSize: 11, fontWeight: '700', minWidth: 30, textAlign: 'right' },
  desgloseNums: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  desgloseNumItem: { alignItems: 'center', minWidth: 26 },
  desgloseNum: { fontSize: 14, fontWeight: '900' },
  desgloseNumLbl: { fontSize: 9, color: '#9CA3AF', fontWeight: '600' },
  desgloseNumSep: { width: 1, height: 20, backgroundColor: '#E5E7EB' },

  // ── CALENDARIO ──
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
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  monthName: { fontSize: 17, fontWeight: '800', color: '#FFF', letterSpacing: -0.3 },
  monthBadgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  monthMiniBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  monthMiniBadgeText: { fontSize: 10, fontWeight: '900' },
  monthMiniBadgeGreen: { backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  monthMiniBadgeGreenText: { fontSize: 10, fontWeight: '900', color: '#065F46' },
  monthMiniBadgeRed: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  monthMiniBadgeRedText: { fontSize: 10, fontWeight: '900', color: '#991B1B' },

  weekRow: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  weekDay: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '800', color: '#1E40AF' },
  gridRow: { flexDirection: 'row', paddingHorizontal: 4, paddingVertical: 2 },
  emptyCell: { flex: 1, margin: 2, minHeight: 92 },
  dayCell: {
    flex: 1,
    minHeight: 92,
    margin: 2,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 6,
  },
  todayCell: { borderWidth: 2, borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  hasCellEvents: { backgroundColor: '#FFFFFF' },
  dayNum: { fontSize: 12, fontWeight: '900', color: '#374151' },
  todayNum: { color: '#2563EB' },
  eventStack: { marginTop: 5, gap: 4 },
  eventChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFF',
    borderRadius: 8,
    borderLeftWidth: 3,
    paddingVertical: 3,
    paddingHorizontal: 5,
  },
  eventDot: { width: 6, height: 6, borderRadius: 999 },
  eventChipText: { flex: 1, fontSize: 9, fontWeight: '700', color: '#334155' },
  checkIcon: { fontSize: 9, fontWeight: '900', color: '#059669' },
  moreChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  moreChipText: { fontSize: 9, fontWeight: '800', color: '#3730A3' },

  // ── MODAL DÍA ──
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
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#111827', flex: 1, paddingRight: 10 },
  modalClose: { fontSize: 18, color: '#6B7280', fontWeight: '700' },
  dayModalItem: {
    marginHorizontal: 14,
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    borderLeftWidth: 4,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dayModalItemTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  dayModalBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  dayModalBadgeText: { fontSize: 12, fontWeight: '900' },
  cumpliBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  cumpliSi: { backgroundColor: '#D1FAE5' },
  cumpliNo: { backgroundColor: '#FEE2E2' },
  cumpliText: { fontSize: 11, fontWeight: '800' },
  cumpliSiText: { color: '#065F46' },
  cumpliNoText: { color: '#991B1B' },
  dayModalMemberRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  memberDot2: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  memberDot2Text: { color: '#FFF', fontSize: 9, fontWeight: '900' },
  dayModalMemberName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  dayModalDetalle: { fontSize: 12, color: '#6B7280', marginTop: 6 },
  addBtn: {
    margin: 14,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    alignItems: 'center',
  },
  addBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },

  // ── MODAL FORMULARIO ──
  formOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  formSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderTopWidth: 4,
    borderTopColor: '#2563EB',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  formTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  formDate: { fontSize: 13, color: '#6B7280', marginTop: 2, textTransform: 'capitalize' },
  formCloseBtn: {
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCloseBtnText: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
  formBody: { padding: 20, paddingBottom: 40 },
  checkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 14,
  },
  checkLabel: { fontSize: 14, fontWeight: '700', color: '#374151' },
  checkHint: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  checkBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, minWidth: 80, alignItems: 'center' },
  checkBtnSi: { backgroundColor: '#D1FAE5' },
  checkBtnNo: { backgroundColor: '#FEE2E2' },
  checkBtnText: { fontSize: 13, fontWeight: '800' },
  checkBtnTextSi: { color: '#065F46' },
  checkBtnTextNo: { color: '#991B1B' },
  fieldWrapper: { marginBottom: 14 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textArea: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#111827',
    minHeight: 100,
  },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  deleteBtn: { flex: 1, backgroundColor: '#FEE2E2', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  deleteBtnText: { fontSize: 15, fontWeight: '600', color: '#DC2626' },
  saveBtn: { flex: 2, backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});

export default AuditCalendarScreen;