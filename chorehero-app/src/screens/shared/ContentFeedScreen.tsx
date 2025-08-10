import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
  TextInput,
  Modal,
  FlatList,
} from 'react-native';
import { Video } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../hooks/useAuth';
import { contentService } from '../../services/contentService';
import { COLORS } from '../../utils/constants';
import { ContentPost, ContentComment, FeedFilter } from '../../types/content';

const { width: screenWidth } = Dimensions.get('window');

type StackParamList = {
  ContentFeed: undefined;
  ContentCreation: undefined;
  CleanerProfile: { userId: string };
  UserProfile: { userId: string };
};

type ContentFeedNavigationProp = StackNavigationProp<StackParamList, 'ContentFeed'>;

interface ContentFeedProps {
  navigation: ContentFeedNavigationProp;
}

const ContentFeedScreen: React.FC<ContentFeedProps> = ({ navigation }) => {
  const { user, isCleaner, isCustomer } = useAuth();
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | undefined>();
  
  // Filter state
  const [activeFilter, setActiveFilter] = useState<'all' | 'following' | 'featured'>('all');
  const [contentTypeFilter, setContentTypeFilter] = useState<'all' | 'video' | 'image' | 'before_after'>('all');
  
  // Comment modal state
  const [selectedPost, setSelectedPost] = useState<ContentPost | null>(null);
  const [comments, setComments] = useState<ContentComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const videoRefs = useRef<{ [key: string]: Video }>({});

  useEffect(() => {
    loadFeed();
  }, [activeFilter, contentTypeFilter]);

  const loadFeed = async (refresh = false) => {
    if (!user) return;

    try {
      if (refresh) {
        setIsRefreshing(true);
        setCursor(undefined);
      } else if (!refresh && !cursor && posts.length > 0) {
        return; // Already loaded and no cursor for pagination
      }

      const filters: FeedFilter = {};
      
      if (activeFilter === 'following') {
        filters.following_only = true;
      } else if (activeFilter === 'featured') {
        filters.featured_only = true;
      }

      if (contentTypeFilter !== 'all') {
        filters.content_type = contentTypeFilter as any;
      }

      // Add timeout to prevent infinite loading
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Feed load timeout')), 5000)
      );

      const feedPromise = contentService.getFeed(
        {
          filters,
          sort_by: 'recent',
          limit: 10,
          cursor: refresh ? undefined : cursor
        },
        user.id
      );

      const response = await Promise.race([feedPromise, timeoutPromise]);

      if (response.success) {
        if (refresh) {
          setPosts(response.data.posts);
        } else {
          setPosts(prev => [...prev, ...response.data.posts]);
        }
        setHasMore(response.data.has_more);
        setCursor(response.data.next_cursor);
      }
    } catch (error) {
      console.error('Feed load error:', error);
      // Set empty state on error
      setPosts([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleLike = async (post: ContentPost) => {
    if (!user) return;

    try {
      // Optimistic update
      setPosts(prev => prev.map(p => {
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

      const response = await contentService.toggleLike(post.id, user.id);
      
      if (!response.success) {
        // Revert on failure
        setPosts(prev => prev.map(p => {
          if (p.id === post.id) {
            return {
              ...p,
              user_has_liked: post.user_has_liked,
              like_count: post.like_count
            };
          }
          return p;
        }));
      }
    } catch (error) {
      console.error('Like error:', error);
    }
  };

  const handleFollow = async (post: ContentPost) => {
    if (!user || !post.user) return;

    try {
      // Optimistic update
      setPosts(prev => prev.map(p => {
        if (p.user_id === post.user_id) {
          return {
            ...p,
            is_following_user: !p.is_following_user
          };
        }
        return p;
      }));

      const response = await contentService.toggleFollow(user.id, post.user_id);
      
      if (!response.success) {
        // Revert on failure
        setPosts(prev => prev.map(p => {
          if (p.user_id === post.user_id) {
            return {
              ...p,
              is_following_user: post.is_following_user
            };
          }
          return p;
        }));
      }
    } catch (error) {
      console.error('Follow error:', error);
    }
  };

  const handleViewComments = async (post: ContentPost) => {
    if (!user) return;

    try {
      setSelectedPost(post);
      const response = await contentService.getComments(post.id, user.id);
      
      if (response.success) {
        setComments(response.data.comments);
        setShowComments(true);
      }
    } catch (error) {
      console.error('Comments load error:', error);
    }
  };

  const handleAddComment = async () => {
    if (!user || !selectedPost || !newComment.trim()) return;

    try {
      setIsPostingComment(true);
      
      const response = await contentService.addComment(
        selectedPost.id,
        user.id,
        newComment.trim()
      );

      if (response.success) {
        setComments(prev => [...prev, response.data]);
        setNewComment('');
        
        // Update comment count in posts
        setPosts(prev => prev.map(p => {
          if (p.id === selectedPost.id) {
            return { ...p, comment_count: p.comment_count + 1 };
          }
          return p;
        }));
      }
    } catch (error) {
      console.error('Comment post error:', error);
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleCommentLike = async (comment: ContentComment) => {
    if (!user) return;

    try {
      setComments(prev => prev.map(c => {
        if (c.id === comment.id) {
          const wasLiked = c.user_has_liked;
          return {
            ...c,
            user_has_liked: !wasLiked,
            like_count: wasLiked ? c.like_count - 1 : c.like_count + 1
          };
        }
        return c;
      }));

      await contentService.toggleCommentLike(comment.id, user.id);
    } catch (error) {
      console.error('Comment like error:', error);
    }
  };

  const recordView = async (post: ContentPost) => {
    if (!user) return;
    
    // Record view asynchronously
    contentService.recordView(post.id, user.id, 5); // 5 second view
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
    return `${Math.floor(diffInSeconds / 604800)}w`;
  };

  const renderPost = ({ item: post }: { item: ContentPost }) => (
    <View style={styles.postContainer}>
      {/* User Header */}
      <View style={styles.postHeader}>
        <TouchableOpacity 
          style={styles.userInfo}
          onPress={() => navigation.navigate('UserProfile', { userId: post.user_id })}
        >
          <Image 
            source={{ 
              uri: post.user?.avatar_url || 'https://via.placeholder.com/40x40.png?text=👤' 
            }} 
            style={styles.avatar} 
          />
          <View style={styles.userDetails}>
            <Text style={styles.username}>{post.user?.name || 'Unknown User'}</Text>
            <Text style={styles.timeAgo}>{formatTimeAgo(post.created_at)}</Text>
          </View>
        </TouchableOpacity>

        {post.user_id !== user?.id && (
          <TouchableOpacity 
            style={[
              styles.followButton,
              post.is_following_user && styles.followButtonActive
            ]}
            onPress={() => handleFollow(post)}
          >
            <Text style={[
              styles.followButtonText,
              post.is_following_user && styles.followButtonTextActive
            ]}>
              {post.is_following_user ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <View style={styles.contentContainer}>
        <Text style={styles.postTitle}>{post.title}</Text>
        {post.description && (
          <Text style={styles.postDescription}>{post.description}</Text>
        )}

        {/* Media */}
        <View style={styles.mediaContainer}>
          {post.content_type === 'video' ? (
            <Video
              ref={ref => {
                if (ref) videoRefs.current[post.id] = ref;
              }}
              source={{ uri: post.media_url }}
              style={styles.media}
              useNativeControls
              resizeMode="cover"
              shouldPlay={false}
              onPlaybackStatusUpdate={(status) => {
                if ('positionMillis' in status && status.positionMillis > 5000) {
                  recordView(post);
                }
              }}
            />
          ) : post.content_type === 'before_after' && post.secondary_media_url ? (
            <View style={styles.beforeAfterContainer}>
              <View style={styles.beforeAfterImage}>
                <Text style={styles.beforeAfterLabel}>Before</Text>
                <Image source={{ uri: post.media_url }} style={styles.media} />
              </View>
              <View style={styles.beforeAfterImage}>
                <Text style={styles.beforeAfterLabel}>After</Text>
                <Image source={{ uri: post.secondary_media_url }} style={styles.media} />
              </View>
            </View>
          ) : (
            <Image 
              source={{ uri: post.media_url }} 
              style={styles.media}
              onLoad={() => recordView(post)}
            />
          )}
        </View>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {post.tags.slice(0, 3).map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
            {post.tags.length > 3 && (
              <Text style={styles.moreTagsText}>+{post.tags.length - 3} more</Text>
            )}
          </View>
        )}

        {/* Location */}
        {post.location_name && (
          <View style={styles.locationContainer}>
            <Ionicons name="location-outline" size={14} color={COLORS.text.secondary} />
            <Text style={styles.locationText}>{post.location_name}</Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actionsContainer}>
        <View style={styles.leftActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleLike(post)}
          >
            <Ionicons 
              name={post.user_has_liked ? "heart" : "heart-outline"} 
              size={24} 
              color={post.user_has_liked ? COLORS.error : COLORS.text.secondary} 
            />
            <Text style={styles.actionText}>{post.like_count}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleViewComments(post)}
          >
            <Ionicons name="chatbubble-outline" size={24} color={COLORS.text.secondary} />
            <Text style={styles.actionText}>{post.comment_count}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="eye-outline" size={24} color={COLORS.text.secondary} />
            <Text style={styles.actionText}>{post.view_count}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="share-outline" size={24} color={COLORS.text.secondary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCommentModal = () => (
    <Modal
      visible={showComments}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.commentModal}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentHeaderTitle}>Comments</Text>
          <TouchableOpacity onPress={() => setShowComments(false)}>
            <Ionicons name="close" size={24} color={COLORS.text.primary} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          style={styles.commentsList}
          renderItem={({ item: comment }) => (
            <View style={styles.commentItem}>
              <Image 
                source={{ 
                  uri: comment.user?.avatar_url || 'https://via.placeholder.com/32x32.png?text=👤' 
                }} 
                style={styles.commentAvatar} 
              />
              <View style={styles.commentContent}>
                <View style={styles.commentInfo}>
                  <Text style={styles.commentUsername}>{comment.user?.name}</Text>
                  <Text style={styles.commentTime}>{formatTimeAgo(comment.created_at)}</Text>
                </View>
                <Text style={styles.commentText}>{comment.text}</Text>
                <TouchableOpacity 
                  style={styles.commentLikeButton}
                  onPress={() => handleCommentLike(comment)}
                >
                  <Ionicons 
                    name={comment.user_has_liked ? "heart" : "heart-outline"} 
                    size={16} 
                    color={comment.user_has_liked ? COLORS.error : COLORS.text.secondary} 
                  />
                  <Text style={styles.commentLikeText}>{comment.like_count}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />

        <View style={styles.commentInputContainer}>
          <TextInput
            style={styles.commentInput}
            placeholder="Add a comment..."
            value={newComment}
            onChangeText={setNewComment}
            multiline
            maxLength={500}
          />
          <TouchableOpacity 
            style={[
              styles.commentSendButton,
              (!newComment.trim() || isPostingComment) && styles.commentSendButtonDisabled
            ]}
            onPress={handleAddComment}
            disabled={!newComment.trim() || isPostingComment}
          >
            {isPostingComment ? (
              <ActivityIndicator size="small" color={COLORS.text.inverse} />
            ) : (
              <Ionicons name="send" size={20} color={COLORS.text.inverse} />
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );

  const renderFilters = () => (
    <View style={styles.filtersContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {/* Main filters */}
        {(['all', 'following', 'featured'] as const).map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterButton,
              activeFilter === filter && styles.filterButtonActive
            ]}
            onPress={() => setActiveFilter(filter)}
          >
            <Text style={[
              styles.filterButtonText,
              activeFilter === filter && styles.filterButtonTextActive
            ]}>
              {filter === 'all' ? 'All' : 
               filter === 'following' ? 'Following' : 'Featured'}
            </Text>
          </TouchableOpacity>
        ))}

        <View style={styles.filterDivider} />

        {/* Content type filters */}
        {(['all', 'video', 'image', 'before_after'] as const).map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.filterButton,
              contentTypeFilter === type && styles.filterButtonActive
            ]}
            onPress={() => setContentTypeFilter(type)}
          >
            <Text style={[
              styles.filterButtonText,
              contentTypeFilter === type && styles.filterButtonTextActive
            ]}>
              {type === 'all' ? 'All Types' :
               type === 'video' ? '🎥 Videos' :
               type === 'image' ? '📸 Photos' : '⚡ Before/After'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  if (isLoading && posts.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading content...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>ChoreHero Feed</Text>
        {isCleaner && (
          <TouchableOpacity 
            style={styles.createButton}
            onPress={() => navigation.navigate('ContentCreation')}
          >
            <Ionicons name="add" size={24} color={COLORS.text.inverse} />
          </TouchableOpacity>
        )}
      </View>

      {renderFilters()}

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadFeed(true)}
            tintColor={COLORS.primary}
          />
        }
        onEndReached={() => {
          if (hasMore && !isLoading) {
            loadFeed();
          }
        }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="camera-outline" size={64} color={COLORS.text.disabled} />
            <Text style={styles.emptyTitle}>No content yet</Text>
            <Text style={styles.emptySubtitle}>
              {activeFilter === 'following' 
                ? 'Follow some cleaners to see their content'
                : 'Check back later for new posts'}
            </Text>
          </View>
        }
        ListFooterComponent={
          hasMore && posts.length > 0 ? (
            <View style={styles.loadingFooter}>
              <ActivityIndicator color={COLORS.primary} />
            </View>
          ) : null
        }
      />

      {renderCommentModal()}
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
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  createButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: 8,
  },

  // Filters
  filtersContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text.secondary,
  },
  filterButtonTextActive: {
    color: COLORS.text.inverse,
  },
  filterDivider: {
    width: 1,
    height: 20,
    backgroundColor: COLORS.border,
    marginHorizontal: 8,
    alignSelf: 'center',
  },

  // Posts
  postContainer: {
    backgroundColor: COLORS.background,
    borderBottomWidth: 8,
    borderBottomColor: COLORS.surface,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  timeAgo: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  followButtonActive: {
    backgroundColor: COLORS.primary,
  },
  followButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  followButtonTextActive: {
    color: COLORS.text.inverse,
  },

  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  postDescription: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginBottom: 12,
    lineHeight: 20,
  },

  mediaContainer: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  media: {
    width: '100%',
    height: 300,
    resizeMode: 'cover',
  },
  beforeAfterContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  beforeAfterImage: {
    flex: 1,
  },
  beforeAfterLabel: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    color: COLORS.text.inverse,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '600',
    zIndex: 1,
  },

  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 8,
  },
  tag: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '500',
  },
  moreTagsText: {
    fontSize: 12,
    color: COLORS.text.secondary,
    fontStyle: 'italic',
  },

  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 12,
    color: COLORS.text.secondary,
  },

  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 14,
    color: COLORS.text.secondary,
    fontWeight: '500',
  },

  // Comment Modal
  commentModal: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  commentHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  commentsList: {
    flex: 1,
  },
  commentItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
  },
  commentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginRight: 8,
  },
  commentTime: {
    fontSize: 12,
    color: COLORS.text.secondary,
  },
  commentText: {
    fontSize: 14,
    color: COLORS.text.primary,
    lineHeight: 20,
    marginBottom: 8,
  },
  commentLikeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentLikeText: {
    fontSize: 12,
    color: COLORS.text.secondary,
  },

  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 12,
  },
  commentInput: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  commentSendButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: 10,
  },
  commentSendButtonDisabled: {
    backgroundColor: COLORS.text.disabled,
  },

  // Loading and Empty States
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
  loadingFooter: {
    padding: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.text.secondary,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

export default ContentFeedScreen; 