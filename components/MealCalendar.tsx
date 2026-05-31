import React, { useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import Colors from '@/constants/colors';
import { CalendarAssignment } from '@/types';

interface MealCalendarProps {
  assignments: CalendarAssignment[];
  onDayPress?: (date: string) => void;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getMonthData(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return { firstDay, daysInMonth };
}

function formatMonthYear(year: number, month: number): string {
  const date = new Date(year, month, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function toDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function MealCalendar({ assignments, onDayPress }: MealCalendarProps) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const todayStr = toDateString(year, month, now.getDate());

  const { firstDay, daysInMonth } = useMemo(() => getMonthData(year, month), [year, month]);

  const assignmentsByDate = useMemo(() => {
    const map: Record<string, CalendarAssignment[]> = {};
    for (const a of assignments) {
      if (!map[a.date]) map[a.date] = [];
      map[a.date].push(a);
    }
    return map;
  }, [assignments]);

  const todayDate = now.getDate();
  const todayDay = now.getDay();

  const weekStart = useMemo(() => {
    return todayDate - todayDay;
  }, [todayDate, todayDay]);

  const weekDays = useMemo(() => {
    const days: number[] = [];
    for (let i = 0; i < 7; i++) {
      const d = weekStart + i;
      if (d >= 1 && d <= daysInMonth) {
        days.push(d);
      }
    }
    return days;
  }, [weekStart, daysInMonth]);

  const calendarRows = useMemo(() => {
    const rows: (number | null)[][] = [];
    let row: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) {
      row.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      row.push(day);
      if (row.length === 7) {
        rows.push(row);
        row = [];
      }
    }
    if (row.length > 0) {
      while (row.length < 7) row.push(null);
      rows.push(row);
    }
    return rows;
  }, [firstDay, daysInMonth]);

  const renderDayCell = (day: number | null, rowIdx: number, colIdx: number) => {
    if (day === null) {
      return <View key={`empty-${rowIdx}-${colIdx}`} style={styles.dayCell} />;
    }

    const dateStr = toDateString(year, month, day);
    const isToday = dateStr === todayStr;
    const dayAssignments = assignmentsByDate[dateStr] || [];
    const hasAssignments = dayAssignments.length > 0;
    const isCurrentWeek = weekDays.includes(day);

    return (
      <TouchableOpacity
        key={`day-${day}`}
        style={[
          styles.dayCell,
          isToday && styles.todayCell,
          isCurrentWeek && !isToday && styles.currentWeekCell,
        ]}
        onPress={() => onDayPress?.(dateStr)}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.dayNumber,
          isToday && styles.todayNumber,
          isCurrentWeek && !isToday && styles.currentWeekNumber,
        ]}>
          {day}
        </Text>
        {hasAssignments && (
          <View style={styles.assignmentIndicator}>
            {dayAssignments.slice(0, 2).map((a, i) => (
              <Text
                key={`${a.recipeId}-${i}`}
                style={styles.assignmentChip}
                numberOfLines={1}
              >
                {a.recipeName.length > 8 ? a.recipeName.slice(0, 7) + '...' : a.recipeName}
              </Text>
            ))}
            {dayAssignments.length > 2 && (
              <Text style={styles.moreCount}>+{dayAssignments.length - 2}</Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.weekHighlight}>
        <Text style={styles.weekLabel}>This Week</Text>
        <View style={styles.weekRow}>
          {DAYS_OF_WEEK.map((dayName, i) => {
            const day = weekDays[i];
            if (!day) return null;
            const dateStr = toDateString(year, month, day);
            const isToday = dateStr === todayStr;
            const dayAssignments = assignmentsByDate[dateStr] || [];
            return (
              <View key={`week-${i}`} style={[styles.weekDayItem, isToday && styles.weekDayToday]}>
                <Text style={[styles.weekDayName, isToday && styles.weekDayNameToday]}>{dayName}</Text>
                <Text style={[styles.weekDayNumber, isToday && styles.weekDayNumberToday]}>{day}</Text>
                {dayAssignments.length > 0 && (
                  <View style={[styles.weekDot, isToday && styles.weekDotToday]} />
                )}
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.monthSection}>
        <Text style={styles.monthTitle}>{formatMonthYear(year, month)}</Text>
        <View style={styles.headerRow}>
          {DAYS_OF_WEEK.map(d => (
            <View key={d} style={styles.headerCell}>
              <Text style={styles.headerText}>{d}</Text>
            </View>
          ))}
        </View>
        {calendarRows.map((row, rowIdx) => (
          <View key={`row-${rowIdx}`} style={styles.calendarRow}>
            {row.map((day, colIdx) => renderDayCell(day, rowIdx, colIdx))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  weekHighlight: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  weekLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  weekRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
  },
  weekDayItem: {
    alignItems: 'center' as const,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 10,
    minWidth: 38,
  },
  weekDayToday: {
    backgroundColor: Colors.primary,
  },
  weekDayName: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  weekDayNameToday: {
    color: '#FFFFFF',
  },
  weekDayNumber: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  weekDayNumberToday: {
    color: '#FFFFFF',
  },
  weekDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.primary,
    marginTop: 3,
  },
  weekDotToday: {
    backgroundColor: '#FFFFFF',
  },
  monthSection: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
    textAlign: 'center' as const,
  },
  headerRow: {
    flexDirection: 'row' as const,
    marginBottom: 4,
  },
  headerCell: {
    flex: 1,
    alignItems: 'center' as const,
    paddingVertical: 4,
  },
  headerText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  calendarRow: {
    flexDirection: 'row' as const,
  },
  dayCell: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center' as const,
    paddingVertical: 4,
    borderRadius: 8,
  },
  todayCell: {
    backgroundColor: `${Colors.primary}15`,
  },
  currentWeekCell: {
    backgroundColor: `${Colors.primary}08`,
  },
  dayNumber: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  todayNumber: {
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  currentWeekNumber: {
    fontWeight: '600' as const,
  },
  assignmentIndicator: {
    marginTop: 2,
    alignItems: 'center' as const,
    width: '100%',
  },
  assignmentChip: {
    fontSize: 7,
    color: Colors.primary,
    fontWeight: '600' as const,
    backgroundColor: `${Colors.primary}18`,
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
    marginBottom: 1,
    overflow: 'hidden' as const,
    maxWidth: 44,
  },
  moreCount: {
    fontSize: 7,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
  },
});
