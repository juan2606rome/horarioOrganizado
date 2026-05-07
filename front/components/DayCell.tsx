import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CalendarEvent } from '../types';
import { getEventType } from '../data/eventTypes';

interface DayCellProps {
  day: number | null;
  date: string | null;
  events: CalendarEvent[];
  isToday: boolean;
  onPress: (date: string) => void;
  memberColor?: string;
}

const DayCell: React.FC<DayCellProps> = ({
  day,
  date,
  events,
  isToday,
  onPress,
  memberColor,
}) => {
  if (!day || !date) {
    return <View style={styles.empty} />;
  }

  const hasEvents = events.length > 0;
  const firstEvent = events[0];
  const eventType = firstEvent ? getEventType(firstEvent.tipo) : null;

  return (
    <TouchableOpacity
      style={[
        styles.cell,
        isToday && styles.today,
        hasEvents && eventType && { backgroundColor: eventType.bgColor, borderColor: eventType.color },
      ]}
      onPress={() => onPress(date)}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.dayNumber,
          isToday && styles.todayText,
          hasEvents && eventType && { color: eventType.textColor },
        ]}
      >
        {day}
      </Text>

      {/* Event indicators */}
      {hasEvents && (
        <View style={styles.dotsRow}>
          {events.slice(0, 3).map((ev, idx) => {
            const et = getEventType(ev.tipo);
            return (
              <View
                key={ev.id}
                style={[styles.dot, { backgroundColor: et.color }]}
              />
            );
          })}
          {events.length > 3 && (
            <Text style={styles.moreText}>+{events.length - 3}</Text>
          )}
        </View>
      )}

      {/* Event type label (first event only) */}
      {hasEvents && eventType && (
        <Text
          style={[styles.eventLabel, { color: eventType.color }]}
          numberOfLines={1}
        >
          {getEventType(firstEvent.tipo).label.split(' ')[0]}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    margin: 2,
    minHeight: 60,
  },
  cell: {
    flex: 1,
    margin: 2,
    minHeight: 60,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 5,
    alignItems: 'center',
  },
  today: {
    borderWidth: 2,
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  dayNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    alignSelf: 'flex-start',
  },
  todayText: {
    color: '#2563EB',
    fontWeight: '800',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 4,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  moreText: {
    fontSize: 8,
    color: '#6B7280',
    fontWeight: '600',
  },
  eventLabel: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 3,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});

export default DayCell;
