// app/auditoria.tsx
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AuditCalendarScreen from '../screens/AuditCalendarScreen';
import { CalendarService } from '../services/calendarService';
import { TeamMember } from '../types';

export default function AuditoriaPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

useEffect(() => {
  CalendarService.getMembers()
    .then((data) => {
      const filtered = (Array.isArray(data) ? data : []).filter(
        (m) => !/\((DIRECTOR|DIRECTORA)\)/i.test(m.name)
      );

      setMembers(filtered);
    })
    .catch((err) => console.error('Error cargando miembros:', err))
    .finally(() => setLoading(false));
}, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Cargando panel...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#1E3A8A" />

      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Text style={styles.headerIconText}>🔍</Text>
        </View>
        <View>
          <Text style={styles.title}>Panel de Auditorías</Text>
          <Text style={styles.subtitle}>AV1 · AV2 · AV3 — Creado por: Alejandra Alvarado</Text>
        </View>
      </View>

      <AuditCalendarScreen members={members} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#1E3A8A',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#F1F5F9',
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  header: {
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 6,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: {
    fontSize: 22,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    color: '#93C5FD',
    fontWeight: '500',
    marginTop: 1,
  },
});