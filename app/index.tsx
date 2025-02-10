import { Redirect } from 'expo-router';
import React from 'react';
import { useAuth } from './contexts/AuthContext';

export default function App() {
  const { user } = useAuth();

  if (!user) {
    return <Redirect href="/auth" />;
  }

  return <Redirect href="/(tabs)" />;
} 