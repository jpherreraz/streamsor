import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getDownloadURL, getStorage, ref as storageRef } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DEFAULT_BANNER } from '../constants';

type TabType = 'home' | 'about' | 'schedule' | 'videos';

export default function ChannelPage() {
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<TabType>('home');
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user?.uid) {
        setUserEmail(user.email);
        if (user.photoURL) {
          setProfileUrl(user.photoURL);
        }
        
        // Get banner URL
        const storage = getStorage();
        const bannerRef = storageRef(storage, `profile_banners/${user.uid}`);
        getDownloadURL(bannerRef).then(url => {
          setBannerUrl(url);
        }).catch((error) => {
          if (error.code === 'storage/object-not-found') {
            setBannerUrl(DEFAULT_BANNER);
          }
        });
      }
    });

    return () => unsubscribe();
  }, []);

  const tabs: TabType[] = ['home', 'about', 'schedule', 'videos'];

  const renderTabContent = () => {
    switch (selectedTab) {
      case 'home':
        return <Text style={styles.comingSoonText}>Home content coming soon!</Text>;
      case 'about':
        return <Text style={styles.comingSoonText}>About content coming soon!</Text>;
      case 'schedule':
        return <Text style={styles.comingSoonText}>Schedule content coming soon!</Text>;
      case 'videos':
        return <Text style={styles.comingSoonText}>Videos content coming soon!</Text>;
    }
  };

  return (
    <View style={styles.container}>
      {/* Banner */}
      <View style={styles.bannerContainer}>
        <Image 
          source={{ uri: bannerUrl || DEFAULT_BANNER }}
          style={styles.bannerImage}
          resizeMode="cover"
        />
      </View>

      {/* Profile Section */}
      <View style={styles.profileSection}>
        <View style={styles.profilePictureContainer}>
          {profileUrl ? (
            <Image 
              source={{ uri: profileUrl }}
              style={styles.profilePicture}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.placeholderProfile}>
              <Text style={styles.placeholderText}>
                {userEmail ? userEmail[0].toUpperCase() : '?'}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.emailText}>{userEmail || 'Not signed in'}</Text>
        </View>
      </View>

      {/* Tab Selection */}
      <View style={styles.tabContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tab,
              selectedTab === tab && styles.selectedTab
            ]}
            onPress={() => setSelectedTab(tab)}
          >
            <Text style={[
              styles.tabText,
              selectedTab === tab && styles.selectedTabText
            ]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      <View style={styles.contentContainer}>
        {renderTabContent()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  bannerContainer: {
    height: 200,
    width: '100%',
    backgroundColor: '#e0e0e0',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    marginTop: -40,
    backgroundColor: '#fff',
  },
  profilePictureContainer: {
    marginRight: 15,
  },
  profilePicture: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#fff',
    backgroundColor: '#fff',
  },
  placeholderProfile: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  placeholderText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  emailText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  selectedTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  selectedTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  comingSoonText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
}); 