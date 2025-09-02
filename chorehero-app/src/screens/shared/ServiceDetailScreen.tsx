import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { guestModeService, GuestCleaner } from '../../services/guestModeService';

type RootStackParamList = {
  ServiceDetail: {
    serviceId: string;
    serviceName: string;
    category: string;
  };
  CleanerProfile: { cleanerId: string };
  SimpleBookingFlow: {
    cleanerId: string;
    serviceName: string;
    fromServiceDetail?: boolean;
  };
};

type ServiceDetailScreenRouteProp = RouteProp<RootStackParamList, 'ServiceDetail'>;
type ServiceDetailScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ServiceDetail'>;

interface ServiceDetailScreenProps {
  navigation: ServiceDetailScreenNavigationProp;
  route: ServiceDetailScreenRouteProp;
}

const { width } = Dimensions.get('window');

const ServiceDetailScreen: React.FC<ServiceDetailScreenProps> = ({ navigation, route }) => {
  const { serviceId, serviceName, category } = route.params;
  const [cleaners, setCleaners] = useState<GuestCleaner[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('all');

  useEffect(() => {
    loadCleaners();
  }, [category]);

  const loadCleaners = async () => {
    try {
      setLoading(true);
      console.log('🔍 Loading cleaners for category:', category);
      const cleanersData = await guestModeService.getCleanersForCategory(category);
      setCleaners(cleanersData);
      console.log(`✅ Loaded ${cleanersData.length} cleaners`);
    } catch (error) {
      console.error('❌ Error loading cleaners:', error);
      setCleaners([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredCleaners = cleaners.filter(cleaner => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'top-rated') return cleaner.rating >= 4.8;
    if (selectedFilter === 'experienced') return cleaner.total_jobs >= 300;
    if (selectedFilter === 'nearby') return true; // In real app, would filter by distance
    return true;
  });

  const getServiceDescription = () => {
    const descriptions: { [key: string]: string } = {
      'kitchen': 'Professional kitchen deep cleaning including appliances, countertops, cabinets, and thorough degreasing.',
      'bathroom': 'Complete bathroom sanitization with grout cleaning, tile restoration, and professional-grade disinfection.',
      'living_room': 'Comprehensive living room cleaning including carpet cleaning, upholstery care, and organization.',
      'bedroom': 'Thorough bedroom cleaning with mattress sanitization, closet organization, and detailed dusting.',
    };
    return descriptions[category] || 'Professional cleaning service tailored to your specific needs.';
  };

  const renderFilterButton = (filter: string, label: string) => (
    <TouchableOpacity
      key={filter}
      style={[
        styles.filterButton,
        selectedFilter === filter && styles.filterButtonActive
      ]}
      onPress={() => setSelectedFilter(filter)}
    >
      <Text style={[
        styles.filterButtonText,
        selectedFilter === filter && styles.filterButtonTextActive
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderCleanerCard = ({ item: cleaner }: { item: GuestCleaner }) => (
    <TouchableOpacity 
      style={styles.cleanerCard}
      onPress={() => navigation.navigate('CleanerProfile', { cleanerId: cleaner.id })}
      activeOpacity={0.7}
    >
      <View style={styles.cleanerCardHeader}>
        <View style={styles.cleanerAvatarContainer}>
          <Image 
            source={{ uri: cleaner.avatar_url }} 
            style={styles.cleanerAvatar}
          />
          <View style={styles.verificationBadge}>
            <Ionicons name="checkmark" size={10} color="#FFFFFF" />
          </View>
        </View>
        
        <View style={styles.cleanerInfo}>
          <Text style={styles.cleanerName}>{cleaner.name}</Text>
          <View style={styles.cleanerRating}>
            <Ionicons name="star" size={14} color="#FFC93C" />
            <Text style={styles.cleanerRatingText}>{cleaner.rating.toFixed(1)}</Text>
            <Text style={styles.cleanerJobsText}>• {cleaner.total_jobs} jobs</Text>
          </View>
          <Text style={styles.cleanerSpecialties}>
            {cleaner.specialties.slice(0, 2).join(' • ')}
          </Text>
        </View>
        
        <View style={styles.cleanerPrice}>
          <Text style={styles.cleanerPriceText}>${cleaner.hourly_rate}/hr</Text>
        </View>
      </View>
      
      <Text style={styles.cleanerBio} numberOfLines={2}>
        {cleaner.bio}
      </Text>
      
      <View style={styles.cleanerActions}>
        <TouchableOpacity 
          style={styles.viewProfileButton}
          onPress={() => navigation.navigate('CleanerProfile', { cleanerId: cleaner.id })}
        >
          <Text style={styles.viewProfileButtonText}>View Profile</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.bookNowButton}
          onPress={() => {
            console.log('🎯 Booking from service detail:', cleaner.name);
            navigation.navigate('SimpleBookingFlow', {
              cleanerId: cleaner.id,
              serviceName: serviceName,
              fromServiceDetail: true
            });
          }}
        >
          <Text style={styles.bookNowButtonText}>Book Now</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9F9F9" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1C1C1E" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{serviceName}</Text>
          <Text style={styles.headerSubtitle}>
            {filteredCleaners.length} professional{filteredCleaners.length !== 1 ? 's' : ''} available
          </Text>
        </View>
      </View>

      {/* Service Info */}
      <View style={styles.serviceInfo}>
        <LinearGradient
          colors={['#3ad3db', '#2bc4cb']}
          style={styles.serviceInfoGradient}
        >
          <Text style={styles.serviceInfoTitle}>What's Included</Text>
          <Text style={styles.serviceInfoDescription}>
            {getServiceDescription()}
          </Text>
        </LinearGradient>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}
        >
          {renderFilterButton('all', 'All')}
          {renderFilterButton('top-rated', 'Top Rated')}
          {renderFilterButton('experienced', 'Most Experienced')}
          {renderFilterButton('nearby', 'Nearby')}
        </ScrollView>
      </View>

      {/* Cleaners List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3ad3db" />
          <Text style={styles.loadingText}>Finding the best cleaners for you...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredCleaners}
          renderItem={renderCleanerCard}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.cleanersList}
          ItemSeparatorComponent={() => <View style={styles.cleanerSeparator} />}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  header: {
    backgroundColor: '#F9F9F9',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6D6D70',
    fontWeight: '500',
  },
  serviceInfo: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  serviceInfoGradient: {
    padding: 20,
    borderRadius: 16,
  },
  serviceInfoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  serviceInfoDescription: {
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 22,
    opacity: 0.9,
  },
  filtersContainer: {
    marginBottom: 20,
  },
  filtersContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  filterButtonActive: {
    backgroundColor: '#3ad3db',
    borderColor: '#3ad3db',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6D6D70',
    textAlign: 'center',
  },
  cleanersList: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  cleanerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cleanerCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cleanerAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  cleanerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F2F2F7',
  },
  verificationBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  cleanerInfo: {
    flex: 1,
  },
  cleanerName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  cleanerRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  cleanerRatingText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  cleanerJobsText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#6D6D70',
  },
  cleanerSpecialties: {
    fontSize: 13,
    color: '#3ad3db',
    fontWeight: '500',
  },
  cleanerPrice: {
    alignItems: 'flex-end',
  },
  cleanerPriceText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  cleanerBio: {
    fontSize: 14,
    color: '#6D6D70',
    lineHeight: 20,
    marginBottom: 16,
  },
  cleanerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  viewProfileButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3ad3db',
    alignItems: 'center',
  },
  viewProfileButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3ad3db',
  },
  bookNowButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#3ad3db',
    alignItems: 'center',
  },
  bookNowButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cleanerSeparator: {
    height: 16,
  },
});

export default ServiceDetailScreen;
