import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  Modal, 
  FlatList,
  ViewStyle,
  TextStyle
} from 'react-native';
import Colors from '@/constants/colors';
import { ChevronDown, X } from 'lucide-react-native';

interface Option {
  label: string;
  value: string | number;
}

interface DropdownSelectProps {
  label?: string;
  options: Option[];
  selectedValue?: string | number;
  onSelect: (value: string | number) => void;
  placeholder?: string;
  containerStyle?: ViewStyle;
  labelStyle?: TextStyle;
  error?: string;
}

export default function DropdownSelect({
  label,
  options,
  selectedValue,
  onSelect,
  placeholder = 'Select an option',
  containerStyle,
  labelStyle,
  error,
}: DropdownSelectProps) {
  const [modalVisible, setModalVisible] = useState(false);

  const selectedOption = options.find(option => option.value === selectedValue);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, labelStyle]}>
          {label}
        </Text>
      )}
      
      <TouchableOpacity
        style={[styles.selectButton, error ? styles.errorInput : null]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <Text 
          style={[
            styles.selectText, 
            !selectedOption && styles.placeholderText
          ]}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <ChevronDown size={20} color={Colors.textSecondary} />
      </TouchableOpacity>
      
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
      
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label || 'Select an option'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={options}
              keyExtractor={(item) => item.value.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.optionItem,
                    selectedValue === item.value && styles.selectedOption
                  ]}
                  onPress={() => {
                    onSelect(item.value);
                    setModalVisible(false);
                  }}
                >
                  <Text 
                    style={[
                      styles.optionText,
                      selectedValue === item.value && styles.selectedOptionText
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    width: '100%',
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    color: Colors.text,
    fontWeight: '500',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    height: 50,
    paddingHorizontal: 16,
  },
  selectText: {
    color: Colors.text,
    fontSize: 16,
  },
  placeholderText: {
    color: Colors.textSecondary,
  },
  errorInput: {
    borderColor: Colors.error,
  },
  errorText: {
    color: Colors.error,
    fontSize: 12,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    width: '100%',
    maxHeight: '80%',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  optionItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  selectedOption: {
    backgroundColor: Colors.surface,
  },
  optionText: {
    fontSize: 16,
    color: Colors.text,
  },
  selectedOptionText: {
    color: Colors.primary,
    fontWeight: '500',
  },
});