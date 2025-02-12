import * as Font from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import { LogBox, Platform, StyleSheet, View } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import NavBar from './components/NavBar';
import SideBar from './components/SideBar';
import { AuthProvider } from './contexts/AuthContext';
import app from './firebase';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Ensure Firebase is initialized
if (!app) {
  throw new Error('Firebase initialization failed');
}

// Ignore firebase timer warnings
LogBox.ignoreLogs(['Setting a timer']);

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await Font.loadAsync({
          'MaterialIcons': '/assets/fonts/MaterialIcons.ttf',
          'material': '/assets/fonts/MaterialIcons.ttf',
          'MaterialCommunityIcons': '/assets/fonts/MaterialCommunityIcons.ttf',
          'FontAwesome': '/assets/fonts/FontAwesome.ttf',
          'Ionicons': '/assets/fonts/Ionicons.ttf'
        });
      } catch (e) {
        console.warn('Error loading fonts:', e);
      } finally {
        setAppIsReady(true);
        await SplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  if (!appIsReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PaperProvider>
          <View style={styles.container}>
            <NavBar />
            <View style={styles.content}>
              <SideBar />
              <View style={styles.mainContent}>
                <Stack
                  screenOptions={{
                    headerShown: false,
                  }}
                >
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen 
                    name="auth" 
                    options={{ 
                      headerShown: false,
                      presentation: 'modal',
                      animation: 'slide_from_bottom',
                    }} 
                  />
                  <Stack.Screen name="settings" options={{ headerShown: false }} />
                  <Stack.Screen name="video/[id]" options={{ headerShown: false }} />
                  <Stack.Screen name="stream/[id]" options={{ headerShown: false }} />
                </Stack>
              </View>
            </View>
          </View>
        </PaperProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
  },
  mainContent: {
    flex: 1,
  },
});
