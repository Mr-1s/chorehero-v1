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
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  Animated,
  Platform,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../../utils/constants';
import type { StackNavigationProp } from '@react-navigation/stack';
import { routeToMessage, MessageParticipant } from '../../utils/messageRouting';

import { contentService } from '../../services/contentService';
import { presenceService } from '../../services/presenceService';
import { notificationService } from '../../services/notificationService';
import CleanerProfileReviews from '../../components/cleaner/CleanerProfileReviews';

import { useAuth } from '../../hooks/useAuth';
import AuthModal from '../../components/AuthModal';
import GuestPromptModal from '../../components/GuestPromptModal';
import { setPendingAuthAction, setPostAuthRoute } from '../../utils/authPendingAction';
import { availabilityService } from '../../services/availabilityService';
import { supabase } from '../../services/supabase';
import { guestModeService } from '../../services/guestModeService';
import { wp, hp } from '../../utils/responsive';
import { Chip, StatRow } from '../../components/ui';
import { navigateToChoresContent } from '../../navigation/mainTabsContentNavigation';

const { height } = Dimensions.get('window');

type TabParamList = {
  Home: undefined;
  Discover: undefined;
  Bookings: undefined;
  Messages: undefined;
  Profile: undefined;
  CleanerProfile: { cleanerId: string };
  UnifiedBooking: {
    cleanerId: string;
    cleanerName?: string;
    hourlyRate?: number;
    packageId?: string;
    packageType?: 'fixed' | 'estimate' | 'hourly';
    packageBasePriceCents?: number;
    estimatedHours?: number;
    selectedService?: string;
  };
};

type CleanerProfileScreenNavigationProp = StackNavigationProp<TabParamList, 'CleanerProfile'>;

interface CleanerProfileScreenProps {
  navigation: CleanerProfileScreenNavigationProp;
  route: { params: { cleanerId: string } };
}

interface CleanerService {
  id: string;
  title: string;
  description: string;
  price: number;
  duration: string;
  image: string;
  /** Package fields (from content_posts) - when present, use package-based booking */
  package_id?: string;
  package_type?: 'fixed' | 'estimate' | 'hourly';
  base_price_cents?: number | null;
  estimated_hours?: number | null;
}

interface Review {
  id: string;
  user: {
    name: string;
    avatar: string;
  };
  rating: number;
  comment: string;
  date: string;
}

interface CleanerVideo {
  id: string;
  title: string;
  description: string;
  media_url: string;
  thumbnail_url?: string;
  view_count: number;
  like_count: number;
  created_at: string;
}

const CleanerProfileScreen: React.FC<CleanerProfileScreenProps> = ({ navigation, route }) => {
  const { cleanerId, activeTab: initialTab } = route.params || {};
  const { user, isGuestMode } = useAuth();
  // Call hooks unconditionally and before any early returns to avoid hook-order errors
  const { width: winWidth } = useWindowDimensions();
  const isNarrow = winWidth < 360;
  const videoCardWidth = isNarrow ? winWidth - 40 : (winWidth - 40 - 16) / 2;
  const [activeTab, setActiveTab] = useState<'videos' | 'services' | 'reviews' | 'about'>(initialTab || 'videos');
  const [showFullBio, setShowFullBio] = useState(false);
  const [cleaner, setCleaner] = useState<any | null>(null);
  const [services, setServices] = useState<CleanerService[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [videos, setVideos] = useState<CleanerVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<CleanerVideo | null>(null);
  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [isOnline, setIsOnline] = useState(true); // Mock online status
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [hasRepeatClients, setHasRepeatClients] = useState(true); // Mock data
  const [nextAvailable, setNextAvailable] = useState<string | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [presence, setPresence] = useState<{ online: boolean; last_seen_at?: string } | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [userZip, setUserZip] = useState<string | null>(null);
  const [proZip, setProZip] = useState<string | null>(null);
  const [distanceMiles, setDistanceMiles] = useState<number | null>(null);
  const [isInServiceArea, setIsInServiceArea] = useState(false);
  const [waitlistModalVisible, setWaitlistModalVisible] = useState(false);
  const [waitlistPhone, setWaitlistPhone] = useState('');
  const [waitlistZip, setWaitlistZip] = useState('');
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const [guestPromptVisible, setGuestPromptVisible] = useState(false);
  const requireAuth = async (actionType: 'SAVE' | 'MESSAGE' | 'BOOK', providerId: string) => {
    if (isGuestMode) {
      try {
        if (typeof (global as any).__analytics?.track === 'function') {
          (global as any).__analytics.track('guest_booking_attempt');
        }
      } catch {
        // no-op
      }
      setGuestPromptVisible(true);
      return;
    }
    await setPostAuthRoute({ name: 'CleanerProfile', params: { cleanerId: providerId, activeTab } });
    if (actionType === 'SAVE') {
      await setPendingAuthAction({ type: 'SAVE', providerId });
    }
    setAuthModalVisible(true);
  };
  const reviewCount = reviews.length;
  const firstPackage = services?.[0];
  const displayRate = firstPackage?.price ?? cleaner?.profile?.hourly_rate ?? 0;
  const displayRateIsHourly = firstPackage?.package_type === 'hourly' || (!firstPackage && !!cleaner?.profile?.hourly_rate);
  const availabilityStatus = nextAvailable === 'No availability this week' ? 'none_this_week' : 'available';

  const calculateDistance = (zipA?: string | null, zipB?: string | null): number | null => {
    if (!zipA || !zipB) return null;
    if (zipA === zipB) return 0;
    const diff = Math.abs(Number.parseInt(zipA, 10) - Number.parseInt(zipB, 10));
    if (Number.isNaN(diff)) return null;
    return Math.min(50, diff / 10);
  };

  const openWaitlistModal = () => {
    setWaitlistZip(prev => prev || userZip || proZip || '');
    setWaitlistModalVisible(true);
  };
  
  // Animation values
  const saveButtonScale = useRef(new Animated.Value(1)).current;
  // Subscribe to presence updates for this cleaner
  useEffect(() => {
    if (!cleanerId) return;
    let unsub: (() => void) | null = null;
    (async () => {
      const initial = await presenceService.getPresence(cleanerId);
      if (initial) setPresence({ online: !!initial.online, last_seen_at: initial.last_seen_at });
      unsub = presenceService.subscribe(cleanerId, (rec) => {
        if (rec) setPresence({ online: !!rec.online, last_seen_at: rec.last_seen_at });
      });
    })();
    return () => { if (unsub) unsub(); };
  }, [cleanerId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      setVideoModalVisible(false);
      setWaitlistModalVisible(false);
      setAuthModalVisible(false);
      setSelectedVideo(null);
    });
    return unsubscribe;
  }, [navigation]);

  // Load saved following state from storage
  useEffect(() => {
    const loadFollowing = async () => {
      try {
        const raw = await AsyncStorage.getItem('following_cleaners');
        const set: string[] = raw ? JSON.parse(raw) : [];
        if (cleanerId && Array.isArray(set)) setIsFollowing(set.includes(cleanerId));
      } catch {}
    };
    loadFollowing();
  }, [cleanerId]);

  const toggleFollow = async () => {
    try {
      const raw = await AsyncStorage.getItem('following_cleaners');
      const set: string[] = raw ? JSON.parse(raw) : [];
      let next: string[];
      const isNowFollowing = !set.includes(cleanerId);
      
      if (set.includes(cleanerId)) {
        next = set.filter(id => id !== cleanerId);
        setIsFollowing(false);
      } else {
        next = [...set, cleanerId];
        setIsFollowing(true);
      }
      await AsyncStorage.setItem('following_cleaners', JSON.stringify(next));
      
      // Send follow notification to cleaner (only when following, not unfollowing)
      if (isNowFollowing && user && cleanerId && user.id !== cleanerId) {
        try {
          await notificationService.sendFollowNotification(
            cleanerId,
            user.id,
            user.name || 'A customer',
            user.avatar_url
          );
          console.log('👋 Follow notification sent to cleaner:', cleanerId);
        } catch (error) {
          console.log('Could not send follow notification:', error);
        }
      }
    } catch {}
  };

  const loadCleanerAvailability = async (cleanerId: string) => {
    try {
      setLoadingAvailability(true);
      console.log('📅 Loading availability for cleaner:', cleanerId);

      // Skip DB availability when cleanerId is not a UUID (e.g., pexels/demo ids)
      if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(cleanerId)) {
        setNextAvailable('This week');
        setLoadingAvailability(false);
        return;
      }

      // Get cleaner's availability schedule
      const availabilityResponse = await availabilityService.getCleanerAvailability(cleanerId);
      
      if (!availabilityResponse.success) {
        console.log('❌ Failed to load availability:', availabilityResponse.error);
        setNextAvailable('Schedule not available');
        setLoadingAvailability(false);
        return;
      }

      const schedule = availabilityResponse.data;
      
      // Find next available time slot
      const nextAvailableSlot = findNextAvailableSlot(schedule);
      setNextAvailable(nextAvailableSlot);
      
    } catch (error) {
      console.error('❌ Error loading cleaner availability:', error);
      setNextAvailable('Schedule not available');
    } finally {
      setLoadingAvailability(false);
    }
  };

  const findNextAvailableSlot = (schedule: any): string => {
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.getHours() * 60 + now.getMinutes(); // minutes since midnight
    
    // Days of week array for formatting
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Check each day starting from today
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const checkDay = (currentDay + dayOffset) % 7;
      const daySchedule = schedule[checkDay];
      
      if (!daySchedule || daySchedule.length === 0) continue;
      
      // For today, find slots after current time
      // For future days, find earliest slot
      for (const slot of daySchedule) {
        if (!slot.is_available) continue;
        
        const [startHour, startMinute] = slot.start_time.split(':').map(Number);
        const slotStartTime = startHour * 60 + startMinute;
        
        // If it's today, slot must be in the future
        if (dayOffset === 0 && slotStartTime <= currentTime + 60) { // 60 min buffer
          continue;
        }
        
        // Format the time
        const slotDate = new Date(now);
        slotDate.setDate(slotDate.getDate() + dayOffset);
        
        const timeString = formatTimeSlot(slot.start_time);
        
        if (dayOffset === 0) {
          return `Today, ${timeString}`;
        } else if (dayOffset === 1) {
          return `Tomorrow, ${timeString}`;
        } else {
          return `${daysOfWeek[checkDay]}, ${timeString}`;
        }
      }
    }
    
    return 'No availability this week';
  };

  const formatTimeSlot = (timeString: string): string => {
    const [hour, minute] = timeString.split(':').map(Number);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  const loadCleanerVideos = async (cleanerId: string) => {
    try {
      setLoadingVideos(true);
      console.log('🎬 Loading videos for cleaner:', cleanerId);
      
      // For non-UUID demo/pexels ids - use demo account videos when available
      if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(cleanerId)) {
        const demoVids = guestModeService.getDemoVideosByCleanerId(cleanerId);
        if (demoVids.length > 0) {
          const cleanerVideos: CleanerVideo[] = demoVids.map((v) => ({
            id: v.id,
            title: v.title,
            description: v.description || '',
            media_url: v.video_url,
            thumbnail_url: v.thumbnail_url,
            view_count: v.view_count,
            like_count: v.like_count,
            created_at: v.created_at,
          }));
          setVideos(cleanerVideos);
          return;
        }
        const sampleVideos: CleanerVideo[] = [
          {
            id: 'demo-vid-1',
            title: 'Cleaning Showcase',
            description: '',
            media_url: 'https://images.unsplash.com/photo-1581579188871-45ea61f2a0c8?w=800',
            thumbnail_url: 'https://images.unsplash.com/photo-1581579188871-45ea61f2a0c8?w=800',
            view_count: 1200,
            like_count: 89,
            created_at: new Date().toISOString(),
          },
        ];
        setVideos(sampleVideos);
        return;
      }

      // Get videos by this specific cleaner from content service
      const response = await contentService.getFeed({
        filters: { 
          content_type: 'video',
          user_id: cleanerId // Filter by specific cleaner
        },
        sort_by: 'recent',
        limit: 20 // Show all their videos
      });

      if (response.success && response.data?.posts) {
        const cleanerVideos = response.data.posts.map((post: any) => ({
          id: post.id,
          title: post.title || 'Cleaning Video',
          description: post.description || '',
          media_url: post.media_url,
          thumbnail_url: post.thumbnail_url || post.media_url,
          view_count: post.view_count || 0,
          like_count: post.like_count || 0,
          created_at: post.created_at
        }));
        
        console.log(`✅ Loaded ${cleanerVideos.length} videos for cleaner`);
        setVideos(cleanerVideos);
      } else {
        console.log('📭 No videos found for this cleaner, showing sample videos');
        // Show sample videos as fallback
        const sampleVideos: CleanerVideo[] = [
          {
            id: '1',
            title: 'Kitchen Deep Clean Demo',
            media_url: '',
            thumbnail_url: '',
            view_count: 1200,
            like_count: 89,
            created_at: new Date().toISOString(),
          },
          {
            id: '2',
            title: 'Bathroom Sanitization',
            media_url: '',
            thumbnail_url: '',
            view_count: 850,
            like_count: 67,
            created_at: new Date().toISOString(),
          },
        ];
        setVideos(sampleVideos);
      }
    } catch (error) {
      console.error('❌ Error loading cleaner videos:', error);
      setVideos([]);
    } finally {
      setLoadingVideos(false);
    }
  };

  useEffect(() => {
    const fetchCleanerData = async () => {
      try {
        setLoading(true);
        if (!cleanerId) {
          console.error('❌ No cleanerId provided to CleanerProfileScreen');
          setError('No cleaner specified');
          setLoading(false);
          return;
        }
        const idToLoad = cleanerId;
        console.log('🔍 CleanerProfileScreen loading with cleanerId:', idToLoad);
        const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(idToLoad);
        
        // Load real cleaner data from database (only for UUIDs)
        console.log(`🔄 Loading cleaner profile for ID: ${idToLoad}`);

        let cleanerData: any = null; let cleanerError: any = null;
        let cleanerProfileData: any = null;
        let followersTotal = 0;
        
        if (isUuid) {
          // Fetch user row — do not require users.role = 'cleaner' (DB can be out of sync; pro_id is still valid).
          const result = await supabase
            .from('users')
            .select(`
              id,
              name,
              username,
              phone,
              email,
              avatar_url,
              role,
              is_active,
              created_at
            `)
            .eq('id', idToLoad)
            .maybeSingle();
          cleanerData = result.data;
          cleanerError = result.error;

          // Pro-specific fields — missing row is normal for legacy accounts; UI uses defaults
          if (!cleanerError && cleanerData) {
            const { data: profileData, error: profileErr } = await supabase
              .from('cleaner_profiles')
              .select('*')
              .eq('user_id', idToLoad)
              .maybeSingle();
            if (profileErr) {
              console.warn('⚠️ cleaner_profiles load:', profileErr);
            }
            cleanerProfileData = profileData;
            if (profileData) {
              console.log('📋 Loaded cleaner profile:', cleanerProfileData);
            }
          }

          // Fetch follower count
          const { count: followersCount, error: followersError } = await supabase
            .from('user_follows')
            .select('*', { count: 'exact', head: true })
            .eq('following_id', idToLoad);
          if (followersError) {
            console.warn('⚠️ Error fetching follower count:', followersError);
          }
          followersTotal = followersCount || 0;
        }

        if (cleanerError || !cleanerData) {
          if (!isUuid) {
            const demoAccount = guestModeService.getDemoAccountById(idToLoad);
            if (demoAccount) {
              console.log('📋 Using demo account:', demoAccount.name);
              setCleaner({
                id: demoAccount.id,
                name: demoAccount.name,
                username: demoAccount.username,
                phone: '+1-555-DEMO',
                email: 'demo@chorehero.com',
                avatar_url: demoAccount.avatar_url,
                role: 'cleaner' as const,
                is_active: true,
                profile: {
                  video_profile_url: '',
                  hourly_rate: demoAccount.hourly_rate,
                  rating_average: demoAccount.rating_average,
                  total_jobs: demoAccount.total_jobs,
                  bio: demoAccount.bio,
                  specialties: demoAccount.specialties,
                  verification_status: 'verified' as const,
                  is_available: true,
                  service_radius_km: 25,
                },
              });
              setFollowerCount(0);
            } else {
              console.log('📋 Using generic demo data for non-UUID:', idToLoad);
              const demoCleanerData = {
                id: idToLoad,
                name: 'Professional Cleaner',
                username: 'professionalcleaner',
                phone: '+1-555-0100',
                email: 'cleaner@chorehero.com',
                avatar_url: `https://ui-avatars.com/api/?name=Professional+Cleaner&size=120&background=0ea5e9&color=ffffff&bold=true`,
                role: 'cleaner' as const,
                is_active: true,
                profile: {
                  video_profile_url: '',
                  hourly_rate: 0,
                  rating_average: 0,
                  total_jobs: 0,
                  bio: 'Professional cleaning specialist with years of experience.',
                  specialties: ['Deep Cleaning', 'Professional Service'],
                  verification_status: 'pending' as const,
                  is_available: true,
                  service_radius_km: 25,
                },
              };
              setCleaner(demoCleanerData);
              setFollowerCount(0);
            }
          } else {
            if (cleanerError) {
              console.error('❌ Error fetching cleaner data:', cleanerError);
            } else {
              console.warn('No user row for id:', idToLoad);
            }
            setCleaner(null);
          }
        } else {
          console.log('✅ Loaded real cleaner data:', cleanerData.name);
          // Use REAL profile data from database
          setCleaner({
            ...cleanerData,
            profile: {
              video_profile_url: cleanerProfileData?.video_profile_url || '',
              hourly_rate: cleanerProfileData?.hourly_rate || 0,
              rating_average: cleanerProfileData?.rating_average || 0,
              total_jobs: cleanerProfileData?.total_jobs || 0,
              followers_count: followersTotal,
              bio: cleanerProfileData?.bio || 'Professional cleaning specialist',
              specialties: cleanerProfileData?.specialties || [],
              verification_status: cleanerProfileData?.verification_status || 'pending',
              is_available: cleanerProfileData?.is_available ?? true,
              service_radius_km: cleanerProfileData?.service_radius_km || 25,
              coverage_area: cleanerProfileData?.coverage_area || '',
              years_experience: cleanerProfileData?.years_experience || 0,
            },
          });
          setFollowerCount(followersTotal);
        }

        // Load packages from content_posts (matches feed) - not legacy cleaner_services
        let services: CleanerService[] = [];
        if (isUuid) {
          const { data: packages, error: packagesError } = await supabase
            .from('content_posts')
            .select('id, title, description, media_url, base_price_cents, package_type, estimated_hours')
            .eq('user_id', idToLoad)
            .eq('is_bookable', true)
            .eq('status', 'published')
            .order('created_at', { ascending: false });

          if (packagesError) {
            console.warn('⚠️ Error loading packages:', packagesError);
          } else if (packages?.length) {
            services = packages.map((p: any) => ({
              id: p.id,
              title: p.title || 'Cleaning Service',
              description: p.description || 'Professional cleaning service.',
              price: p.base_price_cents != null ? p.base_price_cents / 100 : 0,
              duration: p.estimated_hours != null ? `Est. ${p.estimated_hours} hrs` : '2-3 hrs',
              image: p.media_url || '',
              package_id: p.id,
              package_type: p.package_type || 'fixed',
              base_price_cents: p.base_price_cents,
              estimated_hours: p.estimated_hours ?? undefined,
            }));
            console.log(`✅ Loaded ${services.length} packages for cleaner (matches feed)`);
          }
        } else {
          const demoVids = guestModeService.getDemoVideosByCleanerId(idToLoad);
          if (demoVids.length > 0) {
            services = demoVids.map((v) => ({
              id: v.id,
              title: v.title,
              description: v.description || '',
              price: v.base_price_cents != null ? v.base_price_cents / 100 : 0,
              duration: v.estimated_hours != null ? `Est. ${v.estimated_hours} hrs` : v.package_type === 'contact' ? 'Quote' : '2-3 hrs',
              image: v.thumbnail_url || '',
              package_id: v.id,
              package_type: v.package_type || 'fixed',
              base_price_cents: v.base_price_cents ?? undefined,
              estimated_hours: v.estimated_hours ?? undefined,
            }));
            console.log(`✅ Loaded ${services.length} demo packages for cleaner`);
          }
        }
        setServices(services);

        // Load cleaner's reviews
        const { data: reviews, error: reviewsError } = await supabase
          .from('reviews')
          .select(`
            id,
            rating,
            comment,
            created_at,
            customer:users!customer_id(
              name,
              avatar_url
            )
          `)
          .eq('cleaner_id', idToLoad)
          .order('created_at', { ascending: false })
          .limit(10);

        if (reviewsError) {
          console.warn('⚠️ Error loading reviews:', reviewsError);
          setReviews([]);
        } else {
          setReviews(reviews || []);
          console.log(`✅ Loaded ${reviews?.length || 0} reviews for cleaner`);
        }

        // Load videos and availability
        await loadCleanerVideos(idToLoad);
        await loadCleanerAvailability(idToLoad);

      } catch (error) {
        console.error('Error fetching cleaner data:', error);
        // Set empty data on error
        setCleaner(null);
        setServices([]);
        setReviews([]);
        setVideos([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCleanerData();
  }, [cleanerId]);

  useEffect(() => {
    const loadZipContext = async () => {
      try {
        const storedGuestZip = await AsyncStorage.getItem('guest_zip');
        if (storedGuestZip) setUserZip(storedGuestZip);

        if (user?.id) {
          const { data: userAddress } = await supabase
            .from('addresses')
            .select('zip_code')
            .eq('user_id', user.id)
            .eq('is_default', true)
            .limit(1)
            .maybeSingle();
          if (userAddress?.zip_code) setUserZip(userAddress.zip_code);
        }

        if (cleaner?.id) {
          const { data: cleanerAddress } = await supabase
            .from('addresses')
            .select('zip_code')
            .eq('user_id', cleaner.id)
            .eq('is_default', true)
            .limit(1)
            .maybeSingle();
          if (cleanerAddress?.zip_code) setProZip(cleanerAddress.zip_code);
        }
      } catch (error) {
        console.warn('⚠️ Error loading zip context:', error);
      }
    };
    loadZipContext();
  }, [user?.id, cleaner?.id]);

  useEffect(() => {
    const miles = calculateDistance(userZip, proZip);
    setDistanceMiles(miles);
    const radiusMiles = Math.round((cleaner?.profile?.service_radius_km || 0) * 0.621);
    setIsInServiceArea(miles !== null && radiusMiles > 0 && miles <= radiusMiles);
  }, [userZip, proZip, cleaner?.profile?.service_radius_km]);

  // Animate save button on press
  const handleSavePress = () => {
    if (!user?.id) {
      requireAuth('SAVE', cleanerId);
      return;
    }
    Animated.sequence([
      Animated.timing(saveButtonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(saveButtonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    
    setIsSaved(!isSaved);
  };



  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#26B7C9" />
        <Text style={styles.loadingText}>Loading cleaner profile...</Text>
      </View>
    );
  }

  if (!cleaner) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#26B7C9" />
          </TouchableOpacity>
          <View style={{ width: 44 }} />
          <View style={styles.shareButton} />
        </View>

        <View style={styles.emptyStateContainer}>
          <LinearGradient
            colors={['#F9FAFB', '#F3F4F6']}
            style={styles.emptyStateGradient}
          >
            <View style={styles.emptyStateIconContainer}>
              <LinearGradient colors={['#26B7C9', '#047B9B']} style={styles.emptyStateIconGradient}>
                <Ionicons name="person-outline" size={64} color="#ffffff" />
              </LinearGradient>
            </View>
            <Text style={styles.emptyStateTitle}>
              No cleaner data available
            </Text>
            <Text style={styles.emptyStateSubtitle}>
              Cleaner profiles will appear here when cleaners join your area and create their profiles.
            </Text>
            {true && (
              <View style={styles.emptyStateFeatures}>
                <View style={styles.featureItem}>
                  <Ionicons name="star" size={20} color="#26B7C9" />
                  <Text style={styles.featureText}>Verified cleaner profiles</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="shield-checkmark" size={20} color="#26B7C9" />
                  <Text style={styles.featureText}>Background checked</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="chatbubble" size={20} color="#26B7C9" />
                  <Text style={styles.featureText}>Direct messaging</Text>
                </View>
              </View>
            )}
            <TouchableOpacity 
              style={styles.exploreButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.exploreButtonText}>Go Back</Text>
              <Ionicons name="arrow-back" size={20} color="#26B7C9" />
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </SafeAreaView>
    );
  }

  const renderTabButton = (tab: 'videos' | 'services' | 'reviews' | 'about', label: string) => (
    <TouchableOpacity
      style={[styles.tabButton, activeTab === tab && styles.activeTabButton]}
      onPress={() => setActiveTab(tab)}
      activeOpacity={0.8}
      hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
    >
      <Text style={[styles.tabButtonText, activeTab === tab && styles.activeTabButtonText]}>
        {label}
      </Text>
      {activeTab === tab && <View style={styles.activeTabIndicator} />}
    </TouchableOpacity>
  );

  const renderServiceCard = (service: CleanerService) => (
    <View style={styles.serviceCard} key={service.id}>
      <View style={styles.serviceHeader}>
        <View style={styles.serviceImageContainer}>
          <Image 
            source={{ uri: service.image || 'https://via.placeholder.com/60x60/009688/FFFFFF?text=🧹' }} 
            style={styles.serviceImage}
          />
        </View>
        <View style={styles.serviceInfo}>
          <Text style={styles.serviceTitle}>{service?.title || service?.name || 'Service'}</Text>
          <Text style={styles.serviceDescription}>{service.description}</Text>
          <View style={styles.serviceMeta}>
            <View style={styles.serviceMetaItem}>
              <Ionicons name="time-outline" size={14} color="#26B7C9" />
              <Text style={styles.serviceMetaText}>{service.duration}</Text>
            </View>
            <View style={styles.serviceMetaItem}>
              <Ionicons name="star" size={14} color="#E6B200" />
              <Text style={styles.serviceMetaText}>4.9</Text>
            </View>
          </View>
        </View>
        <View style={styles.servicePriceContainer}>
          <Text style={styles.servicePrice}>
            {service.package_type === 'hourly' && service.estimated_hours != null
              ? `$${service.price}/hr • Est. ${service.estimated_hours} hrs`
              : `$${service.price}`}
          </Text>
          <TouchableOpacity 
            style={styles.bookNowButton}
            onPress={() => {
              if (isGuestMode) {
                try {
                  if (typeof (global as any).__analytics?.track === 'function') {
                    (global as any).__analytics.track('guest_booking_attempt');
                  }
                } catch {
                  // no-op
                }
                setGuestPromptVisible(true);
                return;
              }
              navigation.navigate('UnifiedBooking', {
                cleanerId: cleaner?.id,
                cleanerName: cleaner?.name,
                hourlyRate: service.price,
                packageId: service.package_id,
                packageType: service.package_type,
                packageBasePriceCents: service.base_price_cents ?? undefined,
                estimatedHours: service.estimated_hours ?? undefined,
                selectedService: service.title || service.name,
              });
            }}
          >
            <LinearGradient
              colors={['#26B7C9', '#047B9B']}
              style={styles.bookNowGradient}
            >
              <Text style={styles.bookNowText}>Book Now</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderReviewCard = (review: Review) => (
    <View style={styles.reviewCard} key={review.id}>
      <View style={styles.reviewHeader}>
        <Image source={{ uri: review.user.avatar }} style={styles.reviewerAvatar} />
        <View style={styles.reviewerInfo}>
          <Text style={styles.reviewerName}>{review.user.name}</Text>
          <View style={styles.reviewRating}>
            {[...Array(5)].map((_, index) => (
              <Ionicons
                key={index}
                name={index < review.rating ? "star" : "star-outline"}
                size={14}
                color="#E6B200"
              />
            ))}
          </View>
        </View>
        <Text style={styles.reviewDate}>{review.date}</Text>
      </View>
      <Text style={styles.reviewComment}>{review.comment}</Text>
    </View>
  );

  // dimensions computed at top to ensure stable hook order

  const renderVideoCard = (video: CleanerVideo) => (
    <TouchableOpacity 
      key={video.id} 
      style={[styles.videoCard, { width: videoCardWidth }]}
      onPress={() => {
        // Navigate to full-screen video feed with all cleaner's videos
        navigateToChoresContent(navigation as any, {
          source: 'cleaner',
          cleanerId: cleanerId,
          initialVideoId: video.id,
          proId: cleanerId,
        });
      }}
    >
      <View style={styles.videoThumbnailContainer}>
        {video.thumbnail_url ? (
          <Image 
            source={{ uri: video.thumbnail_url }} 
            style={styles.videoThumbnail}
            resizeMode="cover"
            fadeDuration={120}
          />
        ) : (
          <LinearGradient
            colors={['#047B9B', '#26B7C9', '#26B7C9']}
            style={styles.videoPlaceholder}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.placeholderIconContainer}>
              <Ionicons name="videocam" size={28} color="rgba(255,255,255,0.9)" />
            </View>
            <Text style={styles.placeholderText}>{video.title?.substring(0, 15) || 'Video'}...</Text>
          </LinearGradient>
        )}
        
        {/* Gradient overlay for depth */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.4)']}
          style={styles.videoGradientOverlay}
        />
        
        {/* Play icon overlay */}
        <View style={styles.videoPlayOverlay}>
          <View style={styles.videoPlayButton}>
            <Ionicons name="play" size={22} color="#FFFFFF" />
          </View>
        </View>
        
        {/* Video stats */}
        <View style={styles.videoStats}>
          <View style={styles.videoStat}>
            <Ionicons name="eye" size={12} color="#26B7C9" />
            <Text style={styles.videoStatText}>{video.view_count}</Text>
          </View>
          <View style={styles.videoStat}>
            <Ionicons name="heart" size={12} color="#EF4444" />
            <Text style={styles.videoStatText}>{video.like_count}</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.videoInfo}>
        <Text style={styles.videoTitle} numberOfLines={2}>{video.title}</Text>
        <Text style={styles.videoDate}>
          {new Date(video.created_at).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      
      

      {/* Main Header */}
      <View style={styles.headerCompact}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#26B7C9" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.shareButton}>
          <Ionicons name="share-outline" size={24} color="#26B7C9" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={styles.profileSection}>
          <View style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <View style={styles.avatarContainer}>
                <Image 
                  source={{ uri: cleaner.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(cleaner.name || 'Cleaner')}&background=26B7C9&color=fff&size=160&font-size=0.4&format=png` }} 
                  style={styles.profileAvatar} 
                />
                {/* Online Status Ring */}
                <View style={[styles.onlineStatusRing, { backgroundColor: presence?.online ? COLORS.success : '#9CA3AF' }]} />
                {cleaner.profile.verification_status === 'verified' && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark" size={12} color="white" />
                  </View>
                )}
              </View>
              <View style={styles.profileInfo}>
                <View style={styles.nameContainer}>
                  <Text style={styles.profileName}>{cleaner?.name || 'Cleaner'}</Text>
                </View>
                <Text style={styles.profileTagline} numberOfLines={1}>
                  {cleaner?.profile?.specialties?.length > 0
                    ? `${cleaner.profile.specialties[0]}${cleaner.profile.specialties.length > 1 ? ` • ${cleaner.profile.specialties.slice(1, 3).join(', ')}` : ''}`
                    : 'Professional cleaning'}
                </Text>
                <View style={styles.locationContainer}>
                  <Ionicons name="location-outline" size={14} color="#26B7C9" />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {[
                      distanceMiles !== null
                        ? `${distanceMiles.toFixed(1)} mi away`
                        : cleaner.profile.coverage_area || 'Distance unavailable',
                      cleaner.profile.service_radius_km > 0
                        ? `${Math.round(cleaner.profile.service_radius_km * 0.621)} mi radius`
                        : null,
                      isInServiceArea ? 'In your area' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <View style={styles.ratingContainer}>
                  {reviewCount === 0 ? (
                    <View style={styles.newHeroBadge}>
                      <Ionicons name="sparkles" size={14} color="#047B9B" />
                      <Text style={styles.newHeroText}>New Hero</Text>
                    </View>
                  ) : (
                    <>
                      <Ionicons name="star" size={16} color="#E6B200" />
                      <Text style={styles.ratingText}>
                        {cleaner.profile.rating_average > 0 
                          ? `${cleaner.profile.rating_average} (${reviewCount} reviews)`
                          : 'New Hero'}
                      </Text>
                    </>
                  )}
                </View>
              </View>
            </View>
            
            {/* Bio — hidden if empty or low-quality (short / template strings) */}
            {cleaner.profile.bio && cleaner.profile.bio.trim().length >= 40 && (
              <View style={styles.bioCard}>
                <Text style={styles.profileBio} numberOfLines={showFullBio ? undefined : 3}>
                  {cleaner.profile.bio}
                </Text>
                {cleaner.profile.bio.length > 100 && (
                  <TouchableOpacity onPress={() => setShowFullBio(!showFullBio)} activeOpacity={0.7}>
                    <Text style={styles.readMoreText}>{showFullBio ? 'Show less' : 'Read more'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Trust row — inline meta, no competing chips */}
            <View style={styles.trustRow}>
              <Ionicons name="shield-checkmark" size={14} color="#047857" />
              <Text style={styles.trustItem}>Verified</Text>
              <Text style={styles.trustDot}>·</Text>
              <Ionicons name="trophy" size={14} color="#E6B200" />
              <Text style={styles.trustItem}>Top rated</Text>
              {hasRepeatClients ? (
                <>
                  <Text style={styles.trustDot}>·</Text>
                  <Ionicons name="people" size={14} color="#047B9B" />
                  <Text style={styles.trustItem}>100+ repeat</Text>
                </>
              ) : null}
            </View>

            {/* Stats row — unified StatRow primitive (Airbnb-style) */}
            <View style={{ marginBottom: 16 }}>
              <StatRow
                items={[
                  { value: cleaner.profile.total_jobs ?? 0, label: 'Bookings' },
                  { value: followerCount, label: 'Followers' },
                  {
                    value:
                      displayRate > 0
                        ? displayRateIsHourly
                          ? `$${displayRate}/hr`
                          : `$${displayRate}`
                        : 'Contact',
                    label: 'Rate',
                  },
                ]}
              />
            </View>

            {/* Availability */}
            <View style={styles.availabilityBubble}>
              <Ionicons name="calendar-outline" size={16} color="#26B7C9" />
              {loadingAvailability ? (
                <Text style={styles.availabilityText}>Loading availability…</Text>
              ) : (
                <Text style={styles.availabilityText}>
                  Next available: {nextAvailable || 'Schedule not available'}
                </Text>
              )}
            </View>

            {/* Action Buttons — Message is the single primary CTA (booking happens from feed packages) */}
            <View style={styles.actionButtons}>
              {false ? null : (
                <TouchableOpacity
                  style={styles.primaryActionButton}
                  onPress={async () => {
                    if (!user?.id) {
                      requireAuth('MESSAGE', cleanerId);
                      return;
                    }
                    if (user.id === cleaner.id) {
                      Alert.alert(
                        'Cannot Message Yourself',
                        'You cannot send messages to your own profile.',
                        [{ text: 'OK', style: 'default' }]
                      );
                      return;
                    }
                    const participant: MessageParticipant = {
                      id: cleaner.id,
                      name: cleaner.name,
                      avatar: cleaner.avatar_url || '',
                      role: 'cleaner',
                    };
                    await routeToMessage({
                      participant,
                      navigation,
                      currentUserId: user.id,
                    });
                  }}
                >
                  <LinearGradient
                    colors={['#26B7C9', '#047B9B']}
                    style={styles.primaryActionGradient}
                  >
                    <Ionicons name="chatbubble" size={20} color="white" />
                    <Text style={styles.primaryActionText}>Message</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
              
              <View style={styles.secondaryActions}>
                <Animated.View style={{ transform: [{ scale: saveButtonScale }] }}>
                  <TouchableOpacity 
                    style={[styles.secondaryActionButton, isSaved && styles.savedActionButton]}
                    onPress={handleSavePress}
                  >
                    <Ionicons 
                      name={isSaved ? "bookmark" : "bookmark-outline"} 
                      size={16} 
                      color={isSaved ? "white" : "#26B7C9"} 
                    />
                    <Text style={[styles.secondaryActionText, isSaved && styles.savedActionText]} numberOfLines={1}>
                      {isSaved ? 'Saved' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>

                <TouchableOpacity
                  style={[styles.followSmallButton, isFollowing && styles.followSmallButtonActive]}
                  onPress={toggleFollow}
                >
                  <Ionicons name={isFollowing ? 'checkmark' : 'add'} size={16} color={isFollowing ? 'white' : '#26B7C9'} />
                  <Text style={[styles.followSmallText, isFollowing && styles.followSmallTextActive]} numberOfLines={1}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Sticky Tabs */}
        <View style={styles.tabsContainer}>
          {renderTabButton('videos', 'Videos')}
          {renderTabButton('services', 'Services')}
          {renderTabButton('reviews', 'Reviews')}
          {renderTabButton('about', 'About')}
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'videos' && (
            <View>
              {loadingVideos ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#26B7C9" />
                  <Text style={styles.loadingText}>Loading videos...</Text>
                </View>
              ) : videos.length > 0 ? (
                <FlatList
                  data={videos}
                  renderItem={({ item }) => renderVideoCard(item)}
                  keyExtractor={(item) => item.id}
                  numColumns={2}
                  columnWrapperStyle={styles.videoColumn}
                  scrollEnabled={false}
                  removeClippedSubviews
                  initialNumToRender={4}
                  windowSize={5}
                />
              ) : (
                <View style={styles.emptyVideoState}>
                  <Ionicons name="videocam-outline" size={48} color="#C7C7CC" />
                  <Text style={styles.emptyVideoTitle}>No Videos Yet</Text>
                  <Text style={styles.emptyVideoSubtitle}>
                    This cleaner hasn't shared any videos of their work yet.
                  </Text>
                  <TouchableOpacity
                    style={styles.requestVideoButton}
                    onPress={() => {
                      if (!user?.id) {
                        requireAuth('MESSAGE', cleanerId);
                        return;
                      }
                      const participant: MessageParticipant = {
                        id: cleaner.id,
                        name: cleaner.name,
                        avatar: cleaner.avatar_url || '',
                        role: 'cleaner',
                      };
                      routeToMessage({
                        participant,
                        navigation,
                        currentUserId: user.id,
                      });
                    }}
                  >
                    <Ionicons name="megaphone-outline" size={18} color="#ffffff" />
                    <Text style={styles.requestVideoText}>Request a Video</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {activeTab === 'services' && (
            <View>
              {services.map(renderServiceCard)}
            </View>
          )}

          {activeTab === 'reviews' && cleaner?.id && (
            <CleanerProfileReviews
              cleanerId={cleaner.id}
              cachedAverage={cleaner?.profile?.rating_average}
            />
          )}

          {activeTab === 'about' && (
            <View>
              <View style={styles.aboutCard}>
                <Text style={styles.aboutTitle}>Specialties</Text>
                <View style={styles.specialtiesList}>
                  {cleaner.profile.specialties.map((specialty: string, index: number) => (
                    <View key={index} style={styles.specialtyTag}>
                      <Text style={styles.specialtyText}>{specialty}</Text>
                    </View>
                  ))}
                </View>

                <Text style={styles.aboutTitle}>Languages</Text>
                <View style={styles.languagesList}>
                  {['English', 'Spanish'].map((language: string, index: number) => (
                    <View key={index} style={styles.languageTag}>
                      <Text style={styles.languageText}>{language}</Text>
                    </View>
                  ))}
                </View>

                <Text style={styles.aboutTitle}>Member Since</Text>
                <Text style={styles.memberSinceText}>March 2023</Text>
              </View>
            </View>
          )}
        </View>

        {/* Bottom spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Video Player Modal */}
      <Modal
        visible={videoModalVisible}
        animationType="fade"
        transparent={false}
        onRequestClose={() => setVideoModalVisible(false)}
      >
        <View style={styles.videoModalContainer}>
          <StatusBar barStyle="light-content" />
          
          {/* Close Button */}
          <TouchableOpacity 
            style={styles.videoModalClose}
            onPress={() => setVideoModalVisible(false)}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          
          {/* Video Player */}
          {selectedVideo && (
            <Video
              source={{ uri: selectedVideo.media_url }}
              style={styles.videoModalPlayer}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
              isLooping
            />
          )}
          
          {/* Video Info */}
          <View style={styles.videoModalInfo}>
            <Text style={styles.videoModalTitle}>{selectedVideo?.title}</Text>
            <Text style={styles.videoModalDescription}>{selectedVideo?.description}</Text>
            <View style={styles.videoModalStats}>
              <View style={styles.videoModalStat}>
                <Ionicons name="eye" size={16} color="#FFFFFF" />
                <Text style={styles.videoModalStatText}>{selectedVideo?.view_count} views</Text>
              </View>
              <View style={styles.videoModalStat}>
                <Ionicons name="heart" size={16} color="#EF4444" />
                <Text style={styles.videoModalStatText}>{selectedVideo?.like_count} likes</Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>
      <AuthModal
        visible={authModalVisible}
        onClose={() => setAuthModalVisible(false)}
        onOpenEmail={() => {
          setAuthModalVisible(false);
          navigation.navigate('AuthScreen');
        }}
      />
      <GuestPromptModal
        visible={guestPromptVisible}
        type="booking_attempt"
        onSignUp={() => {
          setGuestPromptVisible(false);
          (navigation as any).navigate('Welcome');
        }}
        onDismiss={() => setGuestPromptVisible(false)}
      />

      <Modal
        visible={waitlistModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setWaitlistModalVisible(false)}
      >
        <View style={styles.waitlistOverlay}>
          <View style={styles.waitlistCard}>
            <Text style={styles.waitlistTitle}>Join {cleaner?.name || 'this'}'s Waitlist</Text>
            <Text style={styles.waitlistSubtitle}>
              We’ll text you when {cleaner?.name || 'this pro'} opens availability.
            </Text>
            <TextInput
              style={styles.waitlistInput}
              placeholder="Phone number"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              value={waitlistPhone}
              onChangeText={setWaitlistPhone}
            />
            <TextInput
              style={styles.waitlistInput}
              placeholder="ZIP code"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              maxLength={5}
              value={waitlistZip}
              onChangeText={(text) => setWaitlistZip(text.replace(/\D/g, '').slice(0, 5))}
            />
            <View style={styles.waitlistActions}>
              <TouchableOpacity
                style={styles.waitlistCancel}
                onPress={() => setWaitlistModalVisible(false)}
              >
                <Text style={styles.waitlistCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.waitlistSubmit}
                onPress={async () => {
                  const digits = waitlistPhone.replace(/\D/g, '');
                  if (digits.length < 10 || waitlistZip.length !== 5) {
                    Alert.alert('Missing Info', 'Enter a valid phone and ZIP.');
                    return;
                  }
                  try {
                    setWaitlistSubmitting(true);
                    const { error } = await supabase.from('waitlist_leads').insert({
                      phone: digits,
                      zip_code: waitlistZip,
                      primary_service_needed: `Cleaner waitlist - ${cleaner?.name || 'Pro'}`,
                    });
                    if (error) throw error;
                    setWaitlistModalVisible(false);
                    Alert.alert('Added!', `We'll notify you when ${cleaner?.name || 'this pro'} is available.`);
                  } catch (error) {
                    Alert.alert('Waitlist', 'Unable to join waitlist. Try again.');
                  } finally {
                    setWaitlistSubmitting(false);
                  }
                }}
                disabled={waitlistSubmitting}
              >
                <Text style={styles.waitlistSubmitText}>
                  {waitlistSubmitting ? 'Adding…' : 'Join Waitlist'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },

  // Main Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('2%'),
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 0,
  },
  headerCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('1.2%'),
    backgroundColor: '#F9FAFB',
  },
  backButton: {
    width: wp('11%'),
    height: wp('11%'),
    borderRadius: wp('5.5%'),
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  headerTitle: {
    fontSize: wp('5%'),
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  shareButton: {
    width: wp('11%'),
    height: wp('11%'),
    borderRadius: wp('5.5%'),
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  scrollView: {
    flex: 1,
  },
  profileSection: {
    paddingHorizontal: wp('5%'),
    paddingTop: hp('1%'),
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  profileHeader: {
    flexDirection: 'row',
    marginBottom: hp('2.5%'),
  },
  avatarContainer: {
    position: 'relative',
    marginRight: wp('4%'),
  },
  profileAvatar: {
    width: wp('22%'),
    height: wp('22%'),
    borderRadius: wp('11%'),
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  onlineStatusRing: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: wp('2.5%'),
    borderWidth: 3,
    borderColor: 'white',
  },
  verifiedBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#26B7C9',
    borderRadius: wp('3%'),
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  profileInfo: {
    flex: 1,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('0.7%'),
  },
  profileName: {
    fontSize: wp('6%'),
    fontWeight: '700',
    color: '#0F172A',
    marginRight: 8,
    letterSpacing: -0.5,
  },
  profileUsername: {
    fontSize: wp('4%'),
    color: '#64748B',
    marginBottom: hp('0.5%'),
    fontWeight: '500',
  },
  profileTagline: {
    fontSize: wp('3.5%'),
    color: '#26B7C9',
    fontWeight: '600',
    marginBottom: hp('1.2%'),
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('0.7%'),
    flexShrink: 1,
  },
  locationText: {
    flexShrink: 1,
    flex: 1,
    fontSize: 13,
    color: '#64748B',
    marginLeft: 4,
    fontWeight: '500',
  },
  distanceText: {
    fontSize: 13,
    color: '#9CA3AF',
    marginLeft: 4,
    fontWeight: '400',
  },
  serviceAreaText: {
    fontSize: wp('3%'),
    color: '#059669',
    marginLeft: 6,
    fontWeight: '600',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  newHeroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    borderRadius: 999,
    paddingHorizontal: wp('2.5%'),
    paddingVertical: hp('0.5%'),
  },
  newHeroText: {
    marginLeft: 6,
    fontSize: 13,
    color: '#047B9B',
    fontWeight: '700',
  },
  ratingText: {
    fontSize: 15,
    color: '#64748B',
    marginLeft: 4,
    fontWeight: '500',
  },
  bioCard: {
    backgroundColor: '#F4F6F8',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  trustItem: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
    marginLeft: 2,
  },
  trustDot: {
    fontSize: 13,
    color: '#94A3B8',
    marginHorizontal: 2,
  },
  profileBio: {
    fontSize: wp('3.8%'),
    color: '#374151',
    lineHeight: 24,
    fontWeight: '400',
  },
  readMoreText: {
    fontSize: 13,
    color: '#26B7C9',
    fontWeight: '700',
    marginTop: hp('1%'),
  },
  trustBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp('2%'),
    marginBottom: hp('2%'),
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: wp('3.5%'),
    paddingVertical: hp('1.2%'),
    borderRadius: wp('5%'),
    borderWidth: 1.5,
    borderColor: 'rgba(38, 183, 201, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  trustBadgeText: {
    fontSize: wp('3%'),
    color: '#059669',
    fontWeight: '600',
    marginLeft: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp('2%'),
    paddingVertical: hp('1.7%'),
    paddingHorizontal: wp('4%'),
    backgroundColor: '#FFFFFF',
    borderRadius: wp('4%'),
    borderWidth: 2,
    borderColor: 'rgba(38, 183, 201, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  statsCollapsedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  statCollapsedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('1.5%'),
  },
  statCollapsedText: {
    fontSize: wp('3.2%'),
    color: '#64748B',
    fontWeight: '600',
  },
  statsExpandedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  statItem: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  statValue: {
    fontSize: wp('3.5%'),
    fontWeight: '800',
    color: '#26B7C9',
    marginLeft: 4,
    letterSpacing: -0.2,
  },
  statLabel: {
    fontSize: wp('2.8%'),
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
  },
  availabilityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF7CD',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.5%'),
    borderRadius: wp('3%'),
    borderWidth: 1,
    borderColor: '#FDE047',
    marginBottom: hp('3%'),
  },
  availabilityBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.7%'),
    borderRadius: wp('4%'),
    borderWidth: 2,
    borderColor: 'rgba(38, 183, 201, 0.25)',
    backgroundColor: '#FFFFFF',
    marginBottom: hp('2.5%'),
    gap: wp('2.5%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  availabilityText: {
    fontSize: wp('3.5%'),
    color: '#26B7C9',
    fontWeight: '600',
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: 'column',
    gap: hp('1.5%'),
  },
  primaryActionButton: {
    borderRadius: wp('4%'),
    overflow: 'hidden',
    shadowColor: '#26B7C9',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('2.2%'),
    paddingHorizontal: wp('6%'),
  },
  primaryActionText: {
    color: 'white',
    fontSize: wp('4%'),
    fontWeight: '600',
    marginLeft: 8,
    letterSpacing: 0.2,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: wp('3%'),
  },
  secondaryActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'white',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  savedActionButton: {
    backgroundColor: '#26B7C9',
    borderColor: '#26B7C9',
  },
  secondaryActionText: {
    color: '#26B7C9',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  savedActionText: {
    color: 'white',
  },
  followSmallButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'white',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  followSmallButtonActive: {
    backgroundColor: '#26B7C9',
    borderColor: '#26B7C9',
  },
  followSmallText: {
    color: '#26B7C9',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  followSmallTextActive: {
    color: 'white',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: wp('5%'),
    marginTop: hp('2.5%'),
    marginBottom: hp('2%'),
    backgroundColor: '#FFFFFF',
    borderRadius: wp('4%'),
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(38, 183, 201, 0.15)',
  },
  tabButton: {
    flex: 1,
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('2%'),
    alignItems: 'center',
    position: 'relative',
    minHeight: 44,
    borderRadius: wp('3%'),
  },
  activeTabButton: {
    backgroundColor: 'rgba(38, 183, 201, 0.12)',
  },
  tabButtonText: {
    fontSize: wp('3.5%'),
    fontWeight: '600',
    color: '#9CA3AF',
  },
  activeTabButtonText: {
    color: '#26B7C9',
    fontWeight: '700',
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: 4,
    left: '25%',
    right: '25%',
    height: 3,
    backgroundColor: '#26B7C9',
    borderRadius: 2,
  },
  tabContent: {
    paddingHorizontal: wp('5%'),
  },
  serviceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: wp('4.5%'),
    padding: wp('4.5%'),
    marginBottom: hp('1.7%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(38, 183, 201, 0.12)',
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceImageContainer: {
    marginRight: wp('3%'),
  },
  serviceImage: {
    width: wp('15%'),
    height: wp('15%'),
    borderRadius: wp('2%'),
    backgroundColor: '#F0FDFA',
  },
  serviceInfo: {
    flex: 1,
    marginRight: 12,
  },
  serviceTitle: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: hp('0.5%'),
  },
  serviceDescription: {
    fontSize: wp('3.5%'),
    color: '#6B7280',
    marginBottom: hp('1%'),
    lineHeight: 20,
  },
  serviceMeta: {
    flexDirection: 'row',
    gap: wp('4%'),
  },
  serviceMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceMetaText: {
    fontSize: wp('3%'),
    color: '#26B7C9',
    marginLeft: 4,
  },
  servicePriceContainer: {
    alignItems: 'flex-end',
  },
  servicePrice: {
    fontSize: wp('4.5%'),
    fontWeight: '700',
    color: '#26B7C9', // Teal for customer-facing view
    marginBottom: hp('1%'),
  },
  bookNowButton: {
    borderRadius: wp('2%'),
    overflow: 'hidden',
  },
  bookNowGradient: {
    paddingVertical: hp('1%'),
    paddingHorizontal: wp('4%'),
  },
  bookNowText: {
    color: 'white',
    fontSize: wp('3%'),
    fontWeight: '600',
  },
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: wp('4.5%'),
    padding: 18,
    marginBottom: hp('1.7%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(38, 183, 201, 0.08)',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('1.5%'),
  },
  reviewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: wp('5%'),
    marginRight: 12,
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: wp('3.5%'),
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: hp('0.5%'),
  },
  reviewRating: {
    flexDirection: 'row',
  },
  reviewDate: {
    fontSize: wp('3%'),
    color: '#6B7280',
  },
  reviewComment: {
    fontSize: wp('3.5%'),
    color: '#374151',
    lineHeight: 20,
  },
  viewAllReviewsButton: {
    alignItems: 'center',
    paddingVertical: hp('2%'),
  },
  viewAllReviewsText: {
    fontSize: wp('3.5%'),
    color: '#26B7C9',
    fontWeight: '600',
  },
  // Empty reviews state
  emptyReviewsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('6%'),
    paddingHorizontal: wp('6%'),
    backgroundColor: '#FFFFFF',
    borderRadius: wp('5%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  emptyReviewsTitle: {
    fontSize: wp('4.5%'),
    fontWeight: '700',
    color: '#1F2937',
    marginTop: hp('2%'),
    marginBottom: hp('1%'),
  },
  emptyReviewsText: {
    fontSize: wp('3.5%'),
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  // Rating summary card
  ratingSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: wp('5%'),
    padding: 24,
    marginBottom: hp('2%'),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 2,
    borderColor: 'rgba(38, 183, 201, 0.15)',
  },
  ratingSummaryLeft: {
    alignItems: 'center',
  },
  ratingBigNumber: {
    fontSize: wp('12%'),
    fontWeight: '800',
    color: '#1F2937',
    letterSpacing: -1,
  },
  ratingStarsRow: {
    flexDirection: 'row',
    gap: wp('1%'),
    marginTop: hp('1%'),
  },
  ratingCountText: {
    fontSize: wp('3.5%'),
    color: '#6B7280',
    marginTop: hp('1%'),
  },
  aboutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: wp('5%'),
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(38, 183, 201, 0.15)',
  },
  aboutTitle: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: hp('1.5%'),
    marginTop: hp('2%'),
  },
  specialtiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp('2%'),
    marginBottom: hp('2%'),
  },
  specialtyTag: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: wp('4%'),
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('0.7%'),
  },
  specialtyText: {
    fontSize: wp('3%'),
    color: '#059669',
    fontWeight: '500',
  },
  languagesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp('2%'),
    marginBottom: hp('2%'),
  },
  languageTag: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: wp('4%'),
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('0.7%'),
  },
  languageText: {
    fontSize: wp('3%'),
    color: '#059669',
    fontWeight: '500',
  },
  memberSinceText: {
    fontSize: wp('3.5%'),
    color: '#6B7280',
  },
  bottomSpacing: {
    height: hp('15%'),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    color: '#1F2937',
    fontSize: wp('4%'),
    marginTop: hp('2%'),
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 20,
  },
  errorText: {
    color: '#1F2937',
    fontSize: wp('4.5%'),
    marginTop: hp('2%'),
    marginBottom: hp('3%'),
  },
  backButtonText: {
    color: '#26B7C9',
    fontSize: wp('4%'),
    fontWeight: '600',
  },

  // Empty State Styles
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateGradient: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp('10%'),
  },
  emptyStateIconContainer: {
    marginBottom: 30,
  },
  emptyStateIconGradient: {
    width: 120,
    height: 120,
    borderRadius: wp('15%'),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#26B7C9',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  emptyStateTitle: {
    fontSize: wp('7%'),
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: hp('2%'),
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: wp('4%'),
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: hp('5%'),
  },
  emptyStateFeatures: {
    alignItems: 'flex-start',
    marginBottom: hp('5%'),
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('2%'),
  },
  featureText: {
    fontSize: wp('4%'),
    color: '#374151',
    fontWeight: '600',
    marginLeft: 12,
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#26B7C9',
    paddingHorizontal: wp('8%'),
    paddingVertical: hp('2%'),
    borderRadius: 25,
    shadowColor: '#26B7C9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  
  // Video styles - Enhanced Depth Theme
  videosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp('3.5%'),
    paddingHorizontal: 0,
    paddingTop: hp('1.5%'),
    paddingBottom: hp('3%'),
  },
  videoColumn: {
    justifyContent: 'space-between',
    gap: wp('3.5%'),
    marginBottom: hp('1.7%'),
  },
  videoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: wp('5%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(38, 183, 201, 0.25)',
  },
  videoThumbnailContainer: {
    position: 'relative',
    height: hp('18%'),
    backgroundColor: '#F0FDFA',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderIconContainer: {
    width: 56,
    height: 56,
    borderRadius: wp('7%'),
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp('1%'),
  },
  placeholderText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: '80%',
  },
  videoGradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  videoPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayButton: {
    width: 44,
    height: 44,
    borderRadius: wp('5.5%'),
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  videoStats: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    gap: wp('1.5%'),
  },
  videoStat: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: wp('2%'),
    paddingVertical: hp('0.5%'),
    borderRadius: wp('3%'),
    gap: wp('1%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  videoStatText: {
    color: '#1F2937',
    fontSize: 11,
    fontWeight: '700',
  },
  videoInfo: {
    padding: wp('3.5%'),
    borderTopWidth: 1,
    borderTopColor: 'rgba(38, 183, 201, 0.1)',
  },
  videoTitle: {
    fontSize: wp('3.8%'),
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: hp('0.7%'),
    lineHeight: 20,
  },
  videoDate: {
    fontSize: wp('3%'),
    color: '#26B7C9',
    fontWeight: '600',
  },
  emptyVideoState: {
    alignItems: 'center',
    paddingVertical: hp('7%'),
    paddingHorizontal: wp('10%'),
  },
  emptyVideoTitle: {
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: hp('2%'),
    marginBottom: hp('1%'),
  },
  emptyVideoSubtitle: {
    fontSize: wp('3.5%'),
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
  },
  requestVideoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#26B7C9',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.2%'),
    borderRadius: 999,
    gap: wp('2%'),
    marginTop: hp('2%'),
  },
  requestVideoText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: wp('3.5%'),
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('5%'),
    gap: wp('3%'),
  },
  loadingText: {
    fontSize: wp('3.5%'),
    color: '#8E8E93',
    fontWeight: '500',
  },

  exploreButtonText: {
    fontSize: wp('4.5%'),
    fontWeight: '700',
    color: '#ffffff',
    marginRight: 8,
  },
  
  // Video Modal Styles
  videoModalContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoModalClose: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 100,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: wp('5%'),
    padding: 8,
  },
  videoModalPlayer: {
    width: '100%',
    height: '60%',
  },
  videoModalInfo: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    padding: 20,
  },
  videoModalTitle: {
    fontSize: wp('4.5%'),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: hp('1%'),
  },
  videoModalDescription: {
    fontSize: wp('3.5%'),
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 20,
    marginBottom: hp('1.5%'),
  },
  videoModalStats: {
    flexDirection: 'row',
    gap: wp('5%'),
  },
  videoModalStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('1.5%'),
  },
  videoModalStatText: {
    fontSize: wp('3.5%'),
    color: '#FFFFFF',
    fontWeight: '500',
  },
  waitlistOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  waitlistCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: wp('4.5%'),
    padding: wp('5%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  waitlistTitle: {
    fontSize: wp('4.5%'),
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: hp('0.7%'),
  },
  waitlistSubtitle: {
    fontSize: wp('3.5%'),
    color: '#64748B',
    marginBottom: hp('2%'),
  },
  waitlistInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: wp('3%'),
    paddingHorizontal: wp('3.5%'),
    paddingVertical: hp('1.5%'),
    fontSize: wp('3.8%'),
    color: '#0F172A',
    marginBottom: hp('1.5%'),
  },
  waitlistActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: wp('3%'),
    marginTop: hp('0.7%'),
  },
  waitlistCancel: {
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('1.2%'),
  },
  waitlistCancelText: {
    color: '#64748B',
    fontWeight: '600',
  },
  waitlistSubmit: {
    backgroundColor: '#26B7C9',
    borderRadius: wp('3%'),
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.2%'),
  },
  waitlistSubmitText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});

export default CleanerProfileScreen; 