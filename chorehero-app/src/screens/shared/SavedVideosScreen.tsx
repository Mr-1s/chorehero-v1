/**
 * Saved Videos Screen
 * Shows all videos the user has bookmarked
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
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

interface SavedVideo {
  id: string;
  content_id: string;
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

const SavedVideosScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [savedVideos, setSavedVideos] = useState<SavedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadSavedVideos();
    }, [user?.id])
  );

  const loadSavedVideos = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('saved_content')
        .select(`
          id,
          content_id,
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
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter out any null content (deleted videos)
      const validVideos = (data || []).filter((item: any) => item.content !== null);
      setSavedVideos(validVideos);
    } catch (error) {
      console.error('Error loading saved videos:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadSavedVideos();
  };

  const handleUnsave = async (savedId: string, contentId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Optimistic update
    setSavedVideos(prev => prev.filter(v => v.id !== savedId));
    
    try {
      const { error } = await supabase
        .from('saved_content')
        .delete()
        .eq('id', savedId);

      if (error) throw error;
    } catch (error) {
      // Revert on error
      loadSavedVideos();
      console.error('Error unsaving video:', error);
    }
  };

  const handleVideoPress = (video: SavedVideo) => {
    navigation.navigate('VideoFeed', {
      source: 'saved',
      initialVideoId: video.content_id,
    });
  };

  const renderVideoCard = ({ item }: { item: SavedVideo }) => {
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
              colors={['#0891b2', '#06b6d4', '#22d3ee']}
              style={styles.thumbnailPlaceholder}
            >
              <Ionicons name="videocam" size={32} color="#FFFFFF" />
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
              <Ionicons name="eye" size={12} color="#FFFFFF" />
              <Text style={styles.statText}>{content.view_count || 0}</Text>
            </View>
          </View>

          {/* Unsave button */}
          <TouchableOpacity
            style={styles.unsaveButton}
            onPress={() => handleUnsave(item.id, item.content_id)}
          >
            <Ionicons name="bookmark" size={18} color="#3AD3DB" />
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
        <Ionicons name="bookmark-outline" size={64} color="#D1D5DB" />
      </View>
      <Text style={styles.emptyTitle}>No Saved Videos</Text>
      <Text style={styles.emptySubtitle}>
        Videos you save will appear here.{'\n'}
        Tap the bookmark icon on any video to save it.
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
        <Text style={styles.headerTitle}>Saved Videos</Text>
        <View style={styles.headerRight}>
          <Text style={styles.countBadge}>{savedVideos.length}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3AD3DB" />
          <Text style={styles.loadingText}>Loading saved videos...</Text>
        </View>
      ) : (
        <FlatList
          data={savedVideos}
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
              tintColor="#3AD3DB"
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
  unsaveButton: {
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
    backgroundColor: '#F3F4F6',
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
    backgroundColor: '#3AD3DB',
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

export default SavedVideosScreen;
