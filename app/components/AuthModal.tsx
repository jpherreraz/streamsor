import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Modal, Portal } from 'react-native-paper';
import Auth from './Auth';

interface AuthModalProps {
  visible: boolean;
  onDismiss: () => void;
  onAuthSuccess?: () => void;
  initialMode?: boolean; // true for login, false for signup
}

export default function AuthModal({ visible, onDismiss, onAuthSuccess, initialMode = true }: AuthModalProps) {
  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.container}
      >
        <View style={styles.modalContent}>
          <Auth 
            onAuthSuccess={() => {
              onAuthSuccess?.();
              onDismiss();
            }}
            initialMode={initialMode}
            onDismiss={onDismiss}
          />
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 400 : '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
      },
    }),
  },
}); 