import { MaterialIcons } from '@expo/vector-icons';
import { Tabs, usePathname, useRouter } from 'expo-router';
import React from 'react';
import NavBar from '../components/NavBar';

export default function TabsLayout() {
  const router = useRouter();
  const pathname = usePathname();

  const handleAuthClick = (mode: 'login' | 'signup') => {
    console.log('Navigating to auth with redirect:', pathname);
    router.push({
      pathname: '/auth',
      params: { 
        mode,
        redirect: pathname 
      }
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
          tabBarLabel: 'Live Streams',
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
            <MaterialIcons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
} 