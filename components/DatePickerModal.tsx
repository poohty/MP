import React, { useState, useMemo, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal } from 'react-native';
import Colors from '@/constants/colors';
import { X, ChevronLeft, ChevronRight } from 'lucide-react-native';

interface DatePickerModalProps {
  visible: boolean;
  recipeName: string;
  currentAssignedDate: string | null;
  onSave: (date: string | null) => void;
  onClose: () => void;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getMonthData(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return { firstDay, daysInMonth };
}

function toDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatMonthYear(year: number, month: number): string {
  const date = new Date(year, month, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function DatePickerModal({ visible, recipeName, currentAssignedDate, onSave, onClose }: DatePickerModalProps) {
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(currentAssignedDate);
  const [todayStr, setTodayStr] = useState(() => {
    const n = new Date();
    return toDateString(n.getFullYear(), n.getMonth(), n.getDate());
  });

  React.useEffect(() => {
    if (visible) {
      const n = new Date();
      setSelectedDate(currentAssignedDate);
      setViewYear(n.getFullYear());
      setViewMonth(n.getMonth());
      setTodayStr(toDateString(n.getFullYear(), n.getMonth(), n.getDate()));
    }
  }, [visible, currentAssignedDate]);

  const { firstDay, daysInMonth } = useMemo(() => getMonthData(viewYear, viewMonth), [viewYear, viewMonth]);

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

  const handleDayPress = useCallback((day: number) => {
    const dateStr = toDateString(viewYear, viewMonth, day);
    if (selectedDate === dateStr) {
      setSelectedDate(null);
    } else {
      setSelectedDate(dateStr);
    }
  }, [viewYear, viewMonth, selectedDate]);

  const handleSave = useCallback(() => {
    onSave(selectedDate);
  }, [selectedDate, onSave]);

  const goToPrevMonth = useCallback(() => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  }, [viewMonth]);

  const goToNextMonth = useCallback(() => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  }, [viewMonth]);

  const isCurrentMonth = useMemo(() => {
    const n = new Date();
    return viewYear === n.getFullYear() && viewMonth === n.getMonth();
  }, [viewYear, viewMonth]);

  const renderDayCell = (day: number | null, rowIdx: number, colIdx: number) => {
    if (day === null) {
      return <View key={`empty-${rowIdx}-${colIdx}`} style={styles.dayCell} />;
    }

    const dateStr = toDateString(viewYear, viewMonth, day);
    const isSelected = selectedDate === dateStr;
    const isToday = dateStr === todayStr;
    const isPastSavedDate = currentAssignedDate === dateStr && selectedDate !== dateStr;

    return (
      <TouchableOpacity
        key={`day-${day}`}
        style={[
          styles.dayCell,
          isToday && !isSelected && styles.todayCell,
          isSelected && styles.selectedCell,
          isPastSavedDate && styles.previouslyAssignedCell,
        ]}
        onPress={() => handleDayPress(day)}
        activeOpacity={0.6}
      >
        <Text style={[
          styles.dayNumber,
          isToday && !isSelected && styles.todayNumber,
          isSelected && styles.selectedNumber,
        ]}>
          {day}
        </Text>
      </TouchableOpacity>
    );
  };

  const formattedSelected = useMemo(() => {
    if (!selectedDate) return null;
    const [y, m, d] = selectedDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }, [selectedDate]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          style={styles.modal}
          activeOpacity={1}
          onPress={() => {}}
        >
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleRow}>
              <Text style={styles.modalTitle} numberOfLines={1}>Schedule Meal</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.recipeTitleLabel} numberOfLines={2}>{recipeName}</Text>
          </View>

          <View style={styles.monthNav}>
            <TouchableOpacity onPress={goToPrevMonth} style={styles.navArrow} disabled={isCurrentMonth}>
              <ChevronLeft size={20} color={isCurrentMonth ? Colors.border : Colors.text} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{formatMonthYear(viewYear, viewMonth)}</Text>
            <TouchableOpacity onPress={goToNextMonth} style={styles.navArrow}>
              <ChevronRight size={20} color={Colors.text} />
            </TouchableOpacity>
          </View>

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

          {formattedSelected && (
            <View style={styles.selectionInfo}>
              <Text style={styles.selectionText}>{formattedSelected}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.saveButton, !selectedDate && !currentAssignedDate && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!selectedDate && !currentAssignedDate}
          >
            <Text style={styles.saveButtonText}>
              {selectedDate ? 'Save' : currentAssignedDate ? 'Remove Assignment' : 'Select a Date'}
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: Colors.background,
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 380,
  },
  modalHeader: {
    marginBottom: 16,
  },
  modalTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  recipeTitleLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  navArrow: {
    padding: 6,
  },
  monthLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  headerRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  headerCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  calendarRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    margin: 1,
  },
  todayCell: {
    backgroundColor: `${Colors.primary}12`,
  },
  selectedCell: {
    backgroundColor: Colors.primary,
  },
  previouslyAssignedCell: {
    borderWidth: 1.5,
    borderColor: `${Colors.primary}40`,
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  todayNumber: {
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  selectedNumber: {
    color: '#FFFFFF',
    fontWeight: '700' as const,
  },
  selectionInfo: {
    alignItems: 'center',
    marginTop: 12,
  },
  selectionText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.border,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
});
