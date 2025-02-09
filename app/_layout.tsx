import { Stack } from 'expo-router';
import React from 'react';
import { LogBox } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { AuthProvider } from './contexts/AuthContext';
import app from './firebase';

// Ensure Firebase is initialized
if (!app) {
  throw new Error('Firebase initialization failed');
}

// Ignore firebase timer warnings
LogBox.ignoreLogs(['Setting a timer']);

export default function RootLayout() {
  return (
    <AuthProvider>
    <PaperProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
    </PaperProvider>
    </AuthProvider>
  );
}
