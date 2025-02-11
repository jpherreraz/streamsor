import { MaterialIcons } from '@expo/vector-icons';
import { Link, usePathname } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

const MENU_ITEMS = [
  {
    title: 'Live Streams',
    icon: 'live-tv',
    href: '/(tabs)',
    path: '/'
  },
  {
    title: 'Videos',
    icon: 'video-library',
    href: '/(tabs)/videos',
    path: '/videos'
  },
  {
    title: 'Broadcast',
    icon: 'videocam',
    href: '/(tabs)/broadcast',
    path: '/broadcast'
  },
  {
    title: 'Channel',
    icon: 'person',
    href: '/(tabs)/channel',
    path: '/channel'
  },
];

export default function SideBar() {
  const pathname = usePathname();
  
  console.log('Current pathname:', pathname);

  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <View style={styles.container}>
      {MENU_ITEMS.map((item) => {
        // Match against the simplified path
        const isActive = pathname === item.path;
        
        console.log(`Checking ${item.title}:`, { pathname, path: item.path, isActive });
        
        return (
          <Link
            key={item.href}
            href={item.href === '/(tabs)' ? '/(tabs)/' : item.href}
            asChild
            style={[
              styles.menuItem,
              isActive && styles.menuItemActive,
            ]}
          >
            <View style={styles.menuItemContent}>
              <MaterialIcons
                name={item.icon as any}
                size={24}
                color={isActive ? '#007AFF' : '#666'}
              />
              <Text style={[
                styles.menuItemText,
                isActive && styles.menuItemTextActive,
              ]}>
                {item.title}
              </Text>
            </View>
          </Link>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 240,
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#eee',
    paddingTop: 16,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  menuItemActive: {
    backgroundColor: '#f5f9ff',
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  menuItemTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
}); 