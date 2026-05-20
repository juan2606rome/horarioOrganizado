import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { CalendarService } from '../services/calendarService';
import { TeamMember } from '../types';

interface AdminProps {
  visible: boolean;
  onClose: () => void;
  onChanged: () => void;
}

type AdminMember = TeamMember & {
  sortOrder?: number;
  active?: boolean;
  createdAt?: string;
};

type MemberForm = {
  id: string;
  name: string;
  color: string;
  initials: string;
  sortOrder: number;
  active: boolean;
};

const DEFAULT_COLORS = [
  '#2563EB',
  '#7C3AED',
  '#DB2777',
  '#DC2626',
  '#D97706',
  '#059669',
  '#0891B2',
  '#4F46E5',
  '#0F766E',
  '#9333EA',
];

const EMPTY_FORM: MemberForm = {
  id: '',
  name: '',
  color: '#2563EB',
  initials: '',
  sortOrder: 999,
  active: true,
};

const makeInitials = (name: string) => {
  const clean = name.trim();
  if (!clean) return '';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
};

const AdminScreen: React.FC<AdminProps> = ({ visible, onClose, onChanged }) => {
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [form, setForm] = useState<MemberForm>(EMPTY_FORM);

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'save' | 'delete' | null>(null);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');

  const [messageVisible, setMessageVisible] = useState(false);
  const [messageTitle, setMessageTitle] = useState('');
  const [messageText, setMessageText] = useState('');

  const selectedMember = useMemo(
    () => members.find((m) => m.id === selectedMemberId) || null,
    [members, selectedMemberId],
  );

  const loadMembers = async () => {
    try {
      setLoading(true);
      const data = await CalendarService.getMembers();
      setMembers(Array.isArray(data) ? (data as AdminMember[]) : []);
    } catch (err) {
      console.error('Error cargando miembros:', err);
      setMembers([]);
      setMessageTitle('Error');
      setMessageText('No se pudieron cargar los integrantes.');
      setMessageVisible(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadMembers();
      setSelectedMemberId(null);
      setForm(EMPTY_FORM);
    }
  }, [visible]);

  const resetForm = () => {
    setSelectedMemberId(null);
    setForm(EMPTY_FORM);
  };

  const startCreate = () => {
    const nextColor =
      DEFAULT_COLORS[members.length % DEFAULT_COLORS.length] || '#2563EB';

    setSelectedMemberId(null);
    setForm({
      id: '',
      name: '',
      color: nextColor,
      initials: '',
      sortOrder: members.length + 1,
      active: true,
    });
  };

  const startEdit = (member: AdminMember) => {
    setSelectedMemberId(member.id);
    setForm({
      id: member.id,
      name: member.name ?? '',
      color: member.color || '#2563EB',
      initials: member.initials || '',
      sortOrder: member.sortOrder ?? 999,
      active: member.active ?? true,
    });
  };

  const askSave = () => {
    if (!form.name.trim()) {
      setMessageTitle('Falta el nombre');
      setMessageText('Debes escribir un nombre para el integrante.');
      setMessageVisible(true);
      return;
    }

    setConfirmAction('save');
    setConfirmTitle(selectedMemberId ? 'Confirmar edición' : 'Confirmar creación');
    setConfirmMessage(
      selectedMemberId
        ? `Vas a guardar los cambios de "${form.name.trim()}".`
        : `Vas a crear al integrante "${form.name.trim()}".`,
    );
    setConfirmVisible(true);
  };

  const askDelete = () => {
    if (!selectedMemberId) return;

    setConfirmAction('delete');
    setConfirmTitle('Confirmar eliminación');
    setConfirmMessage(
      `Vas a eliminar a "${selectedMember?.name ?? form.name}". Esto también borrará todas sus actividades.`,
    );
    setConfirmVisible(true);
  };

  const executeAction = async () => {
    if (!confirmAction) return;

    try {
      setSaving(true);

      if (confirmAction === 'save') {
        const payload = {
          name: form.name.trim(),
          color: form.color,
          initials: (form.initials || makeInitials(form.name)).trim().toUpperCase(),
          sortOrder: Number(form.sortOrder) || 999,
          active: form.active,
        };

        if (selectedMemberId) {
          await CalendarService.updateMember(selectedMemberId, payload);
          setMessageTitle('Integrante actualizado');
          setMessageText('Los cambios se guardaron correctamente.');
        } else {
          await CalendarService.createMember(payload);
          setMessageTitle('Integrante creado');
          setMessageText('El nuevo integrante fue agregado correctamente.');
        }
      }

      if (confirmAction === 'delete' && selectedMemberId) {
        await CalendarService.deleteMember(selectedMemberId);
        setMessageTitle('Integrante eliminado');
        setMessageText('Se eliminó el integrante y todas sus actividades.');
        resetForm();
      }

      await loadMembers();
      onChanged();
    } catch (err: any) {
      console.error('Error en admin:', err);
      setMessageTitle('Error');
      setMessageText(err?.message || 'No se pudo completar la acción.');
      setMessageVisible(true);
    } finally {
      setSaving(false);
      setConfirmVisible(false);
      setConfirmAction(null);
    }
  };

  const pickColor = (color: string) => {
    setForm((current) => ({ ...current, color }));
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Administración de integrantes</Text>
            <Text style={styles.subtitle}>
              Crear, editar y eliminar usuarios del calendario
            </Text>
          </View>

          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <View style={styles.leftPanel}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Integrantes</Text>
              <TouchableOpacity style={styles.newBtn} onPress={startCreate} activeOpacity={0.8}>
                <Text style={styles.newBtnText}>+ Nuevo</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color="#2563EB" />
                <Text style={styles.loadingText}>Cargando...</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {members.length === 0 ? (
                  <Text style={styles.emptyText}>No hay integrantes registrados.</Text>
                ) : (
                  members.map((m) => {
                    const active = selectedMemberId === m.id;
                    return (
                      <TouchableOpacity
                        key={m.id}
                        style={[styles.memberItem, active && styles.memberItemActive]}
                        onPress={() => startEdit(m)}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.memberDot, { backgroundColor: m.color }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.memberName}>{m.name}</Text>
                          <Text style={styles.memberMeta}>
                            {m.initials || '--'} · orden {m.sortOrder ?? 999}
                          </Text>
                        </View>
                        {!m.active ? (
                          <View style={styles.inactiveBadge}>
                            <Text style={styles.inactiveBadgeText}>Inactivo</Text>
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            )}
          </View>

          <View style={styles.rightPanel}>
            <Text style={styles.formTitle}>
              {selectedMemberId ? 'Editar integrante' : 'Crear integrante'}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Nombre</Text>
              <TextInput
                value={form.name}
                onChangeText={(t) => setForm((c) => ({ ...c, name: t }))}
                placeholder="Nombre del integrante"
                placeholderTextColor="#94A3B8"
                style={styles.input}
              />

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Iniciales</Text>
                  <TextInput
                    value={form.initials}
                    onChangeText={(t) =>
                      setForm((c) => ({ ...c, initials: t.toUpperCase() }))
                    }
                    placeholder="AA"
                    placeholderTextColor="#94A3B8"
                    style={styles.input}
                    maxLength={4}
                  />
                </View>

                <TouchableOpacity
                  style={styles.autoBtn}
                  onPress={() =>
                    setForm((c) => ({ ...c, initials: makeInitials(c.name) }))
                  }
                  activeOpacity={0.8}
                >
                  <Text style={styles.autoBtnText}>Auto</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Color</Text>
              <View style={styles.colorRow}>
                {DEFAULT_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorDot,
                      { backgroundColor: color },
                      form.color === color && styles.colorDotActive,
                    ]}
                    onPress={() => pickColor(color)}
                    activeOpacity={0.8}
                  />
                ))}
              </View>

              <Text style={styles.label}>Orden</Text>
              <TextInput
                value={String(form.sortOrder)}
                onChangeText={(t) =>
                  setForm((c) => ({ ...c, sortOrder: Number(t) || 999 }))
                }
                placeholder="999"
                placeholderTextColor="#94A3B8"
                style={styles.input}
                keyboardType="numeric"
              />

              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setForm((c) => ({ ...c, active: !c.active }))}
                activeOpacity={0.85}
              >
                <View style={[styles.checkBox, form.active && styles.checkBoxActive]}>
                  {form.active ? <Text style={styles.checkMark}>✓</Text> : null}
                </View>
                <Text style={styles.toggleText}>Integrante activo</Text>
              </TouchableOpacity>

              <View style={styles.formPreview}>
                <Text style={styles.previewLabel}>Vista previa</Text>
                <View style={[styles.previewBadge, { backgroundColor: form.color }]}>
                  <Text style={styles.previewInitials}>
                    {(form.initials || makeInitials(form.name) || '??').slice(0, 3)}
                  </Text>
                </View>
                <Text style={styles.previewName}>
                  {form.name.trim() || 'Nombre'}
                </Text>
              </View>

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={askSave}
                  activeOpacity={0.85}
                >
                  <Text style={styles.saveBtnText}>Guardar</Text>
                </TouchableOpacity>

                {selectedMemberId ? (
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={askDelete}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.deleteBtnText}>Eliminar</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </ScrollView>
          </View>
        </View>

        <Modal
          visible={confirmVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setConfirmVisible(false)}
        >
          <TouchableOpacity
            style={styles.confirmOverlay}
            activeOpacity={1}
            onPress={() => setConfirmVisible(false)}
          >
            <TouchableOpacity activeOpacity={1} style={styles.confirmSheet}>
              <Text style={styles.confirmTitle}>{confirmTitle}</Text>
              <Text style={styles.confirmMessage}>{confirmMessage}</Text>

              <View style={styles.confirmActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setConfirmVisible(false)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.confirmBtn,
                    confirmAction === 'delete' && styles.confirmDeleteBtn,
                  ]}
                  onPress={executeAction}
                  activeOpacity={0.85}
                >
                  <Text style={styles.confirmBtnText}>
                    {saving ? 'Procesando...' : 'Confirmar'}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        <Modal
          visible={messageVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setMessageVisible(false)}
        >
          <TouchableOpacity
            style={styles.confirmOverlay}
            activeOpacity={1}
            onPress={() => setMessageVisible(false)}
          >
            <TouchableOpacity activeOpacity={1} style={styles.messageSheet}>
              <Text style={styles.confirmTitle}>{messageTitle}</Text>
              <Text style={styles.confirmMessage}>{messageText}</Text>

              <TouchableOpacity
                style={styles.okBtn}
                onPress={() => setMessageVisible(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.okBtnText}>Entendido</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  header: {
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: '#BFDBFE',
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  closeText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  leftPanel: {
    flex: 0.95,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 12,
  },
  rightPanel: {
    flex: 1.2,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  newBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  newBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 10,
  },
  loadingText: {
    color: '#6B7280',
    fontSize: 13,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 13,
    fontStyle: 'italic',
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  memberItemActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  memberDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  memberMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  inactiveBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
  },
  inactiveBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  formTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: '#111827',
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  autoBtn: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
  },
  autoBtnText: {
    color: '#075985',
    fontWeight: '800',
    fontSize: 12,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotActive: {
    borderColor: '#0F172A',
    transform: [{ scale: 1.08 }],
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    paddingVertical: 6,
  },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  checkBoxActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  checkMark: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
  },
  toggleText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  formPreview: {
    marginTop: 18,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    gap: 8,
  },
  previewLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  previewBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewInitials: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
  },
  previewName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#2563EB',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  deleteBtn: {
    flex: 1,
    backgroundColor: '#FEE2E2',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
  },
  deleteBtnText: {
    color: '#991B1B',
    fontSize: 14,
    fontWeight: '800',
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 22,
  },
  confirmSheet: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 18,
  },
  messageSheet: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  confirmMessage: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '800',
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmDeleteBtn: {
    backgroundColor: '#DC2626',
  },
  confirmBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  okBtn: {
    marginTop: 16,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  okBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
});

export default AdminScreen;