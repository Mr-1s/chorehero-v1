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
  Alert,
  FlatList,
  Dimensions,
} from 'react-native';
import { Video } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { contentService } from '../../services/contentService';
import { COLORS } from '../../utils/constants';
import { ContentPost, UserProfileResponse } from '../../types/content';

const { width: screenWidth } = Dimensions.get('window');

type StackParamList = {
  UserProfile: { userId: string };
  ContentFeed: undefined;
  BookingFlow: { cleanerId: string };
};

type UserProfileNavigationProp = StackNavigationProp<StackParamList, 'UserProfile'>;
type UserProfileRouteProp = RouteProp<StackParamList, 'UserProfile'>;

interface UserProfileProps {
  navigation: UserProfileNavigationProp;
  route: UserProfileRouteProp;
}

const UserProfileScreen: React.FC<UserProfileProps> = ({ navigation, route }) => {
  const { userId } = route.params;
  const { user: currentUser, isCustomer } = useAuth();
  
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [userPosts, setUserPosts] = useState<ContentPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isTogglingFollow, setIsTogglingFollow] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'posts' | 'info'>('posts');

  useEffect(() => {
    loadUserProfile();
    loadUserPosts();
  }, [userId]);

  const loadUserProfile = async () => {
    if (!currentUser) return;

    try {
      // For now, we'll create a mock profile. In production, you'd have a getUserProfile service
      const mockProfile: UserProfileResponse = {
        user: {
          id: userId,
          name: 'Sarah Johnson',
          avatar_url: 'https://via.placeholder.com/120x120.png?text=👤',
          role: 'cleaner' as const,
          created_at: '2023-01-15T00:00:00Z'
        },
        cleaner_profile: {
          rating_average: 4.8,
          total_jobs: 142,
          specialties: ['Deep Cleaning', 'Move-in/Move-out', 'Eco-friendly'],
          bio: 'Professional cleaner with 5+ years of experience. I specialize in deep cleaning and organization. Committed to using eco-friendly products and providing exceptional service.',
          years_experience: 5
        },
        stats: {
          posts_count: 24,
          followers_count: 1280,
          following_count: 45,
          total_likes: 3420,
          total_views: 18500
        },
        recent_posts: [],
        is_following: false
      };

      // Check follow status
      const followResult = await contentService.checkFollowStatus(currentUser.id, userId);
      if (followResult.success) {
        mockProfile.is_following = followResult.data;
        setIsFollowing(followResult.data);
      }

      setProfile(mockProfile);
    } catch (error) {
      console.error('Profile load error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserPosts = async () => {
    if (!currentUser) return;

    try {
      const response = await contentService.getFeed(
        {
          filters: { user_id: userId },
          sort_by: 'recent',
          limit: 20
        },
        currentUser.id
      );

      if (response.success) {
        setUserPosts(response.data.posts);
      }
    } catch (error) {
      console.error('Posts load error:', error);
    }
  };

  const handleFollow = async () => {
    if (!currentUser || !profile) return;

    try {
      setIsTogglingFollow(true);
      
      const response = await contentService.toggleFollow(currentUser.id, userId);
      
      if (response.success) {
        const newFollowState = response.data;
        setIsFollowing(newFollowState);
        
        // Update profile stats
        setProfile(prev => prev ? {
          ...prev,
          stats: {
            ...prev.stats,
            followers_count: newFollowState 
              ? prev.stats.followers_count + 1 
              : prev.stats.followers_count - 1
          },
          is_following: newFollowState
        } : null);
      }
    } catch (error) {
      console.error('Follow error:', error);
      Alert.alert('Error', 'Failed to update follow status');
    } finally {
      setIsTogglingFollow(false);
    }
  };

  const handleBookService = () => {
    if (profile?.user.role === 'cleaner') {
      navigation.navigate('BookingFlow', { cleanerId: userId });
    }
  };

  const handleLike = async (post: ContentPost) => {
    if (!currentUser) return;

    try {
      setUserPosts(prev => prev.map(p => {
        if (p.id === post.id) {
          const wasLiked = p.user_has_liked;
          return {
            ...p,
            user_has_liked: !wasLiked,
            like_count: wasLiked ? p.like_count - 1 : p.like_count + 1
          };
        }
        return p;
      }));

      await contentService.toggleLike(post.id, currentUser.id);
    } catch (error) {
      console.error('Like error:', error);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const renderPost = ({ item: post }: { item: ContentPost }) => (
    <TouchableOpacity 
      style={styles.postItem}
      activeOpacity={0.8}
    >
      <View style={styles.postThumbnail}>
        {post.content_type === 'video' ? (
          <>
            <Image 
              source={{ uri: post.thumbnail_url || post.media_url }} 
              style={styles.postImage} 
            />
            <View style={styles.videoOverlay}>
              <Ionicons name="play" size={20} color={COLORS.text.inverse} />
            </View>
          </>
        ) : (
          <Image 
            source={{ uri: post.media_url }} 
            style={styles.postImage} 
          />
        )}
      </View>
      
      <View style={styles.postInfo}>
        <Text style={styles.postTitle} numberOfLines={2}>{post.title}</Text>
        <View style={styles.postStats}>
          <View style={styles.postStat}>
            <Ionicons name="heart" size={12} color={COLORS.error} />
            <Text style={styles.postStatText}>{post.like_count}</Text>
          </View>
          <View style={styles.postStat}>
            <Ionicons name="eye" size={12} color={COLORS.text.secondary} />
            <Text style={styles.postStatText}>{post.view_count}</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.postLikeButton}
        onPress={() => handleLike(post)}
      >
        <Ionicons 
          name={post.user_has_liked ? "heart" : "heart-outline"} 
          size={16} 
          color={post.user_has_liked ? COLORS.error : COLORS.text.secondary} 
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.errorContainer}>
          <Ionicons name="person-outline" size={64} color={COLORS.text.disabled} />
          <Text style={styles.errorTitle}>Profile not found</Text>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{profile.user.name}</Text>
        <TouchableOpacity>
          <Ionicons name="share-outline" size={24} color={COLORS.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <Image 
            source={{ uri: profile.user.avatar_url }} 
            style={styles.profileAvatar} 
          />
          
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile.user.name}</Text>
            {profile.cleaner_profile && (
              <>
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={16} color="#FFD700" />
                  <Text style={styles.ratingText}>
                    {profile.cleaner_profile.rating_average.toFixed(1)}
                  </Text>
                  <Text style={styles.jobsText}>
                    • {profile.cleaner_profile.total_jobs} jobs completed
                  </Text>
                </View>
                
                <View style={styles.specialtiesContainer}>
                  {profile.cleaner_profile.specialties.map((specialty, index) => (
                    <View key={index} style={styles.specialtyTag}>
                      <Text style={styles.specialtyText}>{specialty}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{formatNumber(profile.stats.posts_count)}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{formatNumber(profile.stats.followers_count)}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{formatNumber(profile.stats.total_likes)}</Text>
            <Text style={styles.statLabel}>Likes</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{formatNumber(profile.stats.total_views)}</Text>
            <Text style={styles.statLabel}>Views</Text>
          </View>
        </View>

        {/* Action Buttons */}
        {currentUser?.id !== userId && (
          <View style={styles.actionButtons}>
            {isCustomer && profile.user.role === 'cleaner' && (
              <TouchableOpacity 
                style={styles.bookButton}
                onPress={handleBookService}
              >
                <Text style={styles.bookButtonText}>Book Service</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={[
                styles.followButton,
                isFollowing && styles.followButtonActive
              ]}
              onPress={handleFollow}
              disabled={isTogglingFollow}
            >
              {isTogglingFollow ? (
                <ActivityIndicator size="small" color={COLORS.text.inverse} />
              ) : (
                <Text style={[
                  styles.followButtonText,
                  isFollowing && styles.followButtonTextActive
                ]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[
              styles.tabButton,
              selectedTab === 'posts' && styles.tabButtonActive
            ]}
            onPress={() => setSelectedTab('posts')}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons 
              name="grid-outline" 
              size={20} 
              color={selectedTab === 'posts' ? COLORS.primary : COLORS.text.secondary} 
            />
            <Text style={[
              styles.tabButtonText,
              selectedTab === 'posts' && styles.tabButtonTextActive
            ]}>
              Posts
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.tabButton,
              selectedTab === 'info' && styles.tabButtonActive
            ]}
            onPress={() => setSelectedTab('info')}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons 
              name="information-circle-outline" 
              size={20} 
              color={selectedTab === 'info' ? COLORS.primary : COLORS.text.secondary} 
            />
            <Text style={[
              styles.tabButtonText,
              selectedTab === 'info' && styles.tabButtonTextActive
            ]}>
              About
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {selectedTab === 'posts' ? (
          <View style={styles.postsContainer}>
            {userPosts.length > 0 ? (
              <FlatList
                data={userPosts}
                renderItem={renderPost}
                keyExtractor={(item) => item.id}
                numColumns={2}
                columnWrapperStyle={styles.postsRow}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View style={styles.emptyPostsContainer}>
                <Ionicons name="camera-outline" size={48} color={COLORS.text.disabled} />
                <Text style={styles.emptyPostsTitle}>No posts yet</Text>
                <Text style={styles.emptyPostsSubtitle}>
                  This user hasn't shared any content
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.infoContainer}>
            {profile.cleaner_profile?.bio && (
              <View style={styles.bioSection}>
                <Text style={styles.sectionTitle}>About</Text>
                <Text style={styles.bioText}>{profile.cleaner_profile.bio}</Text>
              </View>
            )}

            {profile.cleaner_profile && (
              <View style={styles.experienceSection}>
                <Text style={styles.sectionTitle}>Experience</Text>
                <View style={styles.experienceItem}>
                  <Ionicons name="time-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.experienceText}>
                    {profile.cleaner_profile.years_experience} years of professional experience
                  </Text>
                </View>
                <View style={styles.experienceItem}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.success} />
                  <Text style={styles.experienceText}>
                    {profile.cleaner_profile.total_jobs} cleaning jobs completed
                  </Text>
                </View>
                <View style={styles.experienceItem}>
                  <Ionicons name="star-outline" size={20} color="#FFD700" />
                  <Text style={styles.experienceText}>
                    {profile.cleaner_profile.rating_average.toFixed(1)} average rating
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.joinedSection}>
              <Text style={styles.sectionTitle}>Joined ChoreHero</Text>
              <Text style={styles.joinedText}>
                {new Date(profile.user.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long'
                })}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.primary,
  },

  // Profile Header
  profileHeader: {
    flexDirection: 'row',
    padding: 20,
    alignItems: 'flex-start',
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginLeft: 4,
  },
  jobsText: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginLeft: 4,
  },
  specialtiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  specialtyTag: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  specialtyText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '500',
  },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.text.secondary,
  },

  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  bookButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  bookButtonText: {
    color: COLORS.text.inverse,
    fontSize: 14,
    fontWeight: '600',
  },
  followButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  followButtonActive: {
    backgroundColor: COLORS.primary,
  },
  followButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  followButtonTextActive: {
    color: COLORS.text.inverse,
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 12,
    gap: 6,
    minHeight: 52, // Ensure adequate touch target
  },
  tabButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text.secondary,
  },
  tabButtonTextActive: {
    color: COLORS.primary,
  },

  // Posts Grid
  postsContainer: {
    padding: 20,
  },
  postsRow: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  postItem: {
    width: (screenWidth - 52) / 2, // Account for padding and gap
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  postThumbnail: {
    position: 'relative',
  },
  postImage: {
    width: '100%',
    height: 120,
    resizeMode: 'cover',
  },
  videoOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 4,
  },
  postInfo: {
    padding: 12,
  },
  postTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 8,
    lineHeight: 18,
  },
  postStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  postStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  postStatText: {
    fontSize: 12,
    color: COLORS.text.secondary,
  },
  postLikeButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  // Empty Posts
  emptyPostsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyPostsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  emptyPostsSubtitle: {
    fontSize: 14,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },

  // Info Tab
  infoContainer: {
    padding: 20,
    gap: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 12,
  },
  bioSection: {},
  bioText: {
    fontSize: 14,
    color: COLORS.text.secondary,
    lineHeight: 20,
  },
  experienceSection: {},
  experienceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  experienceText: {
    fontSize: 14,
    color: COLORS.text.secondary,
    flex: 1,
  },
  joinedSection: {},
  joinedText: {
    fontSize: 14,
    color: COLORS.text.secondary,
  },

  // Loading and Error States
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.text.secondary,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  backButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: COLORS.text.inverse,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default UserProfileScreen; 