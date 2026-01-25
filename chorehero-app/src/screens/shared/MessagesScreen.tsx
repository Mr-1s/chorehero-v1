import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import FloatingNavigation from '../../components/FloatingNavigation';
import CleanerFloatingNavigation from '../../components/CleanerFloatingNavigation';
import { EmptyState, EmptyStateConfigs } from '../../components/EmptyState';

import { useMessages, type Conversation } from '../../context/MessageContext';
import { useRoleFeatures } from '../../components/RoleBasedUI';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabase';
import { getConversationId } from '../../utils/conversationId';

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
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { conversations, setConversations, setUnreadCount } = useMessages();
  const { isCleaner } = useRoleFeatures();
  const { user } = useAuth();

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
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
      console.error('❌ Error loading conversations:', error);
      Alert.alert('Error', 'Failed to load messages');
      // Fallback to empty state
      setConversations([]);
      setUnreadCount(0);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredConversations = conversations.filter(c =>
    c.participant.name.toLowerCase().includes(search.toLowerCase())
  );

  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={styles.conversationCard}
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
            <Text style={styles.participantName}>{item.participant.name}</Text>
            {item.hasActiveJob && (
              <View style={styles.activeJobBadge}>
                <Text style={styles.activeJobText}>Active Job</Text>
              </View>
            )}
          </View>
          <View style={styles.rightSection}>
            <Text style={styles.timestamp}>{item.lastTimestamp}</Text>
            {item.unreadCount > 0 && (
              <View style={styles.unreadDot} />
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
          <ActivityIndicator size="large" color="#00BFA6" />
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
        />
      )}
      
      {/* Fixed Find Cleaners Button - Only show when empty */}
      {filteredConversations.length === 0 && !isLoading && (
        <View style={styles.fixedBottomButton}>
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
      
      {isCleaner ? (
        <CleanerFloatingNavigation 
          navigation={navigation as any} 
          currentScreen="Messages"
        />
      ) : (
      <FloatingNavigation navigation={navigation} currentScreen="Messages" />
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 16,
    marginTop: 12,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 16,
  },
  conversationInfo: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  activeJobBadge: {
    backgroundColor: '#ECFDF3',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  activeJobText: {
    color: '#16A34A',
    fontSize: 11,
    fontWeight: '600',
  },
  rightSection: {
    alignItems: 'flex-end',
    gap: 4,
  },
  timestamp: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  lastMessage: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#26B7C9',
    marginTop: 6,
  },
  fixedBottomButton: {
    position: 'absolute',
    bottom: 140,
    left: 20,
    right: 20,
  },
  findCleanersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3ad3db',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#3ad3db',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  findCleanersButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
});

export default MessagesScreen; 