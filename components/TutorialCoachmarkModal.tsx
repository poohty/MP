import React from 'react';
import { Modal, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import Colors from '@/constants/colors';

type Props = {
  visible: boolean;
  title: string;
  body: string;
  onOk: () => void;
  onClose: () => void;
};

export default function TutorialCoachmarkModal({ visible, title, body, onOk }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onOk}>
      <View style={styles.backdrop} testID="tutorial-backdrop">
        <View style={styles.card} testID="tutorial-card">
          <Text style={styles.title} testID="tutorial-title">{title}</Text>
          <Text style={styles.body} testID="tutorial-body">{body}</Text>
          <TouchableOpacity style={styles.okButton} onPress={onOk} testID="tutorial-ok">
            <Text style={styles.okText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    padding: 18,
    ...Colors.shadowLg,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0B0B0C',
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: '#3C3C43',
    marginBottom: 14,
  },
  okButton: {
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  okText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
});
