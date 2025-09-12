import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Image,
  Dimensions,
  Alert,
  ActivityIndicator,
  Animated,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useRoute, RouteProp } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

type StackParamList = {
  ServiceSelection: {
    cleanerId?: string;
    location?: string;
    fromBookingFlow?: boolean;
  };
  BookingFlow: {
    cleanerId: string;
    serviceType: string;
    location?: any;
  };
  CleanerProfile: { cleanerId: string };
  MainTabs: undefined;
};

type ServiceSelectionProps = {
  navigation: StackNavigationProp<StackParamList, 'ServiceSelection'>;
  route: RouteProp<StackParamList, 'ServiceSelection'>;
};

interface ServiceTier {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  duration: number;
  popular?: boolean;
  included: string[];
  icon: string;
  color: string[];
}

interface AddOn {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  icon: string;
  category: 'appliances' | 'specialty' | 'convenience';
  popular?: boolean;
}

interface CleanerInfo {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  totalJobs: number;
  distance: number;
  specialties: string[];
}

const ServiceSelectionScreen: React.FC<ServiceSelectionProps> = ({ navigation, route }) => {
  const { cleanerId, location, fromBookingFlow } = route.params || {};
  
  const [isLoading, setIsLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<ServiceTier | null>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<'all' | 'appliances' | 'specialty' | 'convenience'>('all');
  const [cleanerInfo, setCleanerInfo] = useState<CleanerInfo | null>(null);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const serviceAnimValue = useRef(new Animated.Value(0)).current;

  const serviceTiers: ServiceTier[] = [
    {
      id: 'express',
      name: 'Express Clean',
      description: 'Quick maintenance cleaning for busy schedules',
      basePrice: 45,
      duration: 30,
      popular: true,
      icon: 'flash',
      color: ['#3B82F6', '#2563EB'],
      included: [
        'Kitchen surfaces & sink',
        'Bathroom quick clean',
        'Living room tidy',
        'Trash removal',
        'Floor sweeping'
      ]
    },
    {
      id: 'standard',
      name: 'Standard Clean',
      description: 'Comprehensive cleaning for regular maintenance',
      basePrice: 75,
      duration: 90,
      popular: true,
      icon: 'home',
      color: ['#00BFA6', '#00A693'],
      included: [
        'All Express Clean tasks',
        'Bedroom cleaning',
        'Detailed bathroom clean',
        'Kitchen deep clean',
        'Vacuum all carpets',
        'Mop all floors',
        'Dust all surfaces',
        'Light organizing'
      ]
    },
    {
      id: 'deep',
      name: 'Deep Clean',
      description: 'Thorough cleaning for move-in/out or special occasions',
      basePrice: 150,
      duration: 180,
      popular: false,
      icon: 'star',
      color: ['#8B5CF6', '#7C3AED'],
      included: [
        'All Standard Clean tasks',
        'Inside appliances',
        'Baseboards & windowsills',
        'Light fixtures',
        'Interior windows',
        'Cabinet fronts',
        'Switch plates',
        'Detailed organizing'
      ]
    }
  ];

  const addOns: AddOn[] = [
    {
      id: 'inside_fridge',
      name: 'Inside Fridge',
      description: 'Deep clean refrigerator interior, shelves, and drawers',
      price: 15,
      duration: 20,
      icon: 'snow-outline',
      category: 'appliances',
      popular: true,
    },
    {
      id: 'inside_oven',
      name: 'Inside Oven',
      description: 'Scrub and degrease oven interior and racks',
      price: 20,
      duration: 25,
      icon: 'flame-outline',
      category: 'appliances',
      popular: true,
    },
    {
      id: 'inside_cabinets',
      name: 'Inside Cabinets',
      description: 'Organize and wipe down cabinet interiors',
      price: 25,
      duration: 30,
      icon: 'file-tray-outline',
      category: 'specialty',
    },
    {
      id: 'window_cleaning',
      name: 'Window Cleaning',
      description: 'Clean interior and exterior windows',
      price: 30,
      duration: 40,
      icon: 'albums-outline',
      category: 'specialty',
      popular: true,
    },
    {
      id: 'laundry_service',
      name: 'Laundry Service',
      description: 'Wash, dry, and fold one load of clothes',
      price: 12,
      duration: 15,
      icon: 'shirt-outline',
      category: 'convenience',
    },
    {
      id: 'garage_clean',
      name: 'Garage Cleaning',
      description: 'Sweep and organize garage space',
      price: 35,
      duration: 45,
      icon: 'car-outline',
      category: 'specialty',
    },
    {
      id: 'pet_cleanup',
      name: 'Pet Area Cleanup',
      description: 'Extra attention to pet hair and odors',
      price: 18,
      duration: 20,
      icon: 'paw-outline',
      category: 'specialty',
    },
    {
      id: 'supply_service',
      name: 'Bring Supplies',
      description: 'Cleaner brings all eco-friendly supplies',
      price: 8,
      duration: 0,
      icon: 'bag-outline',
      category: 'convenience',
      popular: true,
    }
  ];

  useEffect(() => {
    loadServiceData();
  }, []);

  useEffect(() => {
    if (selectedService) {
      Animated.spring(serviceAnimValue, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    }
  }, [selectedService]);

  const loadServiceData = async () => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Mock cleaner data if cleanerId provided
      if (cleanerId) {
        setCleanerInfo({
          id: cleanerId,
          name: 'Sarah Martinez',
          avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
          rating: 4.8,
          totalJobs: 127,
          distance: 1.2,
          specialties: ['Deep Cleaning', 'Eco-Friendly', 'Pet-Friendly']
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load service data');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateTotal = () => {
    let total = selectedService?.basePrice || 0;
    
    selectedAddOns.forEach(addonId => {
      const addon = addOns.find(a => a.id === addonId);
      if (addon) total += addon.price;
    });
    
    return total;
  };

  const calculateDuration = () => {
    let duration = selectedService?.duration || 0;
    
    selectedAddOns.forEach(addonId => {
      const addon = addOns.find(a => a.id === addonId);
      if (addon) duration += addon.duration;
    });
    
    return duration;
  };

  const handleServiceSelect = (service: ServiceTier) => {
    setSelectedService(service);
    // Scroll to add-ons section
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 400, animated: true });
    }, 300);
  };

  const toggleAddOn = (addonId: string) => {
    setSelectedAddOns(prev => 
      prev.includes(addonId)
        ? prev.filter(id => id !== addonId)
        : [...prev, addonId]
    );
  };

  const handleContinue = () => {
    if (!selectedService) {
      Alert.alert('Select Service', 'Please choose a service tier to continue');
      return;
    }

    if (fromBookingFlow) {
      // Continue with booking flow
      navigation.navigate('BookingFlow', {
        cleanerId: cleanerId || 'general',
        serviceType: selectedService.id,
        location: location ? { address: location } : undefined,
      });
    } else {
      // Start new booking flow
      navigation.navigate('BookingFlow', {
        cleanerId: cleanerId || 'general',
        serviceType: selectedService.id,
      });
    }
  };

  const getFilteredAddOns = () => {
    if (activeCategory === 'all') return addOns;
    return addOns.filter(addon => addon.category === activeCategory);
  };

  const getCategoryCount = (category: typeof activeCategory) => {
    if (category === 'all') return addOns.length;
    return addOns.filter(addon => addon.category === category).length;
  };

  const renderCleanerInfo = () => {
    if (!cleanerInfo) return null;

    return (
      <View style={styles.cleanerInfoContainer}>
        <View style={styles.cleanerCard}>
          <Image source={{ uri: cleanerInfo.avatar }} style={styles.cleanerAvatar} />
          <View style={styles.cleanerDetails}>
            <Text style={styles.cleanerName}>{cleanerInfo.name}</Text>
            <View style={styles.cleanerStats}>
              <View style={styles.statItem}>
                <Ionicons name="star" size={14} color="#F59E0B" />
                <Text style={styles.statText}>{cleanerInfo.rating}</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="briefcase" size={14} color="#6B7280" />
                <Text style={styles.statText}>{cleanerInfo.totalJobs} jobs</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="location" size={14} color="#6B7280" />
                <Text style={styles.statText}>{cleanerInfo.distance} mi</Text>
              </View>
            </View>
            <View style={styles.specialtiesContainer}>
              {cleanerInfo.specialties.slice(0, 2).map((specialty, index) => (
                <View key={index} style={styles.specialtyBadge}>
                  <Text style={styles.specialtyText}>{specialty}</Text>
                </View>
              ))}
            </View>
          </View>
          <TouchableOpacity 
            style={styles.viewProfileButton}
            onPress={() => navigation.navigate('CleanerProfile', { cleanerId: 'demo_cleaner_1' })}
          >
            <Text style={styles.viewProfileText}>View</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderServiceCard = (service: ServiceTier) => (
    <TouchableOpacity
      key={service.id}
      style={[
        styles.serviceCard,
        selectedService?.id === service.id && styles.selectedServiceCard
      ]}
      onPress={() => handleServiceSelect(service)}
    >
      <LinearGradient
        colors={service.color}
        style={styles.serviceGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {service.popular && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularText}>Popular</Text>
          </View>
        )}
        
        <View style={styles.serviceIcon}>
          <Ionicons name={service.icon as any} size={32} color="#FFFFFF" />
        </View>
        
        <Text style={styles.serviceName}>{service.name}</Text>
        <Text style={styles.serviceDescription}>{service.description}</Text>
        
        <View style={styles.servicePricing}>
          <Text style={styles.servicePrice}>${service.basePrice}</Text>
          <Text style={styles.serviceDuration}>{service.duration} min</Text>
        </View>
        
        {selectedService?.id === service.id && (
          <Animated.View 
            style={[
              styles.selectedIndicator,
              {
                transform: [{
                  scale: serviceAnimValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1],
                  })
                }]
              }
            ]}
          >
            <Ionicons name="checkmark-circle" size={28} color="#FFFFFF" />
          </Animated.View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderIncludedItems = () => {
    if (!selectedService) return null;

    return (
      <View style={styles.includedSection}>
        <Text style={styles.sectionTitle}>What's Included</Text>
        <View style={styles.includedContainer}>
          {selectedService.included.map((item, index) => (
            <View key={index} style={styles.includedItem}>
              <Ionicons name="checkmark-circle" size={16} color="#00BFA6" />
              <Text style={styles.includedText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderCategoryTabs = () => (
    <View style={styles.categoryTabs}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryTabsContent}
      >
        {[
          { id: 'all', label: 'All', count: getCategoryCount('all') },
          { id: 'appliances', label: 'Appliances', count: getCategoryCount('appliances') },
          { id: 'specialty', label: 'Specialty', count: getCategoryCount('specialty') },
          { id: 'convenience', label: 'Convenience', count: getCategoryCount('convenience') },
        ].map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.categoryTab,
              activeCategory === category.id && styles.activeCategoryTab
            ]}
            onPress={() => setActiveCategory(category.id as any)}
          >
            <Text style={[
              styles.categoryTabText,
              activeCategory === category.id && styles.activeCategoryTabText
            ]}>
              {category.label} ({category.count})
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderAddOnCard = (addon: AddOn) => (
    <TouchableOpacity
      key={addon.id}
      style={[
        styles.addonCard,
        selectedAddOns.includes(addon.id) && styles.selectedAddonCard
      ]}
      onPress={() => toggleAddOn(addon.id)}
    >
      <View style={styles.addonHeader}>
        <View style={styles.addonIconContainer}>
          <Ionicons name={addon.icon as any} size={24} color="#00BFA6" />
        </View>
        <View style={styles.addonInfo}>
          <View style={styles.addonTitleRow}>
            <Text style={styles.addonName}>{addon.name}</Text>
            {addon.popular && (
              <View style={styles.popularDot}>
                <Text style={styles.popularDotText}>●</Text>
              </View>
            )}
          </View>
          <Text style={styles.addonDescription}>{addon.description}</Text>
          <View style={styles.addonMeta}>
            <Text style={styles.addonPrice}>+${addon.price}</Text>
            {addon.duration > 0 && (
              <Text style={styles.addonDuration}>+{addon.duration} min</Text>
            )}
          </View>
        </View>
      </View>
      
      {selectedAddOns.includes(addon.id) && (
        <View style={styles.addonSelected}>
          <Ionicons name="checkmark-circle" size={20} color="#00BFA6" />
        </View>
      )}
    </TouchableOpacity>
  );

  const renderPricingSummary = () => {
    if (!selectedService) return null;

    return (
      <View style={styles.pricingSummary}>
        <BlurView intensity={95} style={styles.pricingBlur}>
          <View style={styles.pricingContent}>
            <View style={styles.pricingLeft}>
              <Text style={styles.pricingTotal}>${calculateTotal()}</Text>
              <Text style={styles.pricingDuration}>~{calculateDuration()} minutes</Text>
              {selectedAddOns.length > 0 && (
                <Text style={styles.pricingAddOns}>
                  +{selectedAddOns.length} add-on{selectedAddOns.length > 1 ? 's' : ''}
                </Text>
              )}
            </View>
            
            <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
              <Text style={styles.continueButtonText}>Continue</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </BlurView>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00BFA6" />
          <Text style={styles.loadingText}>Loading services...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Choose Service</Text>
        <TouchableOpacity onPress={() => navigation.navigate('MainTabs')}>
          <Ionicons name="home-outline" size={24} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderCleanerInfo()}

        {/* Service Tiers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service Options</Text>
          <Text style={styles.sectionSubtitle}>
            Choose the level of cleaning that fits your needs
          </Text>
          
          <View style={styles.servicesGrid}>
            {serviceTiers.map(renderServiceCard)}
          </View>
        </View>

        {renderIncludedItems()}

        {/* Add-ons */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add Extra Services</Text>
          <Text style={styles.sectionSubtitle}>
            Customize your cleaning with optional extras
          </Text>
          
          {renderCategoryTabs()}
          
          <View style={styles.addOnsContainer}>
            {getFilteredAddOns().map(renderAddOnCard)}
          </View>
        </View>

        {/* Bottom spacing for fixed pricing */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {renderPricingSummary()}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  cleanerInfoContainer: {
    padding: 20,
  },
  cleanerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cleanerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  cleanerDetails: {
    flex: 1,
  },
  cleanerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  cleanerStats: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  statText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  specialtiesContainer: {
    flexDirection: 'row',
  },
  specialtyBadge: {
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
  },
  specialtyText: {
    fontSize: 10,
    color: '#00BFA6',
    fontWeight: '500',
  },
  viewProfileButton: {
    backgroundColor: '#00BFA6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  viewProfileText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 20,
  },
  servicesGrid: {
    gap: 16,
  },
  serviceCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  selectedServiceCard: {
    transform: [{ scale: 1.02 }],
    shadowOpacity: 0.2,
  },
  serviceGradient: {
    padding: 24,
    minHeight: 160,
    justifyContent: 'center',
    position: 'relative',
  },
  popularBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  popularText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  serviceIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  serviceName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  serviceDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 16,
    lineHeight: 20,
  },
  servicePricing: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  servicePrice: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  serviceDuration: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 16,
    left: 16,
  },
  includedSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  includedContainer: {
    gap: 12,
  },
  includedItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  includedText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 12,
  },
  categoryTabs: {
    marginBottom: 20,
  },
  categoryTabsContent: {
    paddingHorizontal: 0,
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    marginRight: 12,
  },
  activeCategoryTab: {
    backgroundColor: '#00BFA6',
  },
  categoryTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeCategoryTabText: {
    color: '#FFFFFF',
  },
  addOnsContainer: {
    gap: 12,
  },
  addonCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    position: 'relative',
  },
  selectedAddonCard: {
    borderColor: '#00BFA6',
    backgroundColor: '#F0FDFA',
  },
  addonHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addonIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  addonInfo: {
    flex: 1,
  },
  addonTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  addonName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  popularDot: {
    marginLeft: 8,
  },
  popularDotText: {
    fontSize: 12,
    color: '#F59E0B',
  },
  addonDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
    lineHeight: 16,
  },
  addonMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addonPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00BFA6',
    marginRight: 12,
  },
  addonDuration: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  addonSelected: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  pricingSummary: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  pricingBlur: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(229, 231, 235, 0.3)',
  },
  pricingContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pricingLeft: {
    flex: 1,
  },
  pricingTotal: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  pricingDuration: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  pricingAddOns: {
    fontSize: 12,
    color: '#00BFA6',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00BFA6',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 8,
    shadowColor: '#00BFA6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default ServiceSelectionScreen; 