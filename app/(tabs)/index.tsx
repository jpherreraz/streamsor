import React from 'react';
import { SafeAreaView } from 'react-native';
import VideosScreen from '../components/StreamView';

export default function StreamsScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <VideosScreen />
    </SafeAreaView>
  );
} 