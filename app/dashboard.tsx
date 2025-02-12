import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BioEditor from './components/BioEditor';
import Broadcaster from './components/Broadcaster';

type TabType = 'stream' | 'bio' | 'customization' | 'schedule';

export default function CreatorDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('stream');

  const TabButton = ({ title, icon, tab }: { title: string; icon: string; tab: TabType }) => (
    <TouchableOpacity 
      style={[
        styles.tabButton,
        activeTab === tab && styles.activeTabButton
      ]} 
      onPress={() => setActiveTab(tab)}
    >
      <MaterialIcons 
        name={icon as any} 
        size={24} 
        color={activeTab === tab ? '#007AFF' : '#666'} 
      />
      <Text style={[
        styles.tabText,
        activeTab === tab && styles.activeTabText
      ]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'stream':
        return <Broadcaster />;
      case 'bio':
        return <BioEditor />;
      case 'customization':
        return <Text style={styles.comingSoon}>Home customization coming soon bestie! 🚀</Text>;
      case 'schedule':
        return <Text style={styles.comingSoon}>Stream schedule coming soon bestie! 🚀</Text>;
      default:
        return <Text style={styles.comingSoon}>Content coming soon bestie! 🚀</Text>;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navbar}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
        >
          <TabButton 
            title="Stream Settings" 
            icon="settings-input-component" 
            tab="stream" 
          />
          <TabButton 
            title="Bio" 
            icon="person" 
            tab="bio" 
          />
          <TabButton 
            title="Home Customization" 
            icon="dashboard-customize" 
            tab="customization" 
          />
          <TabButton 
            title="Stream Schedule" 
            icon="schedule" 
            tab="schedule" 
          />
        </ScrollView>
      </View>
      <View style={styles.content}>
        {renderContent()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  navbar: {
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tabsContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: Platform.select({ web: 24, default: 16 }),
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  activeTabButton: {
    backgroundColor: '#e6f0ff',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  comingSoon: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
}); 