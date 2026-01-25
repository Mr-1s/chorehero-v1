/**
 * Liked Videos Screen
 * Shows all videos the user has liked
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { contentService } from '../../services/contentService';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

interface LikedVideo {
  id: string;
  content_post_id: string;
  created_at: string;
  content: {
    id: string;
    title: string;
    description: string;
    media_url: string;
    thumbnail_url?: string;
    view_count: number;
    like_count: number;
    user: {
      id: string;
      name: string;
      avatar_url: string;
    };
  };
}

const LikedVideosScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [likedVideos, setLikedVideos] = useState<LikedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadLikedVideos();
    }, [user?.id])
  );

  const loadLikedVideos = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('content_interactions')
        .select(`
          id,
          content_post_id,
          created_at,
          content:content_posts(
            id,
            title,
            description,
            media_url,
            thumbnail_url,
            view_count,
            like_count,
            user:users(id, name, avatar_url)
          )
        `)
        .eq('user_id', user.id)
        .eq('interaction_type', 'like')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter out any null content (deleted videos)
      const validVideos = (data || []).filter((item: any) => item.content !== null);
      setLikedVideos(validVideos);
    } catch (error) {
      console.error('Error loading liked videos:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadLikedVideos();
  };

  const handleUnlike = async (interactionId: string, contentId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Optimistic update
    setLikedVideos(prev => prev.filter(v => v.id !== interactionId));
    
    try {
      const response = await contentService.toggleLike(contentId, user!.id);
      if (!response.success) {
        // Revert on error
        loadLikedVideos();
      }
    } catch (error) {
      // Revert on error
      loadLikedVideos();
      console.error('Error unliking video:', error);
    }
  };

  const handleVideoPress = (video: LikedVideo) => {
    navigation.navigate('VideoFeed', {
      source: 'liked',
      initialVideoId: video.content_post_id,
    });
  };

  const renderVideoCard = ({ item }: { item: LikedVideo }) => {
    const content = item.content;
    if (!content) return null;

    return (
      <TouchableOpacity
        style={styles.videoCard}
        onPress={() => handleVideoPress(item)}
        activeOpacity={0.9}
      >
        <View style={styles.thumbnailContainer}>
          {content.thumbnail_url ? (
            <Image
              source={{ uri: content.thumbnail_url }}
              style={styles.thumbnail}
            />
          ) : (
            <LinearGradient
              colors={['#FF2D55', '#FF6B8A', '#FF9CAD']}
              style={styles.thumbnailPlaceholder}
            >
              <Ionicons name="heart" size={32} color="#FFFFFF" />
            </LinearGradient>
          )}
          
          {/* Play button overlay */}
          <View style={styles.playOverlay}>
            <View style={styles.playButton}>
              <Ionicons name="play" size={20} color="#FFFFFF" />
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsOverlay}>
            <View style={styles.stat}>
              <Ionicons name="heart" size={12} color="#FF2D55" />
              <Text style={styles.statText}>{content.like_count || 0}</Text>
            </View>
          </View>

          {/* Unlike button */}
          <TouchableOpacity
            style={styles.unlikeButton}
            onPress={() => handleUnlike(item.id, item.content_post_id)}
          >
            <Ionicons name="heart" size={18} color="#FF2D55" />
          </TouchableOpacity>
        </View>

        <View style={styles.cardContent}>
          <Text style={styles.videoTitle} numberOfLines={2}>
            {content.title}
          </Text>
          <View style={styles.creatorRow}>
            <Image
              source={{ 
                uri: content.user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(content.user?.name || 'User')}&background=3ad3db&color=ffffff`
              }}
              style={styles.creatorAvatar}
            />
            <Text style={styles.creatorName} numberOfLines={1}>
              {content.user?.name || 'Unknown'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <Ionicons name="heart-outline" size={64} color="#D1D5DB" />
      </View>
      <Text style={styles.emptyTitle}>No Liked Videos</Text>
      <Text style={styles.emptySubtitle}>
        Videos you like will appear here.{'\n'}
        Tap the heart icon on any video to like it.
      </Text>
      <TouchableOpacity
        style={styles.browseButton}
        onPress={() => navigation.navigate('Feed')}
      >
        <Text style={styles.browseButtonText}>Browse Videos</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Liked Videos</Text>
        <View style={styles.headerRight}>
          <Text style={styles.countBadge}>{likedVideos.length}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF2D55" />
          <Text style={styles.loadingText}>Loading liked videos...</Text>
        </View>
      ) : (
        <FlatList
          data={likedVideos}
          renderItem={renderVideoCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#FF2D55"
            />
          }
          ListEmptyComponent={renderEmptyState}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFBFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  countBadge: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  videoCard: {
    width: CARD_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  thumbnailContainer: {
    width: '100%',
    height: CARD_WIDTH * 1.3,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  statsOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    gap: 8,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  unlikeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardContent: {
    padding: 12,
  },
  videoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    lineHeight: 18,
    marginBottom: 8,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  creatorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  creatorName: {
    flex: 1,
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  browseButton: {
    backgroundColor: '#FF2D55',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  browseButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default LikedVideosScreen;
