import { Redirect } from 'expo-router';
import React from 'react';

export default function App() {
  // No auth check needed - everyone can view streams
  return <Redirect href="/(tabs)" />;
} 