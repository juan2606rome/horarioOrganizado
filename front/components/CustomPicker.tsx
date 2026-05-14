import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  TextInput,
  Pressable,
} from 'react-native';

interface PickerOption {
  label: string;
  value: string;
}

interface CustomPickerProps {
  label: string;
  value: string;
  options: PickerOption[];
  onSelect: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
}

const normalizeText = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const CustomPicker: React.FC<CustomPickerProps> = ({
  label,
  value,
  options,
  onSelect,
  placeholder = 'Seleccionar...',
  searchable = false,
}) => {
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    if (!searchable) return options;

    const q = normalizeText(search);
    if (!q) return options;

    return options.filter((o) => {
      const labelMatch = normalizeText(o.label).includes(q);
      const valueMatch = normalizeText(o.value).includes(q);
      return labelMatch || valueMatch;
    });
  }, [options, search, searchable]);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => {
          setSearch('');
          setVisible(true);
        }}
        activeOpacity={0.7}
      >
        <Text style={[styles.triggerText, !selected && styles.placeholder]}>
          {selected ? selected.label : placeholder}
        </Text>
        <Text style={styles.arrow}>▼</Text>
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setVisible(false)}
          />

          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            {searchable && (
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar..."
                placeholderTextColor="#9CA3AF"
                value={search}
                onChangeText={setSearch}
                autoFocus
              />
            )}

            <FlatList
              data={filtered}
              keyExtractor={(item) => item.value}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.option,
                    item.value === value && styles.optionSelected,
                  ]}
                  onPress={() => {
                    onSelect(item.value);
                    setVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      item.value === value && styles.optionTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {item.value === value && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  triggerText: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  placeholder: {
    color: '#9CA3AF',
    fontWeight: '400',
  },
  arrow: {
    fontSize: 10,
    color: '#6B7280',
    marginLeft: 8,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 30,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  closeBtn: {
    fontSize: 18,
    color: '#6B7280',
    padding: 4,
  },
  searchInput: {
    margin: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F3F4F6',
  },
  optionSelected: {
    backgroundColor: '#EFF6FF',
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
  },
  optionTextSelected: {
    color: '#2563EB',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '700',
  },
});

export default CustomPicker;