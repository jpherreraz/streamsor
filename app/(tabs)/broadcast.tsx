import React from 'react';
import { SafeAreaView } from 'react-native';
import Broadcaster from '../components/Broadcaster';

export default function BroadcastScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Broadcaster />
    </SafeAreaView>
  );
} 