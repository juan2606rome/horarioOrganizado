import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  DEPARTMENTS,
  getMunicipalitiesByDepartment,
} from '../data/colombiaData';
import { EVENT_TYPES, getEventType } from '../data/eventTypes';
import { CalendarService } from '../services/calendarService';
import { CalendarEvent, TeamMember } from '../types';
import CustomPicker from './CustomPicker';

interface TaskModalProps {
  visible: boolean;
  date: string | null;
  member: TeamMember | null;
  existingEvent?: CalendarEvent | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}

const MONTHS_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const formatDateLabel = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return `${day} de ${MONTHS_ES[month - 1]} de ${year}`;
};

const normalizeDepartmentName = (value: string) => {
  const dept = DEPARTMENTS.find((d) => d.id === value || d.name === value);
  return dept?.name || value || '';
};

const getDepartmentObject = (value: string) => {
  return DEPARTMENTS.find((d) => d.id === value || d.name === value) || null;
};

const TaskModal: React.FC<TaskModalProps> = ({
  visible,
  date,
  member,
  existingEvent,
  onClose,
  onSaved,
  onDeleted,
}) => {
  const [tipo, setTipo] = useState('');
  const [departamento, setDepartamento] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [detalle, setDetalle] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'view' | 'edit' | 'create'>('create');

  useEffect(() => {
    if (existingEvent) {
      setTipo(existingEvent.tipo || '');
      setDepartamento(normalizeDepartmentName(existingEvent.departamento || ''));
      setMunicipio(existingEvent.municipio || '');
      setDetalle(existingEvent.detalle || '');
      setMode('view');
    } else {
      setTipo('');
      setDepartamento('');
      setMunicipio('');
      setDetalle('');
      setMode('create');
    }
  }, [existingEvent, visible]);

  const tipoOptions = useMemo(
    () => EVENT_TYPES.map((e) => ({ label: e.label, value: e.id })),
    [],
  );

  const deptOptions = useMemo(
    () => DEPARTMENTS.map((d) => ({
      label: d.name,
      value: d.name,
    })),
    [],
  );

  const selectedDept = getDepartmentObject(departamento);

  const munOptions = useMemo(() => {
    if (!selectedDept) return [];

    const byId = getMunicipalitiesByDepartment(selectedDept.id);
    if (byId.length > 0) {
      return byId.map((m) => ({ label: m, value: m }));
    }

    const byName = getMunicipalitiesByDepartment(selectedDept.name);
    return byName.map((m) => ({ label: m, value: m }));
  }, [selectedDept]);

  const selectedEventType = tipo ? getEventType(tipo) : null;
  const isReadOnly = mode === 'view';
  const titleLabel = date ? formatDateLabel(date) : '';

  const handleDeptChange = (val: string) => {
    setDepartamento(val);
    setMunicipio('');
  };

  const validate = () => {
    if (!tipo) {
      Alert.alert('Error', 'Selecciona el tipo de actividad.');
      return false;
    }
    if (!departamento) {
      Alert.alert('Error', 'Selecciona el departamento.');
      return false;
    }
    if (!municipio) {
      Alert.alert('Error', 'Selecciona el municipio.');
      return false;
    }
    return true;
  };

const handleSave = async () => {
  if (!validate() || !date || !member) return;

  setLoading(true);
  try {
    const deptName = selectedDept?.name || departamento;

    if (existingEvent) {
      await CalendarService.updateEvent(existingEvent.id, {
        tipo,
        departamento: deptName,
        municipio,
        detalle,
      });
    } else {
      await CalendarService.createEvent({
        memberId: member.id,
        date,
        tipo,
        departamento: deptName,
        municipio,
        detalle,
      });
    }

    onSaved();
  } catch (err) {
    console.error('Error guardando actividad:', err);
    Alert.alert(
      'Error',
      err instanceof Error ? err.message : 'No se pudo guardar la actividad.'
    );
  } finally {
    setLoading(false);
  }
};

  const handleDelete = () => {
    if (!existingEvent) return;

    Alert.alert(
      'Eliminar actividad',
      '¿Estás seguro de que deseas eliminar esta actividad?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await CalendarService.deleteEvent(existingEvent.id);
              onDeleted();
            } catch {
              Alert.alert('Error', 'No se pudo eliminar la actividad.');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={[styles.header, member && { borderTopColor: member.color }]}>
            <View style={styles.headerLeft}>
              {member && (
                <View style={[styles.avatar, { backgroundColor: member.color }]}>
                  <Text style={styles.avatarText}>{member.initials}</Text>
                </View>
              )}
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.memberName}>
                  {member?.name || 'Actividad'}
                </Text>
                <Text style={styles.dateLabel}>{titleLabel}</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {selectedEventType && (
              <View
                style={[
                  styles.typeBadge,
                  { backgroundColor: selectedEventType.bgColor },
                ]}
              >
                <View
                  style={[
                    styles.typeDot,
                    { backgroundColor: selectedEventType.color },
                  ]}
                />
                <Text
                  style={[
                    styles.typeBadgeText,
                    { color: selectedEventType.textColor },
                  ]}
                >
                  {selectedEventType.label}
                </Text>
              </View>
            )}

            {isReadOnly ? (
              <View>
                <InfoRow
                  label="TIPO"
                  value={selectedEventType?.label || tipo || ''}
                  color={selectedEventType?.color}
                />
                <InfoRow
                  label="DEPARTAMENTO"
                  value={selectedDept?.name || existingEvent?.departamento || ''}
                />
                <InfoRow
                  label="MUNICIPIO"
                  value={existingEvent?.municipio || municipio || ''}
                />
                {existingEvent?.detalle ? (
                  <InfoRow
                    label="DETALLE"
                    value={existingEvent.detalle}
                    multiline
                  />
                ) : null}

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => setMode('edit')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.editBtnText}>✏️  Editar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={handleDelete}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.deleteBtnText}>🗑  Eliminar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View>
                <CustomPicker
                  label="Tipo de actividad"
                  value={tipo}
                  options={tipoOptions}
                  onSelect={setTipo}
                  placeholder="Seleccionar tipo..."
                />

                <CustomPicker
                  label="Departamento"
                  value={departamento}
                  options={deptOptions}
                  onSelect={handleDeptChange}
                  placeholder="Seleccionar departamento..."
                  searchable
                />

                <CustomPicker
                  label="Municipio"
                  value={municipio}
                  options={munOptions}
                  onSelect={setMunicipio}
                  placeholder={
                    departamento
                      ? 'Seleccionar municipio...'
                      : 'Primero selecciona un departamento'
                  }
                  searchable
                />

                <View style={styles.fieldWrapper}>
                  <Text style={styles.fieldLabel}>DETALLE</Text>
                  <TextInput
                    style={styles.textArea}
                    value={detalle}
                    onChangeText={setDetalle}
                    placeholder="Descripción de la actividad (opcional)..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.actionRow}>
                  {mode === 'edit' && (
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => setMode('view')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.cancelBtnText}>Cancelar</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.saveBtn,
                      { backgroundColor: member?.color || '#2563EB' },
                    ]}
                    onPress={handleSave}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.saveBtnText}>
                        {mode === 'edit' ? '✓  Actualizar' : '✓  Guardar'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

interface InfoRowProps {
  label: string;
  value: string;
  color?: string;
  multiline?: boolean;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value, color, multiline }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text
      style={[
        styles.infoValue,
        color ? { color } : null,
        multiline ? { lineHeight: 22 } : null,
      ]}
    >
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  header: {
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  memberName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  dateLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  closeBtn: {
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 20,
    paddingBottom: 40,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
    alignSelf: 'flex-start',
    gap: 8,
  },
  typeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  infoRow: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 16,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 1,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  fieldWrapper: {
    marginBottom: 14,
  },
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
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  editBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  editBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  deleteBtn: {
    flex: 1,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#DC2626',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveBtn: {
    flex: 2,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
});

export default TaskModal;