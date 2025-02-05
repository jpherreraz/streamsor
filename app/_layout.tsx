import { Stack } from 'expo-router';
import { LogBox } from 'react-native';
import { PaperProvider } from 'react-native-paper';

// Ignore firebase timer warnings
LogBox.ignoreLogs(['Setting a timer']);

export default function RootLayout() {
  return (
    <PaperProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </PaperProvider>
  );
}
