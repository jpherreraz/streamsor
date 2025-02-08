import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Auth from './components/Auth';

export default function AuthScreen() {
  const { mode } = useLocalSearchParams<{ mode: 'login' | 'signup' }>();

  const handleAuthSuccess = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <Auth onAuthSuccess={handleAuthSuccess} initialMode={mode === 'signup' ? false : true} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
}); 