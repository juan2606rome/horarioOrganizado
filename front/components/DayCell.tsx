import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getEventType } from '../data/eventTypes';
import { CalendarEvent } from '../types';

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
}) => {
  if (!day || !date) {
    return <View style={styles.empty} />;
  }

  const hasEvents = events.length > 0;

  return (
    <TouchableOpacity
      style={[
        styles.cell,
        isToday && styles.today,
        hasEvents && styles.hasEvents,
      ]}
      onPress={() => onPress(date)}
      activeOpacity={0.75}
    >
      <Text style={[styles.dayNumber, isToday && styles.todayText]}>
        {day}
      </Text>

      {hasEvents && (
        <View style={styles.eventsWrap}>
          {events.slice(0, 2).map((ev) => {
            const et = getEventType(ev.tipo);
            return (
              <View
                key={ev.id}
                style={[styles.eventChip, { borderLeftColor: et.color }]}
              >
                <View style={[styles.dot, { backgroundColor: et.color }]} />
                <Text style={styles.eventChipText} numberOfLines={1}>
                  {et.label}
                </Text>
              </View>
            );
          })}

          {events.length > 2 && (
            <View style={styles.moreChip}>
              <Text style={styles.moreText}>+{events.length - 2} más</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    margin: 2,
    minHeight: 92,
  },
  cell: {
    flex: 1,
    margin: 2,
    minHeight: 92,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 6,
  },
  today: {
    borderWidth: 2,
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  hasEvents: {
    backgroundColor: '#FFFFFF',
  },
  dayNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    alignSelf: 'flex-start',
  },
  todayText: {
    color: '#2563EB',
    fontWeight: '900',
  },
  eventsWrap: {
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
  dot: {
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
  moreText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#3730A3',
  },
});

export default DayCell;