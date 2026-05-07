import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MonthCalendar from '../components/MonthCalendar';
import { EVENT_TYPES } from '../data/eventTypes';
import { CalendarService } from '../services/calendarService';
import { CalendarEvent, TeamMember } from '../types';

interface MemberCalendarScreenProps {
  member: TeamMember;
}

const YEAR = 2026;
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

const MemberCalendarScreen: React.FC<MemberCalendarScreenProps> = ({ member }) => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

const loadEvents = useCallback(async () => {
  try {
    const data = await CalendarService.getEvents({
      memberId: member.id,
    });

    setEvents(data);
  } catch (err) {
    console.error('Error loading events:', err);
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
}, [member.id]);

  useEffect(() => {
    setLoading(true);
    loadEvents();
  }, [loadEvents]);

  const onRefresh = () => {
    setRefreshing(true);
    loadEvents();
  };

  // Stats
  const totalEvents = events.length;
  const typeBreakdown = EVENT_TYPES.map((et) => ({
    ...et,
    count: events.filter((e) => e.tipo === et.id).length,
  })).filter((et) => et.count > 0);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={member.color} />
        <Text style={styles.loadingText}>Cargando calendario...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[member.color]}
          tintColor={member.color}
        />
      }
    >
      {/* Member stats bar */}
      <View style={[styles.statsBar, { borderLeftColor: member.color }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: member.color }]}>{totalEvents}</Text>
          <Text style={styles.statLabel}>Actividades{'\n'}en 2026</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.typesRow}>
          {typeBreakdown.length === 0 ? (
            <Text style={styles.noActivity}>Sin actividades registradas</Text>
          ) : (
            typeBreakdown.map((et) => (
              <View key={et.id} style={[styles.typePill, { backgroundColor: et.bgColor }]}>
                <View style={[styles.typePillDot, { backgroundColor: et.color }]} />
                <Text style={[styles.typePillText, { color: et.textColor }]}>
                  {et.label.split(' ')[0]} ({et.count})
                </Text>
              </View>
            ))
          )}
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Leyenda de tipos:</Text>
        <View style={styles.legendItems}>
          {EVENT_TYPES.map((et) => (
            <View key={et.id} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: et.color }]} />
              <Text style={styles.legendText}>{et.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 12 monthly calendars */}
      {MONTHS.map((month) => (
        <MonthCalendar
          key={month}
          year={YEAR}
          month={month}
          member={member}
          events={events}
          onEventsChanged={loadEvents}
        />
      ))}

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
  statsBar: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statItem: {
    alignItems: 'center',
    paddingRight: 16,
    minWidth: 60,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '900',
    color: '#2563EB',
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
    lineHeight: 14,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 12,
    alignSelf: 'stretch',
  },
  typesRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'flex-start',
  },
  noActivity: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
    alignSelf: 'center',
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  typePillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  typePillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  legend: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
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
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
});

export default MemberCalendarScreen;
