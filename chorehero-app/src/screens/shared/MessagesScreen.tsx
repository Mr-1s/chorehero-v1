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
          // Transform chat threads to conversations
          const realConversations: Conversation[] = await Promise.all(
            chatThreads.map(async (thread) => {
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

              return {
                id: thread.id,
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
        // Demo user or USE_MOCK_DATA is true - show mock data
        console.log('📱 Loading mock conversations');
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const mockConversations = [
          {
            id: '1',
            participant: {
              id: 'cleaner1',
              name: 'Maria Garcia',
              avatar: 'https://randomuser.me/api/portraits/women/32.jpg',
              role: 'cleaner' as const,
            },
            lastMessage: 'See you at 2pm! 😊',
            lastTimestamp: '10:12 AM',
            unreadCount: 2,
            bookingId: 'booking1',
          },
          {
            id: '2',
            participant: {
              id: 'cleaner2',
              name: 'Sarah Johnson',
              avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
              role: 'cleaner' as const,
            },
            lastMessage: 'Thank you for the tip!',
            lastTimestamp: 'Yesterday',
            unreadCount: 0,
            bookingId: 'booking2',
          },
          {
            id: '3',
            participant: {
              id: 'customer1',
              name: 'John Doe',
              avatar: 'https://randomuser.me/api/portraits/men/45.jpg',
              role: 'customer' as const,
            },
            lastMessage: 'Can you come earlier?',
            lastTimestamp: 'Mon',
            unreadCount: 1,
            bookingId: 'booking3',
          },
        ];
        
        setConversations(mockConversations);
        
        // Calculate total unread count
        const totalUnread = mockConversations.reduce((sum, conv) => sum + conv.unreadCount, 0);
        setUnreadCount(totalUnread);
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
      onPress={() => navigation.navigate('ChatScreen', {
        bookingId: item.bookingId,
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
          <Text style={styles.participantName}>{item.participant.name}</Text>
          <View style={styles.rightSection}>
            <Text style={styles.timestamp}>{item.lastTimestamp}</Text>
            {item.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadCount}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
        <Text style={[styles.lastMessage, item.unreadCount > 0 && styles.unreadMessage]} numberOfLines={1}>
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
            onPress={() => navigation.navigate('Discover')}
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
          unreadCount={3}
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
    margin: 20,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
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
    padding: 20,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    position: 'relative',
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
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
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
    color: '#6B7280',
    marginTop: 2,
  },
  unreadMessage: {
    fontWeight: '600',
    color: '#1F2937',
  },
  unreadBadge: {
    backgroundColor: '#3ad3db',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  unreadCount: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
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