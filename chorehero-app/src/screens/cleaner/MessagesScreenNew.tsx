/**
 * MessagesScreen - Cleaner-side messages with orange theme
 * 
 * Features:
 * - Clean white cards with soft shadows
 * - Orange unread badges (not teal)
 * - Pull-to-refresh
 * - Tap to open conversation
 */

import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  FlatList,
  RefreshControl,
  Image,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import type { StackNavigationProp } from '@react-navigation/stack';

// Store
import { useCleanerStore, selectTotalUnreadMessages } from '../../store/cleanerStore';

// Components
import { PressableScale } from '../../components/cleaner';
import CleanerFloatingNavigation from '../../components/CleanerFloatingNavigation';
import { SkeletonList } from '../../components/Skeleton';

// Theme
import { cleanerTheme } from '../../utils/theme';

// Types
import type { Conversation } from '../../types/cleaner';

const { colors, typography, spacing, radii, shadows } = cleanerTheme;

type StackParamList = {
  Messages: undefined;
  ConversationDetail: { conversationId: string; participantName: string };
};

type MessagesScreenProps = {
  navigation: StackNavigationProp<StackParamList, 'Messages'>;
};

const formatTime = (isoString: string): string => {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const MessagesScreenNew: React.FC<MessagesScreenProps> = ({ navigation }) => {
  // Store state
  const {
    conversations,
    isLoading,
    isRefreshing,
    fetchDashboard,
    markConversationRead,
    refreshData,
  } = useCleanerStore();

  const totalUnread = useCleanerStore(selectTotalUnreadMessages);

  // Local state
  const [searchQuery, setSearchQuery] = React.useState('');

  useEffect(() => {
    fetchDashboard();
  }, []);

  // Filter conversations by search
  const filteredConversations = conversations.filter(conv =>
    conv.participantName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle conversation press
  const handleConversationPress = useCallback((conversation: Conversation) => {
    // Mark as read
    if (conversation.unreadCount > 0) {
      markConversationRead(conversation.id);
    }
    
    // Navigate to detail
    navigation.navigate('ConversationDetail', {
      conversationId: conversation.id,
      participantName: conversation.participantName,
    });
  }, [navigation, markConversationRead]);

  // Render conversation card
  const renderConversation = ({ item, index }: { item: Conversation; index: number }) => {
    const hasUnread = item.unreadCount > 0;
    
    return (
      <Animated.View entering={FadeInUp.delay(index * 50).duration(300)}>
        <PressableScale
          onPress={() => handleConversationPress(item)}
          style={styles.conversationWrapper}
        >
          <View style={[styles.conversationCard, hasUnread && styles.conversationCardUnread]}>
            {/* Avatar */}
            <View style={styles.avatarContainer}>
              {item.participantAvatarUrl ? (
                <Image
                  source={{ uri: item.participantAvatarUrl }}
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Ionicons name="person" size={24} color={colors.textMuted} />
                </View>
              )}
            </View>

            {/* Content */}
            <View style={styles.conversationContent}>
              <View style={styles.conversationHeader}>
                <Text 
                  style={[styles.participantName, hasUnread && styles.participantNameUnread]}
                  numberOfLines={1}
                >
                  {item.participantName}
                </Text>
                <Text style={styles.timestamp}>{formatTime(item.lastMessageTime)}</Text>
              </View>
              <Text 
                style={[styles.messagePreview, hasUnread && styles.messagePreviewUnread]}
                numberOfLines={1}
              >
                {item.lastMessagePreview}
              </Text>
            </View>

            {/* Unread badge */}
            {hasUnread && (
              <Animated.View entering={FadeIn.duration(200)} style={styles.unreadBadge}>
                <Text style={styles.unreadCount}>
                  {item.unreadCount > 9 ? '9+' : item.unreadCount}
                </Text>
              </Animated.View>
            )}
          </View>
        </PressableScale>
      </Animated.View>
    );
  };

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>No messages yet</Text>
      <Text style={styles.emptySubtitle}>
        Your conversations with customers will appear here
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        {totalUnread > 0 && (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{totalUnread} new</Text>
          </View>
        )}
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <PressableScale onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </PressableScale>
        )}
      </View>

      {/* Conversations List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <SkeletonList count={5} />
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversation}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refreshData}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}

      {/* Bottom Navigation */}
      <CleanerFloatingNavigation
        navigation={navigation as any}
        currentScreen="Messages"
        unreadCount={totalUnread}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
    color: colors.textPrimary,
  },
  headerBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  headerBadgeText: {
    fontSize: typography.labelSmall.fontSize,
    fontWeight: typography.label.fontWeight,
    color: colors.textInverse,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    gap: spacing.sm,
    ...shadows.soft,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.body.fontSize,
    color: colors.textPrimary,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 120, // Account for bottom nav
  },
  loadingContainer: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  conversationWrapper: {
    marginBottom: spacing.md,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.soft,
  },
  conversationCardUnread: {
    backgroundColor: colors.cardBg,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.metaBg,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  participantName: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: '500',
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  participantNameUnread: {
    fontWeight: '600',
  },
  timestamp: {
    fontSize: typography.labelSmall.fontSize,
    color: colors.textMuted,
  },
  messagePreview: {
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
  },
  messagePreviewUnread: {
    color: colors.textPrimary,
    fontWeight: '500',
  },
  unreadBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadCount: {
    fontSize: typography.labelSmall.fontSize,
    fontWeight: '600',
    color: colors.textInverse,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl * 2,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.metaBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: typography.sectionHeading.fontSize,
    fontWeight: typography.sectionHeading.fontWeight,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xxxl,
  },
});

export default MessagesScreenNew;

