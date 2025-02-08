import { MaterialIcons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import NavBar from '../components/NavBar';

export default function TabsLayout() {
  const router = useRouter();

  const handleAuthClick = (mode: 'login' | 'signup') => {
    router.push({
      pathname: '/auth',
      params: { mode }
    });
  };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        headerStyle: {
          backgroundColor: '#fff',
        },
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        // Add the NavBar as a header
        header: () => <NavBar onAuthClick={handleAuthClick} />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Live Streams',
          tabBarLabel: 'Streams',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="live-tv" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="videos"
        options={{
          title: 'Videos',
          tabBarLabel: 'Videos',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="video-library" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="broadcast"
        options={{
          title: 'Go Live',
          tabBarLabel: 'Broadcast',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="videocam" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="channel"
        options={{
          title: 'Channel',
          tabBarLabel: 'Channel',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="account-box" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
} 