import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp, useRoute } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

type StackParamList = {
  TrackingScreen: { jobId: string };
  ChatScreen: { bookingId: string; otherParticipant: any };
  MainTabs: undefined;
};

type TrackingScreenProps = {
  navigation: StackNavigationProp<StackParamList, 'TrackingScreen'>;
  route: RouteProp<StackParamList, 'TrackingScreen'>;
};

interface Cleaner {
  id: string;
  name: string;
  avatar: string;
  phone: string;
  rating: number;
  eta: string;
  location: {
    latitude: number;
    longitude: number;
  };
}

const TrackingScreen: React.FC<TrackingScreenProps> = ({ navigation }) => {
  const route = useRoute<RouteProp<StackParamList, 'TrackingScreen'>>();
  const { jobId } = route.params;

  const [isLoading, setIsLoading] = useState(true);
  const [cleaner, setCleaner] = useState<Cleaner | null>(null);
  const [jobAddress, setJobAddress] = useState('456 Oak Ave, San Francisco, CA');

  useEffect(() => {
    loadTrackingData();
  }, []);

  const loadTrackingData = async () => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setCleaner({
        id: 'cleaner1',
        name: 'Maria Garcia',
        avatar: 'https://randomuser.me/api/portraits/women/32.jpg',
        phone: '+1 (555) 987-6543',
        rating: 4.9,
        eta: '8 min',
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
        },
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to load tracking data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCall = () => {
    if (cleaner) {
      Alert.alert('Call', `Calling ${cleaner.name} at ${cleaner.phone}`);
      // Linking.openURL(`tel:${cleaner.phone}`);
    }
  };

  const handleChat = () => {
    if (cleaner) {
      navigation.navigate('ChatScreen', {
        bookingId: jobId,
        otherParticipant: {
          id: cleaner.id,
          name: cleaner.name,
          avatar_url: cleaner.avatar,
          role: 'cleaner',
        },
      });
    }
  };

  if (isLoading || !cleaner) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00BFA6" />
          <Text style={styles.loadingText}>Loading location...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Track Cleaner</Text>
        <TouchableOpacity onPress={() => navigation.navigate('MainTabs')}>
          <Ionicons name="home-outline" size={24} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Map Placeholder */}
      <View style={styles.mapContainer}>
        <View style={styles.mapPlaceholder}>
          <Ionicons name="map-outline" size={64} color="#00BFA6" />
          <Text style={styles.mapText}>Live Map Coming Soon</Text>
        </View>
        {/* Cleaner marker */}
        <View style={styles.cleanerMarker}>
          <Image source={{ uri: cleaner.avatar }} style={styles.cleanerAvatar} />
          <View style={styles.markerInfo}>
            <Text style={styles.cleanerName}>{cleaner.name}</Text>
            <Text style={styles.etaText}>ETA: {cleaner.eta}</Text>
          </View>
        </View>
        {/* Address marker */}
        <View style={styles.addressMarker}>
          <Ionicons name="location" size={20} color="#00BFA6" />
          <Text style={styles.addressText}>{jobAddress}</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.actionButton} onPress={handleCall}>
          <Ionicons name="call" size={20} color="#00BFA6" />
          <Text style={styles.actionButtonText}>Call</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handleChat}>
          <Ionicons name="chatbubble" size={20} color="#00BFA6" />
          <Text style={styles.actionButtonText}>Chat</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  mapContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    margin: 20,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  mapPlaceholder: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1,
  },
  mapText: {
    fontSize: 16,
    color: '#00BFA6',
    marginTop: 8,
    fontWeight: '600',
  },
  cleanerMarker: {
    position: 'absolute',
    top: 60,
    left: 40,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    zIndex: 2,
  },
  cleanerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  markerInfo: {
    flex: 1,
  },
  cleanerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  etaText: {
    fontSize: 12,
    color: '#00BFA6',
    marginTop: 2,
  },
  addressMarker: {
    position: 'absolute',
    bottom: 40,
    right: 40,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    zIndex: 2,
  },
  addressText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
    maxWidth: 180,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 14,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00BFA6',
    marginLeft: 8,
  },
});

export default TrackingScreen; 