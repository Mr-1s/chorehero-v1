import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../services/supabase';

interface Message {
  id: string;
  threadId: string;
  senderId: string;
  content: string;
  timestamp: string;
  type: 'text' | 'image' | 'location' | 'system';
  metadata?: {
    location?: { lat: number; lng: number; address?: string };
    imageUrl?: string;
    systemType?: 'booking_update' | 'job_status' | 'payment';
  };
  readBy: string[];
}

interface Conversation {
  id: string;
  bookingId: string;
  participant: {
    id: string;
    name: string;
    avatar: string;
    role: 'customer' | 'cleaner';
    isOnline: boolean;
    lastSeen?: string;
  };
  lastMessage: Message | null;
  unreadCount: number;
  typing: boolean;
  jobStatus?: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
}

interface EnhancedMessageContextType {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  unreadCount: number;
  
  // Actions
  setCurrentConversation: (conversation: Conversation | null) => void;
  sendMessage: (content: string, type?: 'text' | 'image' | 'location') => Promise<void>;
  markAsRead: (conversationId: string) => Promise<void>;
  setTyping: (isTyping: boolean) => void;
  sendLocation: (lat: number, lng: number, address?: string) => Promise<void>;
  sendSystemMessage: (type: 'booking_update' | 'job_status' | 'payment', content: string) => Promise<void>;
  
  // Real-time status
  isConnected: boolean;
  reconnect: () => void;
}

const EnhancedMessageContext = createContext<EnhancedMessageContextType | undefined>(undefined);

interface EnhancedMessageProviderProps {
  children: ReactNode;
  userId: string;
}

export const EnhancedMessageProvider: React.FC<EnhancedMessageProviderProps> = ({ 
  children, 
  userId 
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  // Initialize real-time subscriptions
  useEffect(() => {
    if (!userId) return;

    // Subscribe to new messages
    const messagesSubscription = supabase
      .channel('public:messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMessage = payload.new as Message;
          handleNewMessage(newMessage);
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    // Subscribe to typing indicators
    const typingSubscription = supabase
      .channel('typing')
      .on('broadcast', { event: 'typing' }, (payload) => {
        handleTypingUpdate(payload.payload);
      })
      .subscribe();

    // Subscribe to presence (online status)
    const presenceSubscription = supabase
      .channel('user_presence')
      .on('presence', { event: 'sync' }, () => {
        updateOnlineStatus();
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        updateUserOnlineStatus(key, true);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        updateUserOnlineStatus(key, false);
      })
      .subscribe();

    // Track own presence
    presenceSubscription.track({
      user_id: userId,
      online_at: new Date().toISOString(),
    });

    return () => {
      messagesSubscription.unsubscribe();
      typingSubscription.unsubscribe();
      presenceSubscription.unsubscribe();
    };
  }, [userId]);

  // Load conversations
  useEffect(() => {
    loadConversations();
  }, [userId]);

  // Load messages for current conversation
  useEffect(() => {
    if (currentConversation) {
      loadMessages(currentConversation.id);
    }
  }, [currentConversation]);

  const handleNewMessage = (newMessage: Message) => {
    // Add to messages if it's for current conversation
    if (currentConversation && newMessage.threadId === currentConversation.id) {
      setMessages(prev => [...prev, newMessage]);
      
      // Mark as read if user sent it
      if (newMessage.senderId === userId) {
        markAsRead(currentConversation.id);
      }
    }

    // Update conversations list
    setConversations(prev => 
      prev.map(conv => {
        if (conv.id === newMessage.threadId) {
          return {
            ...conv,
            lastMessage: newMessage,
            unreadCount: newMessage.senderId === userId ? 0 : conv.unreadCount + 1,
          };
        }
        return conv;
      })
    );

    // Update total unread count
    if (newMessage.senderId !== userId) {
      setUnreadCount(prev => prev + 1);
    }
  };

  const handleTypingUpdate = (payload: { userId: string; threadId: string; isTyping: boolean }) => {
    if (payload.userId === userId) return;

    setConversations(prev =>
      prev.map(conv => {
        if (conv.id === payload.threadId) {
          return { ...conv, typing: payload.isTyping };
        }
        return conv;
      })
    );
  };

  const updateOnlineStatus = () => {
    // Update online status for all users
    const presence = supabase.getChannels()[0]?.presenceState();
    // Implementation depends on Supabase presence structure
  };

  const updateUserOnlineStatus = (userId: string, isOnline: boolean) => {
    setConversations(prev =>
      prev.map(conv => {
        if (conv.participant.id === userId) {
          return {
            ...conv,
            participant: { ...conv.participant, isOnline },
          };
        }
        return conv;
      })
    );
  };

  const loadConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_threads')
        .select(`
          id,
          booking_id,
          customer_id,
          cleaner_id,
          chat_messages(
            id,
            content,
            created_at,
            sender_id,
            message_type,
            metadata
          )
        `)
        .or(`customer_id.eq.${userId},cleaner_id.eq.${userId}`)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const formattedConversations: Conversation[] = data?.map(thread => {
        const isCustomer = thread.customer_id === userId;
        const participantId = isCustomer ? thread.cleaner_id : thread.customer_id;
        const lastMessage = thread.chat_messages?.[0] || null;
        
        return {
          id: thread.id,
          bookingId: thread.booking_id,
          participant: {
            id: participantId || '',
            name: 'Loading...', // Will be fetched separately
            avatar: '',
            role: isCustomer ? 'cleaner' : 'customer',
            isOnline: false, // Will be updated by presence
          },
          lastMessage: lastMessage ? {
            id: lastMessage.id,
            threadId: thread.id,
            senderId: lastMessage.sender_id,
            content: lastMessage.content,
            timestamp: lastMessage.created_at,
            type: lastMessage.type || 'text',
            metadata: lastMessage.metadata,
            readBy: [], // Would need separate read_receipts table
          } : null,
          unreadCount: 0, // Would calculate from read_receipts
          typing: false,
        };
      }) || [];

      setConversations(formattedConversations);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const loadMessages = async (threadId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;

      const formattedMessages: Message[] = data?.map(msg => ({
        id: msg.id,
        threadId: msg.thread_id,
        senderId: msg.sender_id,
        content: msg.content,
        timestamp: msg.created_at,
        type: msg.type || 'text',
        metadata: msg.metadata,
        readBy: [], // Would come from read_receipts table
      })) || [];

      setMessages(formattedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async (content: string, type: 'text' | 'image' | 'location' = 'text') => {
    if (!currentConversation || !content.trim()) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          thread_id: currentConversation.id,
          sender_id: userId,
          content: content.trim(),
          type,
          created_at: new Date().toISOString(),
        });

      if (error) throw error;

      // Stop typing indicator
      setTyping(false);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const sendLocation = async (lat: number, lng: number, address?: string) => {
    if (!currentConversation) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          thread_id: currentConversation.id,
          sender_id: userId,
          content: address || `Location: ${lat}, ${lng}`,
          type: 'location',
          metadata: { location: { lat, lng, address } },
          created_at: new Date().toISOString(),
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error sending location:', error);
    }
  };

  const sendSystemMessage = async (
    type: 'booking_update' | 'job_status' | 'payment',
    content: string
  ) => {
    if (!currentConversation) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          thread_id: currentConversation.id,
          sender_id: 'system',
          content,
          type: 'system',
          metadata: { systemType: type },
          created_at: new Date().toISOString(),
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error sending system message:', error);
    }
  };

  const markAsRead = async (conversationId: string) => {
    try {
      // Implementation would update read_receipts table
      // For now, just update local state
      setConversations(prev =>
        prev.map(conv => {
          if (conv.id === conversationId) {
            return { ...conv, unreadCount: 0 };
          }
          return conv;
        })
      );

      // Update total unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const setTyping = (isTyping: boolean) => {
    if (!currentConversation) return;

    supabase.channel('typing').send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        userId,
        threadId: currentConversation.id,
        isTyping,
      },
    });
  };

  const reconnect = () => {
    // Force reconnection to real-time services
    supabase.removeAllChannels();
    // Re-initialize subscriptions would happen in useEffect
  };

  return (
    <EnhancedMessageContext.Provider
      value={{
        conversations,
        currentConversation,
        messages,
        unreadCount,
        setCurrentConversation,
        sendMessage,
        markAsRead,
        setTyping,
        sendLocation,
        sendSystemMessage,
        isConnected,
        reconnect,
      }}
    >
      {children}
    </EnhancedMessageContext.Provider>
  );
};

export const useEnhancedMessages = () => {
  const context = useContext(EnhancedMessageContext);
  if (context === undefined) {
    throw new Error('useEnhancedMessages must be used within an EnhancedMessageProvider');
  }
  return context;
}; 