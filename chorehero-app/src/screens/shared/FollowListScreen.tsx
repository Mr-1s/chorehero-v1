/**
 * Follow List Screen
 * Shows followers or following list for a user
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { contentService } from '../../services/contentService';
import * as Haptics from 'expo-haptics';

interface FollowUser {
  id: string;
  user_id: string;
  name: string;
  avatar_url: string;
  bio?: string;
  role: string;
  is_following?: boolean;
  follower_count?: number;
}

type ListType = 'followers' | 'following';

const FollowListScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  
  const { userId, type = 'followers', userName } = route.params || {};
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ListType>(type);

  useFocusEffect(
    useCallback(() => {
      loadUsers();
    }, [userId, activeTab])
  );

  const loadUsers = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      let data: any[] = [];
      
      if (activeTab === 'followers') {
        // Get users who follow this user
        const { data: followers, error } = await supabase
          .from('user_follows')
          .select(`
            id,
            follower:users!user_follows_follower_id_fkey(
              id,
              name,
              avatar_url,
              bio,
              role
            )
          `)
          .eq('following_id', userId);

        if (error) throw error;
        
        data = (followers || [])
          .filter((f: any) => f.follower)
          .map((f: any) => ({
            id: f.id,
            user_id: f.follower.id,
            name: f.follower.name,
            avatar_url: f.follower.avatar_url,
            bio: f.follower.bio,
            role: f.follower.role,
          }));
      } else {
        // Get users this user follows
        const { data: following, error } = await supabase
          .from('user_follows')
          .select(`
            id,
            following:users!user_follows_following_id_fkey(
              id,
              name,
              avatar_url,
              bio,
              role
            )
          `)
          .eq('follower_id', userId);

        if (error) throw error;
        
        data = (following || [])
          .filter((f: any) => f.following)
          .map((f: any) => ({
            id: f.id,
            user_id: f.following.id,
            name: f.following.name,
            avatar_url: f.following.avatar_url,
            bio: f.following.bio,
            role: f.following.role,
          }));
      }

      // Check if current user follows each person
      if (user?.id && data.length > 0) {
        const userIds = data.map(u => u.user_id);
        const { data: myFollows } = await supabase
          .from('user_follows')
          .select('following_id')
          .eq('follower_id', user.id)
          .in('following_id', userIds);

        const followingSet = new Set(myFollows?.map(f => f.following_id) || []);
        
        data = data.map(u => ({
          ...u,
          is_following: followingSet.has(u.user_id),
        }));
      }

      setUsers(data);
    } catch (error) {
      console.error('Error loading follow list:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadUsers();
  };

  const handleToggleFollow = async (targetUserId: string, currentlyFollowing: boolean) => {
    if (!user?.id || user.id === targetUserId) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Optimistic update
    setUsers(prev => prev.map(u => 
      u.user_id === targetUserId 
        ? { ...u, is_following: !currentlyFollowing }
        : u
    ));
    
    try {
      const response = await contentService.toggleFollow(user.id, targetUserId);
      if (!response.success) {
        // Revert on failure
        setUsers(prev => prev.map(u => 
          u.user_id === targetUserId 
            ? { ...u, is_following: currentlyFollowing }
            : u
        ));
      }
    } catch (error) {
      // Revert on failure
      setUsers(prev => prev.map(u => 
        u.user_id === targetUserId 
          ? { ...u, is_following: currentlyFollowing }
          : u
      ));
      console.error('Error toggling follow:', error);
    }
  };

  const handleUserPress = (targetUser: FollowUser) => {
    if (targetUser.role === 'cleaner') {
      navigation.navigate('CleanerProfile', { cleanerId: targetUser.user_id });
    }
  };

  const renderUserCard = ({ item }: { item: FollowUser }) => {
    const isCurrentUser = user?.id === item.user_id;
    
    return (
      <TouchableOpacity
        style={styles.userCard}
        onPress={() => handleUserPress(item)}
        activeOpacity={0.8}
      >
        <Image
          source={{ 
            uri: item.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=3ad3db&color=ffffff`
          }}
          style={styles.avatar}
        />
        
        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.userName} numberOfLines={1}>{item.name}</Text>
            {item.role === 'cleaner' && (
              <View style={styles.cleanerBadge}>
                <Ionicons name="sparkles" size={10} color="#3AD3DB" />
                <Text style={styles.cleanerBadgeText}>Cleaner</Text>
              </View>
            )}
          </View>
          {item.bio && (
            <Text style={styles.userBio} numberOfLines={1}>{item.bio}</Text>
          )}
        </View>

        {!isCurrentUser && (
          <TouchableOpacity
            style={[
              styles.followButton,
              item.is_following && styles.followingButton
            ]}
            onPress={() => handleToggleFollow(item.user_id, item.is_following || false)}
          >
            <Text style={[
              styles.followButtonText,
              item.is_following && styles.followingButtonText
            ]}>
              {item.is_following ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <Ionicons 
          name={activeTab === 'followers' ? 'people-outline' : 'person-add-outline'} 
          size={64} 
          color="#D1D5DB" 
        />
      </View>
      <Text style={styles.emptyTitle}>
        {activeTab === 'followers' ? 'No Followers Yet' : 'Not Following Anyone'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {activeTab === 'followers' 
          ? 'When people follow this account, they\'ll appear here.'
          : 'When this account follows people, they\'ll appear here.'
        }
      </Text>
    </View>
  );

  const isOwnProfile = user?.id === userId;

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
        <Text style={styles.headerTitle}>
          {isOwnProfile ? 'My Connections' : userName || 'Connections'}
        </Text>
        <View style={styles.headerRight} />
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'followers' && styles.activeTab]}
          onPress={() => setActiveTab('followers')}
        >
          <Text style={[styles.tabText, activeTab === 'followers' && styles.activeTabText]}>
            Followers
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'following' && styles.activeTab]}
          onPress={() => setActiveTab('following')}
        >
          <Text style={[styles.tabText, activeTab === 'following' && styles.activeTabText]}>
            Following
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3AD3DB" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderUserCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
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
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#3AD3DB',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#3AD3DB',
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
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    flexShrink: 1,
  },
  cleanerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0F7F8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  cleanerBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#3AD3DB',
  },
  userBio: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  followButton: {
    backgroundColor: '#3AD3DB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  followingButton: {
    backgroundColor: '#F3F4F6',
  },
  followButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  followingButtonText: {
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default FollowListScreen;
