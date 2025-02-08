import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Surface } from 'react-native-paper';
import { auth } from '../firebase';

interface NavBarProps {
  onAuthClick: (mode: 'login' | 'signup') => void;
}

export default function NavBar({ onAuthClick }: NavBarProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
      setUserEmail(user?.email || null);
      setUserPhoto(user?.photoURL || null);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await Alert.alert(
        'Logout',
        'Are you sure you want to logout?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Logout',
            style: 'destructive',
            onPress: async () => {
              await signOut(auth);
              setMenuVisible(false);
            },
          },
        ],
        { cancelable: true }
      );
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleMenuItemPress = (route: string) => {
    setMenuVisible(false);
    router.push(route);
  };

  const MenuItem = ({ icon, title, onPress, isDestructive = false }) => (
    <TouchableOpacity 
      style={styles.menuItem} 
      onPress={onPress}
    >
      <MaterialIcons 
        name={icon} 
        size={24} 
        color={isDestructive ? '#FF3B30' : '#1a1a1a'} 
      />
      <Text style={[
        styles.menuItemText,
        isDestructive && styles.logoutText
      ]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        <Text style={styles.logo}>Streamsor</Text>
      </View>
      
      <View style={styles.rightSection}>
        {!isAuthenticated ? (
          <>
            <TouchableOpacity style={styles.authButton} onPress={() => onAuthClick('login')}>
              <Text style={styles.authButtonText}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.authButton, styles.signUpButton]} 
              onPress={() => onAuthClick('signup')}
            >
              <Text style={styles.authButtonText}>Sign Up</Text>
            </TouchableOpacity>
            <View style={[styles.avatarContainer, styles.avatarContainerUnauth]}>
              <MaterialIcons name="person-outline" size={20} color="#999" />
            </View>
          </>
        ) : (
          <View style={styles.menuContainer}>
            <TouchableOpacity 
              onPress={() => setMenuVisible(!menuVisible)}
              style={{ pointerEvents: 'auto' }}
            >
              <View style={styles.avatarContainer}>
                {userPhoto ? (
                  <Image 
                    source={{ uri: userPhoto }} 
                    style={styles.avatarImage}
                  />
                ) : (
                  <Text style={styles.avatarText}>
                    {userEmail?.[0]?.toUpperCase() || '?'}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
            {menuVisible && (
              <Surface style={[styles.menu, { boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }]}>
                <MenuItem 
                  icon="account-circle"
                  title="Channel"
                  onPress={() => handleMenuItemPress('/channel')}
                />
                <MenuItem 
                  icon="dashboard"
                  title="Creator Dashboard"
                  onPress={() => handleMenuItemPress('/dashboard')}
                />
                <MenuItem 
                  icon="settings"
                  title="Settings"
                  onPress={() => handleMenuItemPress('/settings')}
                />
                <MenuItem 
                  icon="logout"
                  title="Log Out"
                  onPress={handleLogout}
                  isDestructive
                />
              </Surface>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  leftSection: {
    flex: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  authButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#007AFF',
  },
  signUpButton: {
    backgroundColor: '#34C759',
  },
  authButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  menuContainer: {
    position: 'relative',
  },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarContainerUnauth: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  menu: {
    position: 'absolute',
    top: 48,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    minWidth: 200,
    padding: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
    borderRadius: 6,
  },
  menuItemText: {
    color: '#1a1a1a',
    fontSize: 14,
    fontWeight: '500',
  },
  logoutText: {
    color: '#FF3B30',
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
}); 