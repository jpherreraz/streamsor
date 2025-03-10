import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Surface } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth } from '../firebase';
import AuthModal from './AuthModal';

interface MenuItemProps {
  icon: string;
  title: string;
  onPress: () => void;
  isDestructive?: boolean;
}

export default function NavBar() {
  const insets = useSafeAreaInsets();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

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
      setIsLoggingOut(true);
      await signOut(auth);
      setMenuVisible(false);
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to logout. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleMenuItemPress = (route: string) => {
    setMenuVisible(false);
    router.push(route as any);
  };

  const handleAuthClick = (mode: 'login' | 'signup') => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  const MenuItem = ({ icon, title, onPress, isDestructive = false }: MenuItemProps) => (
    <TouchableOpacity 
      style={styles.menuItem} 
      onPress={onPress}
    >
      <MaterialIcons 
        name={icon as any} 
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
    <>
      <SafeAreaView style={[styles.container, { 
        paddingTop: Platform.select({
          web: 16,
          ios: insets.top / 3,
          default: 0,
        })
      }]}>
        <View style={styles.leftSection}>
          <TouchableOpacity onPress={() => router.push('/(tabs)')}>
            <Text style={styles.logo}>Streamsor</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.rightSection}>
          {!isAuthenticated ? (
            <>
              <TouchableOpacity 
                style={styles.authButton} 
                onPress={() => handleAuthClick('login')}
              >
                <Text style={styles.authButtonText}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.authButton, styles.signUpButton]} 
                onPress={() => handleAuthClick('signup')}
              >
                <Text style={styles.authButtonText}>Sign Up</Text>
              </TouchableOpacity>
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
                <Surface style={[
                  styles.menu, 
                  Platform.OS === 'web' ? { 
                    position: 'absolute',
                    zIndex: 1000,
                    ...Platform.select({
                      web: {
                        filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))'
                      }
                    })
                  } : {
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 3,
                  }
                ]}>
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
                    title={isLoggingOut ? "Logging out..." : "Log Out"}
                    onPress={handleLogout}
                    isDestructive
                  />
                </Surface>
              )}
            </View>
          )}
        </View>
      </SafeAreaView>

      <AuthModal
        visible={showAuthModal}
        onDismiss={() => setShowAuthModal(false)}
        initialMode={authMode === 'login'}
        onAuthSuccess={() => {
          setShowAuthModal(false);
          router.push('/(tabs)');
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: Platform.select({
      web: 16,
      default: 8,
    }),
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    zIndex: 100,
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
    zIndex: 1000,
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
    zIndex: 1000,
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