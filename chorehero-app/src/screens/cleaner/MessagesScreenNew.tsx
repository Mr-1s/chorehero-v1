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
import { SkeletonList } from '../../components/Skeleton';

// Theme
import { cleanerTheme } from '../../utils/theme';

// Types
import type { Conversation } from '../../types/cleaner';
import { wp, hp } from '../../utils/responsive';

const { colors, spacing } = cleanerTheme;

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
          activeOpacity={0.82}
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
    paddingHorizontal: wp('6%'),
    paddingTop: hp('1.8%'),
    paddingBottom: hp('1.2%'),
  },
  headerTitle: {
    fontSize: wp('7%'),
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: -0.5,
  },
  headerBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: wp('3.5%'),
    paddingVertical: hp('0.7%'),
    borderRadius: wp('5%'),
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  headerBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    marginHorizontal: wp('5%'),
    marginBottom: hp('1.2%'),
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.25%'),
    borderRadius: 14,
    gap: wp('2.5%'),
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    fontSize: wp('4%'),
    color: '#1F2937',
    letterSpacing: -0.2,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 130, // Account for bottom nav
    paddingTop: hp('0.5%'),
  },
  loadingContainer: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  conversationWrapper: {
    marginBottom: hp('1%'),
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    paddingVertical: hp('1.6%'),
    paddingHorizontal: wp('3.8%'),
    gap: wp('3%'),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  conversationCardUnread: {
    backgroundColor: '#FFFBF5', // Warm highlight for unread
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
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
    backgroundColor: '#F3F4F6',
  },
  conversationContent: {
    flex: 1,
    gap: wp('1%'),
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    marginRight: 8,
    letterSpacing: -0.3,
  },
  participantNameUnread: {
    fontWeight: '700',
    color: '#111827',
  },
  timestamp: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  messagePreview: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 18,
    letterSpacing: -0.2,
  },
  messagePreviewUnread: {
    color: '#374151',
    fontWeight: '600',
  },
  unreadBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: wp('2%'),
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  unreadCount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textInverse,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('10%'),
  },
  emptyIconContainer: {
    width: 88,
    height: 88,
    borderRadius: wp('11%'),
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp('2.5%'),
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyTitle: {
    fontSize: wp('5%'),
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: hp('1%'),
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: wp('12%'),
    lineHeight: 22,
  },
});

export default MessagesScreenNew;

