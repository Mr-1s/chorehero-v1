import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
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
  NewBookingFlow: {
    cleanerId?: string;
    serviceName?: string;
    serviceType?: string;
    basePrice?: number;
    duration?: number;
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
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  
  // Animation values
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.95)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadCleaners();
    
    // Start entrance animations
    Animated.parallel([
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(cardScale, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
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
  }).sort((a, b) => {
    if (selectedFilter === 'lowest-price') return a.hourly_rate - b.hourly_rate;
    return 0; // Keep original order for other filters
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

  const getServiceImage = () => {
    const images: { [key: string]: string } = {
      'kitchen': 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=400&fit=crop&auto=format&q=80',
      'bathroom': 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&h=400&fit=crop&auto=format&q=80',
      'living_room': 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=400&fit=crop&auto=format&q=80',
      'bedroom': 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=400&fit=crop&auto=format&q=80',
    };
    return images[category] || 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&h=400&fit=crop&auto=format&q=80';
  };

  const getServiceIcon = () => {
    // Cleaning-appropriate icon options:
    // 'leaf-outline' - natural/eco-friendly cleaning
    // 'shield-checkmark-outline' - protection/cleanliness
    // 'medical-outline' - sanitize/sterile
    // 'car-wash-outline' - wash/clean action
    // 'fitness-outline' - effort/work
    // 'checkmark-circle-outline' - quality/done right
    
    const icons: { [key: string]: string } = {
      'kitchen': 'water-outline', // Water/cleaning related
      'bathroom': 'water',
      'living_room': 'home',
      'bedroom': 'bed',
    };
    return icons[category] || 'sparkles';
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

  const renderCleanerCard = ({ item: cleaner }: { item: GuestCleaner }) => {
    // Create demo video/photo content for each cleaner
    const getCleanerMedia = () => {
      const mediaOptions = [
        {
          type: 'video',
          url: 'https://cdn.pixabay.com/video/2022/06/14/120470-718946026_tiny.mp4',
          thumbnail: 'https://images.unsplash.com/photo-1584043204475-8cc101d6c77a?w=400&h=300&fit=crop&auto=format&q=80'
        },
        {
          type: 'video', 
          url: 'https://cdn.pixabay.com/video/2022/03/28/112781-693063544_tiny.mp4',
          thumbnail: 'https://images.unsplash.com/photo-1503387837-b154d5074bd2?w=400&h=300&fit=crop&auto=format&q=80'
        },
        {
          type: 'image',
          url: 'https://images.unsplash.com/photo-1585421514738-01798e348999?w=400&h=300&fit=crop&auto=format&q=80'
        }
      ];
      
      // Use cleaner ID to consistently assign media
      const index = parseInt(cleaner.id.slice(-1)) % mediaOptions.length;
      return mediaOptions[index];
    };

    const media = getCleanerMedia();

    return (
      <TouchableOpacity 
        style={styles.cleanerCard}
        onPress={() => navigation.navigate('CleanerProfile', { cleanerId: cleaner.id })}
        activeOpacity={0.9}
      >
        {/* Media Section */}
        <View style={styles.cleanerMediaContainer}>
          {media.type === 'video' && playingVideo === cleaner.id ? (
            <View style={styles.videoContainer}>
              {/* For demo purposes, showing thumbnail with controls overlay */}
              <Image
                source={{ uri: media.thumbnail }}
                style={styles.cleanerMedia}
              />
              <View style={styles.videoControlsOverlay}>
                <TouchableOpacity 
                  style={styles.pauseButton}
                  onPress={() => setPlayingVideo(null)}
                >
                  <Ionicons name="pause" size={20} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={styles.videoProgress}>
                  <View style={styles.progressBar} />
                </View>
              </View>
            </View>
          ) : (
            <>
              <Image
                source={{ uri: media.type === 'video' ? media.thumbnail : media.url }}
                style={styles.cleanerMedia}
              />
              
              {/* Play button overlay for videos */}
              {media.type === 'video' && (
                <TouchableOpacity 
                  style={styles.playOverlay}
                  onPress={() => setPlayingVideo(cleaner.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.playButton}>
                    <Ionicons name="play" size={20} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
              )}
            </>
          )}
          
          {/* Rating badge */}
          <View style={styles.mediaRatingBadge}>
            <Ionicons name="star" size={12} color="#FFD700" />
            <Text style={styles.mediaRatingText}>{cleaner.rating.toFixed(1)}</Text>
          </View>
          
          {/* Price badge */}
          <View style={styles.mediaPriceBadge}>
            <Text style={styles.mediaPriceText}>${cleaner.hourly_rate}/hr</Text>
          </View>
        </View>

        {/* Content Section */}
        <View style={styles.cleanerContent}>
          <View style={styles.cleanerHeader}>
            <View style={styles.cleanerAvatarContainer}>
              <Image 
                source={{ uri: cleaner.avatar_url }} 
                style={styles.cleanerAvatar}
              />
              <View style={styles.verificationBadge}>
                <Ionicons name="checkmark" size={8} color="#FFFFFF" />
              </View>
            </View>
            
            <View style={styles.cleanerInfo}>
              <Text style={styles.cleanerName}>{cleaner.name}</Text>
              <Text style={styles.cleanerJobsText}>{cleaner.total_jobs} jobs completed</Text>
            </View>
          </View>
          
          <Text style={styles.cleanerSpecialties}>
            {cleaner.specialties.slice(0, 2).join(' • ')}
          </Text>
          
          <Text style={styles.cleanerBio} numberOfLines={2}>
            {cleaner.bio}
          </Text>
          
          <View style={styles.cleanerActions}>
            <TouchableOpacity 
              style={styles.viewProfileButton}
              onPress={(e) => {
                e.stopPropagation();
                navigation.navigate('CleanerProfile', { cleanerId: cleaner.id });
              }}
            >
              <Text style={styles.viewProfileButtonText}>View Profile</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.bookNowButton}
              onPress={(e) => {
                e.stopPropagation();
                console.log('🎯 Booking from service detail:', cleaner.name);
                navigation.navigate('NewBookingFlow', {
                  cleanerId: cleaner.id,
                  serviceName: serviceName,
                  serviceType: category
                });
              }}
            >
              <Text style={styles.bookNowButtonText}>Book Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#3ad3db" translucent={true} />
      
      {/* Hero Header */}
      <Animated.View style={[
        styles.heroContainer, 
        { 
          opacity: scrollY.interpolate({
            inputRange: [200, 250],
            outputRange: [1, 0],
            extrapolate: 'clamp'
          })
        }
      ]}>
        <Image 
          source={{ uri: getServiceImage() }}
          style={styles.heroImage}
        />
        <LinearGradient
          colors={['rgba(58, 211, 219, 0.8)', 'rgba(26, 167, 183, 0.9)']}
          style={styles.heroOverlay}
        >
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <View style={styles.heroContent}>
            <View style={styles.serviceBadge}>
              <Ionicons name={getServiceIcon() as any} size={20} color="#3ad3db" />
              <Text style={styles.serviceBadgeText}>Professional Service</Text>
            </View>
            
            <Text style={styles.heroTitle}>{serviceName}</Text>
            <Text style={styles.heroSubtitle}>
              {filteredCleaners.length} expert{filteredCleaners.length !== 1 ? 's' : ''} ready to help
            </Text>
            
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatNumber}>4.8★</Text>
                <Text style={styles.heroStatLabel}>Average Rating</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatNumber}>${Math.round(cleaners.reduce((acc, c) => acc + c.hourly_rate, 0) / cleaners.length || 45)}</Text>
                <Text style={styles.heroStatLabel}>Starting From</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatNumber}>2-3h</Text>
                <Text style={styles.heroStatLabel}>Duration</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Enhanced Sticky Header */}
      <Animated.View style={[
        styles.stickyHeader,
        {
          opacity: scrollY.interpolate({
            inputRange: [200, 250],
            outputRange: [0, 1],
            extrapolate: 'clamp'
          }),
          transform: [{
            translateY: scrollY.interpolate({
              inputRange: [200, 250],
              outputRange: [-60, 0],
              extrapolate: 'clamp'
            })
          }]
        }
      ]}>
        {/* Background Image */}
        <Image 
          source={{ uri: getServiceImage() }}
          style={styles.stickyHeaderImage}
        />
        
        {/* Gradient Overlay */}
        <LinearGradient
          colors={['rgba(58, 211, 219, 0.95)', 'rgba(26, 167, 183, 0.95)']}
          style={styles.stickyHeaderOverlay}
        >
          {/* Single Row Layout */}
          <View style={styles.stickyMainRow}>
            <TouchableOpacity 
              style={styles.stickyBackButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            
            <View style={styles.stickyContent}>
              <Text style={styles.stickyTitle}>{serviceName}</Text>
              <Text style={styles.stickySubtitle}>{filteredCleaners.length} experts ready</Text>
            </View>
            
            <View style={styles.stickyHeaderStats}>
              <View style={styles.stickyStatItem}>
                <Text style={styles.stickyStatNumber}>4.8★</Text>
              </View>
              <View style={styles.stickyStatItem}>
                <Text style={styles.stickyStatNumber}>${Math.round(cleaners.reduce((acc, c) => acc + c.hourly_rate, 0) / cleaners.length || 45)}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      <ScrollView 
        style={styles.contentContainer} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* Service Info Card */}
        <Animated.View style={[styles.serviceCard, { transform: [{ scale: cardScale }] }]}>
          <View style={styles.serviceCardHeader}>
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            <Text style={styles.serviceCardTitle}>What's Included</Text>
          </View>
          <Text style={styles.serviceCardDescription}>
            {getServiceDescription()}
          </Text>
          
          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <Ionicons name="shield-checkmark" size={16} color="#3ad3db" />
              <Text style={styles.featureText}>Verified Professionals</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="time" size={16} color="#3ad3db" />
              <Text style={styles.featureText}>Same Day Booking</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="star" size={16} color="#3ad3db" />
              <Text style={styles.featureText}>Satisfaction Guarantee</Text>
            </View>
          </View>
        </Animated.View>

        {/* Filters */}
        <View style={styles.filtersSection}>
          <Text style={styles.sectionTitle}>Find Your Perfect Match</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersContent}
          >
            {renderFilterButton('all', 'All')}
            {renderFilterButton('top-rated', 'Top Rated')}
            {renderFilterButton('experienced', 'Most Experienced')}
            {renderFilterButton('lowest-price', 'Lowest Price')}
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
          <View style={styles.cleanersSection}>
            {filteredCleaners.map((cleaner, index) => (
              <Animated.View 
                key={cleaner.id}
                style={[
                  styles.cleanerCardWrapper,
                  { 
                    transform: [{ 
                      translateY: cardScale.interpolate({
                        inputRange: [0.95, 1],
                        outputRange: [50 * (index + 1), 0],
                      })
                    }] 
                  }
                ]}
              >
                {renderCleanerCard({ item: cleaner })}
              </Animated.View>
            ))}
          </View>
        )}
        
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  
  // Hero Section
  heroContainer: {
    height: 320,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 30,
    justifyContent: 'space-between',
    zIndex: 11,
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(10px)',
  },
  heroContent: {
    alignItems: 'center',
  },
  serviceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  serviceBadgeText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
  },
  heroStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  heroStat: {
    alignItems: 'center',
  },
  heroStatNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  heroStatLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  
  // Enhanced Sticky Header
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 140,
    zIndex: 9999,
    overflow: 'hidden',
  },
  stickyHeaderImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  stickyHeaderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 12,
    justifyContent: 'flex-end',
  },
  stickyBackButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  stickyMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stickyContent: {
    flex: 1,
    marginHorizontal: 12,
  },
  stickyServiceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  stickyServiceBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  stickyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 1,
  },
  stickySubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  stickyHeaderStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stickyStatItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  stickyStatNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  
  // Content
  contentContainer: {
    flex: 1,
    zIndex: 1,
  },
  scrollContent: {
    paddingTop: 320,
    zIndex: 1,
  },
  // Service Card
  serviceCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 12,
  },
  serviceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  serviceCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginLeft: 12,
  },
  serviceCardDescription: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
    marginBottom: 20,
  },
  featuresList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 14,
    color: '#4B5563',
    marginLeft: 10,
    fontWeight: '500',
  },
  
  // Filters Section
  filtersSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1E',
    marginHorizontal: 20,
    marginBottom: 16,
  },
  filtersContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  filterButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  filterButtonActive: {
    backgroundColor: '#3ad3db',
    borderColor: '#3ad3db',
    shadowColor: '#3ad3db',
    shadowOpacity: 0.25,
  },
  filterButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  
  // Cleaners Section
  cleanersSection: {
    paddingHorizontal: 20,
  },
  cleanerCardWrapper: {
    marginBottom: 16,
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
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  
  // Media Section
  cleanerMediaContainer: {
    height: 200,
    position: 'relative',
  },
  cleanerMedia: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F2F2F7',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoContainer: {
    width: '100%',
    height: '100%',
  },
  videoControlsOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pauseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  videoProgress: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  progressBar: {
    width: '30%',
    height: '100%',
    backgroundColor: '#3ad3db',
    borderRadius: 2,
  },
  mediaRatingBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  mediaRatingText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 4,
  },
  mediaPriceBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#3ad3db',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  mediaPriceText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  
  // Content Section
  cleanerContent: {
    padding: 16,
  },
  cleanerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
  },
  verificationBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 16,
    height: 16,
    borderRadius: 8,
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
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  cleanerSpecialties: {
    fontSize: 13,
    color: '#3ad3db',
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'capitalize',
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
    lineHeight: 18,
    marginBottom: 14,
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
  bottomSpacing: {
    height: 100,
  },
});

export default ServiceDetailScreen;
