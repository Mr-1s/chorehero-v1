import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../hooks/useAuth';

type StackParamList = {
  Home: undefined;
  BookingFlow: { cleanerId?: string; serviceType?: string };
  CleanerProfile: { cleanerId: string };
  SavedServices: undefined;
};

type SavedServicesScreenProps = {
  navigation: StackNavigationProp<StackParamList, 'SavedServices'>;
};

interface SavedService {
  id: string;
  title: string;
  type: string;
  price: number;
  duration: number;
  image: string;
  cleaner: {
    id: string;
    name: string;
    avatar: string;
    rating: number;
  };
  lastBooked?: string;
  notes?: string;
}

const SavedServicesScreen: React.FC<SavedServicesScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const [savedServices, setSavedServices] = useState<SavedService[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadSavedServices();
  }, []);

  const loadSavedServices = async () => {
    try {
      // In a real app, this would fetch from the database
      // For now, we'll use mock data
      const mockSavedServices: SavedService[] = [
        {
          id: '1',
          title: 'Kitchen Deep Clean',
          type: 'kitchen',
          price: 89.25,
          duration: 120,
          image: 'https://images.unsplash.com/photo-1563453392212-326d32d2d3b8?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
          cleaner: {
            id: 'cleaner-1',
            name: 'Sarah Martinez',
            avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b47c?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80',
            rating: 4.9,
          },
          lastBooked: '2 weeks ago',
          notes: 'Includes appliance cleaning and deep scrub',
        },
        {
          id: '2',
          title: 'Bathroom Sanitization',
          type: 'bathroom',
          price: 65.00,
          duration: 90,
          image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
          cleaner: {
            id: 'cleaner-2',
            name: 'Maria Lopez',
            avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80',
            rating: 4.8,
          },
          lastBooked: '1 month ago',
          notes: 'Anti-bacterial cleaning with premium products',
        },
        {
          id: '3',
          title: 'Living Room Refresh',
          type: 'living_room',
          price: 55.00,
          duration: 75,
          image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
          cleaner: {
            id: 'cleaner-3',
            name: 'David Chen',
            avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80',
            rating: 4.7,
          },
          lastBooked: '3 weeks ago',
          notes: 'Furniture dusting and carpet refresh',
        },
      ];

      setSavedServices(mockSavedServices);
    } catch (error) {
      console.error('Error loading saved services:', error);
      Alert.alert('Error', 'Failed to load saved services');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadSavedServices();
  };

  const handleBookAgain = (service: SavedService) => {
    navigation.navigate('BookingFlow', {
      cleanerId: service.cleaner.id,
      serviceType: service.type,
    });
  };

  const handleViewCleaner = (cleanerId: string) => {
    navigation.navigate('CleanerProfile', { cleanerId: 'demo_cleaner_1' });
  };

  const handleRemoveService = (serviceId: string) => {
    Alert.alert(
      'Remove Service',
      'Are you sure you want to remove this service from your saved list?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setSavedServices(prev => prev.filter(service => service.id !== serviceId));
          },
        },
      ]
    );
  };

  const renderServiceCard = (service: SavedService) => (
    <View key={service.id} style={styles.serviceCard}>
      <Image source={{ uri: service.image }} style={styles.serviceImage} />
      
      <View style={styles.serviceContent}>
        <View style={styles.serviceHeader}>
          <Text style={styles.serviceTitle}>{service.title}</Text>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveService(service.id)}
          >
            <Ionicons name="heart" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.cleanerInfo}>
          <TouchableOpacity
            style={styles.cleanerProfile}
            onPress={() => handleViewCleaner(service.cleaner.id)}
          >
            <Image source={{ uri: service.cleaner.avatar }} style={styles.cleanerAvatar} />
            <View>
              <Text style={styles.cleanerName}>{service.cleaner.name}</Text>
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={14} color="#FFA500" />
                <Text style={styles.ratingText}>{service.cleaner.rating}</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.serviceDetails}>
          <View style={styles.detailItem}>
            <Ionicons name="time-outline" size={16} color="#6B7280" />
            <Text style={styles.detailText}>{service.duration} min</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="cash-outline" size={16} color="#6B7280" />
            <Text style={styles.detailText}>${service.price}</Text>
          </View>
          {service.lastBooked && (
            <View style={styles.detailItem}>
              <Ionicons name="calendar-outline" size={16} color="#6B7280" />
              <Text style={styles.detailText}>Last: {service.lastBooked}</Text>
            </View>
          )}
        </View>

        {service.notes && (
          <Text style={styles.serviceNotes}>{service.notes}</Text>
        )}

        <TouchableOpacity
          style={styles.bookButton}
          onPress={() => handleBookAgain(service)}
        >
          <LinearGradient
            colors={['#3ad3db', '#2DD4BF']}
            style={styles.bookButtonGradient}
          >
            <Ionicons name="calendar" size={18} color="#FFFFFF" />
            <Text style={styles.bookButtonText}>Book Again</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F9F9F9" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3ad3db" />
          <Text style={styles.loadingText}>Loading saved services...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9F9F9" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Services</Text>
        <View style={styles.headerRight}>
          <Text style={styles.serviceCount}>{savedServices.length} saved</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {savedServices.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="heart-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No Saved Services</Text>
            <Text style={styles.emptyDescription}>
              Save your favorite services to book them again quickly
            </Text>
            <TouchableOpacity
              style={styles.exploreButton}
              onPress={() => navigation.navigate('Home')}
            >
              <Text style={styles.exploreButtonText}>Explore Services</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.servicesContainer}>
            {savedServices.map(renderServiceCard)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
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
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  headerRight: {
    padding: 8,
  },
  serviceCount: {
    fontSize: 14,
    color: '#6B7280',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  scrollView: {
    flex: 1,
  },
  servicesContainer: {
    padding: 20,
  },
  serviceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  serviceImage: {
    width: '100%',
    height: 160,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  serviceContent: {
    padding: 16,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  serviceTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  removeButton: {
    padding: 8,
    marginRight: -8,
  },
  cleanerInfo: {
    marginBottom: 12,
  },
  cleanerProfile: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cleanerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  cleanerName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  serviceDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  detailText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  serviceNotes: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  bookButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  bookButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  bookButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  exploreButton: {
    backgroundColor: '#3ad3db',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  exploreButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SavedServicesScreen;