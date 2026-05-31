import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, FlatList } from 'react-native';
import Colors from '@/constants/colors';
import { ChevronDown } from 'lucide-react-native';

interface MultiplierDropdownProps {
  value: number;
  onValueChange: (value: number) => void;
}

const multiplierOptions = [0.25, 0.5, 0.75, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function MultiplierDropdown({ value, onValueChange }: MultiplierDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const formatMultiplier = (multiplier: number) => {
    if (multiplier === 0.25) return '1/4';
    if (multiplier === 0.5) return '1/2';
    if (multiplier === 0.75) return '3/4';
    return multiplier.toString();
  };

  const renderOption = ({ item }: { item: number }) => (
    <TouchableOpacity
      style={[styles.option, item === value && styles.selectedOption]}
      onPress={() => {
        onValueChange(item);
        setIsOpen(false);
      }}
    >
      <Text style={[styles.optionText, item === value && styles.selectedOptionText]}>
        {formatMultiplier(item)}x
      </Text>
    </TouchableOpacity>
  );

  return (
    <>
      <TouchableOpacity
        style={styles.dropdown}
        onPress={() => setIsOpen(true)}
      >
        <Text style={styles.dropdownText}>{formatMultiplier(value)}x</Text>
        <ChevronDown size={16} color={Colors.textSecondary} />
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setIsOpen(false)}
        >
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Recipe Multiplier</Text>
            <FlatList
              data={multiplierOptions}
              renderItem={renderOption}
              keyExtractor={(item) => item.toString()}
              style={styles.optionsList}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 60,
  },
  dropdownText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
    marginRight: 4,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    maxHeight: 400,
    width: '80%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  optionsList: {
    maxHeight: 300,
  },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  selectedOption: {
    backgroundColor: Colors.primary,
  },
  optionText: {
    fontSize: 16,
    color: Colors.text,
    textAlign: 'center',
  },
  selectedOptionText: {
    color: Colors.background,
    fontWeight: 'bold',
  },
});