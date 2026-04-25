import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Image,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import { EmptyState, EmptyStateConfigs } from '../../components/EmptyState';

import { useMessages, type Conversation } from '../../context/MessageContext';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabase';
import { getConversationId } from '../../utils/conversationId';
import { wp, hp } from '../../utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getMainTabBarChromeHeight } from '../../navigation/mainTabsChromeLayout';

// Navigation types
type StackParamList = {
  MessagesScreen: undefined;
  ChatScreen: { bookingId: string; otherParticipant: any };
  MainTabs: undefined;
};

type MessagesScreenProps = {
  navigation: StackNavigationProp<StackParamList, 'MessagesScreen'>;
};

// Conversation interface now imported from context

const MessagesScreen: React.FC<MessagesScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const findCleanersButtonBottom = getMainTabBarChromeHeight(insets.bottom) + 12;
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const { conversations, setConversations, setUnreadCount } = useMessages();
  const { user } = useAuth();

  const loadConversations = useCallback(async () => {
    setIsLoading(true);
    try {
      // Check if user is authenticated and not a demo user
      const isRealUser = user && !user.id.startsWith('demo_');
      
      if (isRealUser) {
        console.log('📱 Loading real conversations for user:', user.name);
        
        // Load real conversations from Supabase using chat_threads table
        const { data: chatThreads, error } = await supabase
          .from('chat_threads')
          .select(`
            id,
            conversation_id,
            customer_id,
            cleaner_id,
            booking_id,
            last_message_at,
            messages:chat_messages(
              content,
              created_at,
              sender_id,
              is_read
            )
          `)
          .or(`customer_id.eq.${user.id},cleaner_id.eq.${user.id}`)
          .order('last_message_at', { ascending: false });

        if (error) {
          console.error('❌ Error loading chat threads:', error);
          throw error;
        }

        if (chatThreads && chatThreads.length > 0) {
          const activeStatuses = ['confirmed', 'cleaner_en_route', 'cleaner_arrived', 'in_progress'];
          const { data: activeBookings } = await supabase
            .from('bookings')
            .select('id, cleaner_id, status')
            .eq('customer_id', user.id)
            .in('status', activeStatuses);

          const activeBookingMap = new Map<string, string>();
          (activeBookings || []).forEach((booking: any) => {
            if (booking.cleaner_id) {
              activeBookingMap.set(booking.cleaner_id, booking.id);
            }
          });

          const groupedThreads = new Map<string, any>();
          chatThreads.forEach((thread: any) => {
            const conversationId = thread.conversation_id || getConversationId(thread.customer_id, thread.cleaner_id);
            const existing = groupedThreads.get(conversationId);
            if (!existing) {
              groupedThreads.set(conversationId, thread);
              return;
            }
            const existingLast = existing.last_message_at || '';
            const nextLast = thread.last_message_at || '';
            if (nextLast > existingLast) {
              groupedThreads.set(conversationId, thread);
            }
          });

          // Transform chat threads to conversations
          const realConversations: Conversation[] = await Promise.all(
            Array.from(groupedThreads.values()).map(async (thread) => {
              // Find the other participant (if user is customer, get cleaner and vice versa)
              const otherParticipantId = thread.customer_id === user.id 
                ? thread.cleaner_id 
                : thread.customer_id;
              
              // Get other participant's details
              const { data: otherUser } = await supabase
                .from('users')
                .select('id, name, avatar_url, role')
                .eq('id', otherParticipantId)
                .single();

              // Count unread messages
              const unreadCount = thread.messages?.filter((msg: any) => 
                msg.sender_id !== user.id && !msg.is_read
              ).length || 0;

              // Get the last message content
              const lastMsg = thread.messages?.sort((a: any, b: any) => 
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              )[0];
              
              const lastMessage = lastMsg?.content || 'No messages yet';
              const lastTimestamp = thread.last_message_at 
                ? new Date(thread.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '';

              const conversationId = thread.conversation_id || getConversationId(thread.customer_id, thread.cleaner_id);
              const activeBookingId = activeBookingMap.get(otherParticipantId) || null;

              return {
                id: thread.id,
                conversationId,
                participant: {
                  id: otherUser?.id || otherParticipantId,
                  name: otherUser?.name || 'Unknown User',
                  avatar: otherUser?.avatar_url || 'https://via.placeholder.com/50',
                  role: otherUser?.role || 'customer' as const,
                },
                lastMessage,
                lastTimestamp,
                unreadCount,
                bookingId: thread.booking_id || thread.id,
                activeBookingId,
                hasActiveJob: Boolean(activeBookingId),
              };
            })
          );

          setConversations(realConversations);
          
          // Calculate total unread count
          const totalUnread = realConversations.reduce((sum, conv) => sum + conv.unreadCount, 0);
          setUnreadCount(totalUnread);
        } else {
          // No real conversations, show appropriate message
          setConversations([]);
          setUnreadCount(0);
        }
      } else {
        // No authenticated user - show empty state
        console.log('📱 No authenticated user - showing empty state');
        setConversations([]);
        setUnreadCount(0);
      }
    } catch (error) {
      const msg = (error as any)?.message ?? '';
      const is502OrHtml = typeof msg === 'string' && (
        msg.includes('<!DOCTYPE') || msg.includes('502') || msg.includes('Bad gateway')
      );
      if (is502OrHtml) {
        console.warn('❌ Supabase temporarily unavailable (502 Bad Gateway)');
        Alert.alert(
          'Service Unavailable',
          'Messages are temporarily unavailable. Please try again in a few minutes.',
          [{ text: 'OK' }, { text: 'Retry', onPress: loadConversations }]
        );
      } else {
        console.error('❌ Error loading conversations:', error);
        Alert.alert('Error', 'Failed to load messages');
      }
      // Fallback to empty state
      setConversations([]);
      setUnreadCount(0);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [user, setConversations, setUnreadCount]);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations])
  );

  useEffect(() => {
    if (!user?.id || String(user.id).startsWith('demo_')) return;
    loadConversations();
  }, [user?.id, loadConversations]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadConversations();
  }, [loadConversations]);

  const filteredConversations = conversations.filter(c =>
    c.participant.name.toLowerCase().includes(search.toLowerCase())
  );

  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={styles.conversationCard}
      activeOpacity={0.82}
      onPress={() => navigation.navigate('IndividualChat', {
        bookingId: item.activeBookingId || item.bookingId,
        roomId: item.id,
        otherParticipant: {
          id: item.participant.id,
          name: item.participant.name,
          avatar_url: item.participant.avatar,
          role: item.participant.role,
        },
      })}
    >
      <Image source={{ uri: item.participant.avatar }} style={styles.avatar} />
      <View style={styles.conversationInfo}>
        <View style={styles.conversationHeader}>
          <View style={styles.nameRow}>
            <Text style={styles.participantName} numberOfLines={1}>{item.participant.name}</Text>
            {item.hasActiveJob && (
              <View style={styles.activeJobBadge}>
                <Text style={styles.activeJobText}>Active Job</Text>
              </View>
            )}
          </View>
          <View style={styles.rightSection}>
            <Text style={styles.timestamp}>{item.lastTimestamp}</Text>
            {item.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{item.unreadCount > 9 ? '9+' : item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.lastMessage}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={{ width: 44 }} />
      </View>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#6B7280" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name..."
        />
      </View>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#26B7C9" />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      ) : filteredConversations.length === 0 ? (
        <EmptyState
          {...EmptyStateConfigs.conversations}
          showFeatures={true}
          actions={[]}
        />
      ) : (
        <FlatList
          data={filteredConversations}
          renderItem={renderConversation}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#26B7C9" />
          }
        />
      )}
      
      {/* Fixed Find Cleaners Button - Only show when empty */}
      {filteredConversations.length === 0 && !isLoading && (
        <View style={[styles.fixedBottomButton, { bottom: findCleanersButtonBottom }]}>
          <TouchableOpacity 
            style={styles.findCleanersButton}
            onPress={() => {
              const routes = (navigation as any)?.getState?.()?.routeNames || [];
              if (routes.includes('Discover')) {
                navigation.navigate('Discover' as any);
                return;
              }
              if (routes.includes('MainTabs')) {
                navigation.navigate('MainTabs' as any, { screen: 'Discover' });
                return;
              }
              navigation.navigate('MainTabs' as any);
            }}
          >
            <Ionicons name="people" size={20} color="#ffffff" />
            <Text style={styles.findCleanersButtonText}>Find Cleaners</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('2%'),
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: wp('5.5%'),
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: '#1F2937',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    marginHorizontal: wp('5%'),
    marginBottom: hp('1.2%'),
    marginTop: hp('1%'),
    borderRadius: 14,
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.25%'),
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: wp('4%'),
    color: '#1F2937',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: hp('2%'),
    fontSize: wp('4%'),
    color: '#6B7280',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('10%'),
    paddingHorizontal: wp('10%'),
  },
  emptyStateText: {
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: '#374151',
    marginTop: hp('2%'),
    marginBottom: hp('1%'),
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: wp('3.5%'),
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  listContent: {
    paddingHorizontal: wp('4%'),
    paddingBottom: 130,
    paddingTop: hp('0.5%'),
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: hp('1.6%'),
    paddingHorizontal: wp('3.8%'),
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: hp('1%'),
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 12,
    backgroundColor: '#E2E8F0',
  },
  conversationInfo: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp('0.5%'),
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('2%'),
    flex: 1,
  },
  participantName: {
    fontSize: wp('4.1%'),
    fontWeight: '700',
    color: '#1F2937',
  },
  activeJobBadge: {
    backgroundColor: '#ECFDF3',
    borderRadius: 999,
    paddingHorizontal: wp('2%'),
    paddingVertical: 2,
  },
  activeJobText: {
    color: '#16A34A',
    fontSize: 11,
    fontWeight: '600',
  },
  rightSection: {
    alignItems: 'flex-end',
    gap: wp('1%'),
  },
  timestamp: {
    fontSize: wp('3.1%'),
    color: '#9CA3AF',
  },
  lastMessage: {
    fontSize: wp('3.45%'),
    color: '#64748B',
    marginTop: hp('0.35%'),
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#26B7C9',
    marginTop: hp('0.5%'),
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  fixedBottomButton: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
  findCleanersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#26B7C9',
    paddingVertical: hp('2%'),
    paddingHorizontal: wp('6%'),
    borderRadius: wp('3%'),
    shadowColor: '#26B7C9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  findCleanersButtonText: {
    color: '#ffffff',
    fontSize: wp('4%'),
    fontWeight: '700',
    marginLeft: 8,
  },
});

export default MessagesScreen; 