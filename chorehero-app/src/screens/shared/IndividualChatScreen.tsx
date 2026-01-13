import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { COLORS, TYPOGRAPHY, SPACING } from '../../utils/constants';
import { useAuth } from '../../hooks/useAuth';
import { messageService, type ChatMessage } from '../../services/messageService';
import { supabase } from '../../services/supabase';

type TabParamList = {
  Home: undefined;
  Discover: undefined;
  Bookings: undefined;
  Messages: undefined;
  Profile: undefined;
  LiveTracking: { bookingId: string };
};

type IndividualChatNavigationProp = BottomTabNavigationProp<TabParamList, any>;

interface IndividualChatProps {
  navigation: IndividualChatNavigationProp;
  route: {
    params: {
      cleanerId?: string;
      bookingId?: string;
      roomId?: string;
      otherParticipant?: {
        id: string;
        name: string;
        avatar_url: string;
        role: 'customer' | 'cleaner';
      };
    };
  };
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'cleaner';
  timestamp: Date;
  image?: string;
  type?: 'text' | 'image' | 'system';
}

const { width } = Dimensions.get('window');

const IndividualChatScreen: React.FC<IndividualChatProps> = ({ navigation, route }) => {
  const { cleanerId, bookingId, roomId, otherParticipant } = route.params;
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [realChatMode, setRealChatMode] = useState(false);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(roomId || null);
  
  // No mock messages - always use real data
  const [cleanerData, setCleanerData] = useState<any>(null);

  // Initialize component
  useEffect(() => {
    initializeChat();
  }, []);

  const initializeChat = async () => {
    try {
      setLoading(true);
      
      if (!user) {
        console.log('❌ No user - cannot load chat');
        setMessages([]);
        setLoading(false);
        return;
      }

      // Fetch cleaner data if we have a cleanerId
      if (cleanerId) {
        const { data: cleaner } = await supabase
          .from('users')
          .select('id, name, avatar_url')
          .eq('id', cleanerId)
          .single();
        
        if (cleaner) {
          setCleanerData(cleaner);
        }
      }

      // Try to find or create a chat room
      let roomToUse = currentRoomId;
      
      if (!roomToUse && cleanerId && user.id) {
        console.log('💬 Looking for existing chat room...');
        
        // Look for existing thread
        const { data: existingThread } = await supabase
          .from('chat_threads')
          .select('id')
          .or(`and(customer_id.eq.${user.id},cleaner_id.eq.${cleanerId}),and(customer_id.eq.${cleanerId},cleaner_id.eq.${user.id})`)
          .maybeSingle();
        
        if (existingThread) {
          roomToUse = existingThread.id;
          setCurrentRoomId(roomToUse);
          console.log('✅ Found existing chat room:', roomToUse);
        } else if (bookingId) {
          // Create new thread for this booking
          console.log('💬 Creating new chat room...');
          const { data: newThread, error } = await supabase
            .from('chat_threads')
            .insert({
              customer_id: user.id,
              cleaner_id: cleanerId,
              booking_id: bookingId,
            })
            .select()
            .single();
          
          if (newThread && !error) {
            roomToUse = newThread.id;
            setCurrentRoomId(roomToUse);
            console.log('✅ Created new chat room:', roomToUse);
          }
        }
      }

      if (roomToUse) {
        console.log('💬 Loading messages for room:', roomToUse);
        setRealChatMode(true);
        
        // Load real messages
        const response = await messageService.getMessages(roomToUse);
        if (response.success && response.data) {
          const transformedMessages: Message[] = response.data.map(msg => ({
            id: msg.id,
            text: msg.content,
            sender: msg.sender_id === user.id ? 'user' : 'cleaner',
            timestamp: new Date(msg.created_at),
            type: msg.message_type as 'text' | 'image' | 'system' || 'text',
          }));
          setMessages(transformedMessages);
          
          await messageService.markMessagesAsRead(roomToUse, user.id);
        } else {
          setMessages([]); // Empty chat, no mock
        }
        
        // Subscribe to real-time messages
        const subscription = messageService.subscribeToMessages(roomToUse, (newMessage) => {
          const transformedMessage: Message = {
            id: newMessage.id,
            text: newMessage.content,
            sender: newMessage.sender_id === user.id ? 'user' : 'cleaner',
            timestamp: new Date(newMessage.created_at),
            type: newMessage.message_type as 'text' | 'image' | 'system' || 'text',
          };
          
          setMessages(prev => [...prev, transformedMessage]);
          
          if (newMessage.sender_id !== user.id) {
            messageService.markMessagesAsRead(roomToUse!, user.id);
          }
        });
        
        return () => {
          subscription?.unsubscribe();
        };
      } else {
        console.log('💬 No chat room available - showing empty state');
        setRealChatMode(true);
        setMessages([]); // Empty, not mock
      }
    } catch (error) {
      console.error('❌ Error initializing chat:', error);
      setMessages([]); // Empty on error, not mock
    } finally {
      setLoading(false);
    }
  };

  const scrollViewRef = useRef<ScrollView>(null);
  const messageSlideAnim = useRef(new Animated.Value(50)).current;
  const [quickReplyCategory, setQuickReplyCategory] = useState<'general' | 'service' | 'location'>('general');

  // Get participant data from props or fetched cleaner data
  const participant = otherParticipant ? {
    id: otherParticipant.id,
    name: otherParticipant.name,
    avatar: otherParticipant.avatar_url,
    status: 'Online',
    service: 'Professional Cleaning',
  } : cleanerData ? {
    id: cleanerData.id,
    name: cleanerData.name || 'Cleaner',
    avatar: cleanerData.avatar_url,
    status: 'Online',
    service: 'Professional Cleaning',
  } : {
    id: cleanerId || '',
    name: 'Loading...',
    avatar: null,
    status: 'Offline',
    service: 'Cleaning Service',
  };

  // Enhanced Quick reply options with categories
  const quickReplyTemplates = {
    general: [
      '👍 Looks good!',
      '✨ Thank you!',
      '❓ I have a question',
      '👌 Perfect!',
    ],
    service: [
      '📷 Can you send a photo?',
      '💡 Extra attention to kitchen please',
      '🚿 Don\'t forget the bathroom',
      '🧹 Please vacuum the carpet',
      '🪟 Windows need cleaning too',
    ],
    location: [
      '⏰ What\'s the ETA?',
      '🔑 Key is under the mat',
      '🚪 Please ring the doorbell',
      '🅿️ Parking is available in front',
      '🐕 Please be careful of my pet',
    ],
  };

  const quickReplies = quickReplyTemplates[quickReplyCategory];

  useEffect(() => {
    // Animate in new messages
    Animated.timing(messageSlideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Auto-scroll to bottom when new messages arrive
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const handleSendMessage = async () => {
    if (message.trim()) {
      const messageText = message.trim();
      setMessage(''); // Clear input immediately for better UX
      
      if (realChatMode && currentRoomId && user) {
        // Send real message
        try {
          const response = await messageService.sendMessage({
            roomId: currentRoomId,
            senderId: user.id,
            content: messageText,
            messageType: 'text'
          });
          
          if (response.success && response.data) {
            // Message will be added via real-time subscription
            console.log('✅ Message sent successfully');
          } else {
            console.error('❌ Failed to send message:', response.error);
            // Re-add message to input if sending failed
            setMessage(messageText);
          }
        } catch (error) {
          console.error('❌ Error sending message:', error);
          setMessage(messageText);
        }
      } else {
        // Demo mode - add message locally
        const newMessage: Message = {
          id: Date.now().toString(),
          text: messageText,
          sender: 'user',
          timestamp: new Date(),
          type: 'text',
        };
        setMessages(prev => [...prev, newMessage]);
      }
    }
  };

  const handleQuickReply = (reply: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text: reply,
      sender: 'user',
      timestamp: new Date(),
      type: 'text',
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleBackPress = () => {
    navigation.goBack();
  };

  const handleCallCleaner = () => {
    console.log('Calling cleaner...');
  };

  const handleTrackService = () => {
    navigation.navigate('LiveTracking', { bookingId });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = (msg: Message, index: number) => {
    const isUser = msg.sender === 'user';
    const isLastMessage = index === messages.length - 1;

    return (
      <Animated.View
        key={msg.id}
        style={[
          styles.messageContainer,
          isUser ? styles.userMessageContainer : styles.cleanerMessageContainer,
          isLastMessage && { transform: [{ translateY: messageSlideAnim }] },
        ]}
      >
        {!isUser && (
          <Image source={{ uri: participant.avatar }} style={styles.messageAvatar} />
        )}
        
        <View style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.cleanerBubble,
        ]}>
          {msg.type === 'image' && msg.image && (
            <Image source={{ uri: msg.image }} style={styles.messageImage} />
          )}
          <Text style={[
            styles.messageText,
            isUser ? styles.userMessageText : styles.cleanerMessageText,
          ]}>
            {msg.text}
          </Text>
          <Text style={[
            styles.messageTime,
            isUser ? styles.userMessageTime : styles.cleanerMessageTime,
          ]}>
            {formatTime(msg.timestamp)}
          </Text>
        </View>

        {isUser && (
          <View style={styles.userAvatarPlaceholder} />
        )}
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.surface} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading conversation...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.surface} />
      
      {/* Header with Service Context */}
      <BlurView intensity={90} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text.primary} />
          </TouchableOpacity>
          
          <View style={styles.headerInfo}>
            <Image source={{ uri: participant.avatar }} style={styles.headerAvatar} />
            <View style={styles.headerDetails}>
              <Text style={styles.cleanerName}>{participant.name}</Text>
              <View style={styles.serviceInfo}>
                <View style={styles.statusIndicator} />
                <Text style={styles.statusText}>{participant.status}</Text>
                <Text style={styles.serviceDivider}>•</Text>
                <Text style={styles.serviceText}>{participant.service}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.callButton} onPress={handleCallCleaner}>
            <Ionicons name="call" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </BlurView>

      {/* Service Context Card */}
      <View style={styles.serviceCard}>
        <BlurView intensity={20} style={styles.serviceCardBlur}>
          <View style={styles.serviceCardContent}>
            <View style={styles.serviceHeader}>
              <Ionicons name="home" size={20} color={COLORS.primary} />
              <Text style={styles.serviceTitle}>Kitchen Deep Clean</Text>
              <Text style={styles.serviceETA}>ETA: {participant.eta}</Text>
            </View>
            <TouchableOpacity style={styles.trackButton} onPress={handleTrackService}>
              <Text style={styles.trackButtonText}>Track Service</Text>
              <Ionicons name="location" size={16} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        </BlurView>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.map(renderMessage)}
      </ScrollView>

      {/* Quick Reply Categories */}
      <View style={styles.quickReplyCategoriesContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
          {Object.keys(quickReplyTemplates).map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryTab,
                quickReplyCategory === category && styles.activeCategoryTab
              ]}
              onPress={() => setQuickReplyCategory(category as any)}
            >
              <Text style={[
                styles.categoryTabText,
                quickReplyCategory === category && styles.activeCategoryTabText
              ]}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Quick Replies */}
      <ScrollView
        horizontal
        style={styles.quickRepliesContainer}
        contentContainerStyle={styles.quickRepliesContent}
        showsHorizontalScrollIndicator={false}
      >
        {quickReplies.map((reply, index) => (
          <TouchableOpacity
            key={index}
            style={styles.quickReplyButton}
            onPress={() => handleQuickReply(reply)}
          >
            <Text style={styles.quickReplyText}>{reply}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Message Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputContainer}
      >
        <BlurView intensity={90} style={styles.inputBlur}>
          <View style={styles.inputContent}>
            <TouchableOpacity style={styles.attachButton}>
              <Ionicons name="camera" size={24} color={COLORS.text.secondary} />
            </TouchableOpacity>
            
            <TextInput
              style={styles.textInput}
              value={message}
              onChangeText={setMessage}
              placeholder="Type a message..."
              placeholderTextColor={COLORS.text.disabled}
              multiline
              maxLength={500}
            />
            
            <TouchableOpacity
              style={[styles.sendButton, message.trim() && styles.sendButtonActive]}
              onPress={handleSendMessage}
              disabled={!message.trim()}
            >
              <LinearGradient
                colors={message.trim() ? [COLORS.primary, '#E97E0B'] : [COLORS.border, COLORS.border]}
                style={styles.sendButtonGradient}
              >
                <Ionicons
                  name="send"
                  size={20}
                  color={message.trim() ? COLORS.text.inverse : COLORS.text.disabled}
                />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </BlurView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: SPACING.md,
  },
  headerDetails: {
    flex: 1,
  },
  cleanerName: {
    fontSize: TYPOGRAPHY.sizes.base,
    fontWeight: TYPOGRAPHY.weights.semibold,
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  serviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
    marginRight: SPACING.xs,
  },
  statusText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.success,
    marginRight: SPACING.xs,
  },
  serviceDivider: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.text.disabled,
    marginHorizontal: SPACING.xs,
  },
  serviceText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.text.secondary,
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceCard: {
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.md,
    borderRadius: 16,
    overflow: 'hidden',
  },
  serviceCardBlur: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  serviceCardContent: {
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  serviceTitle: {
    fontSize: TYPOGRAPHY.sizes.base,
    fontWeight: TYPOGRAPHY.weights.medium,
    color: COLORS.text.primary,
    marginLeft: SPACING.sm,
    flex: 1,
  },
  serviceETA: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  trackButtonText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.weights.medium,
    marginRight: SPACING.xs,
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  messagesContent: {
    paddingVertical: SPACING.md,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
    alignItems: 'flex-end',
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  cleanerMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: SPACING.sm,
  },
  userAvatarPlaceholder: {
    width: 32,
    marginLeft: SPACING.sm,
  },
  messageBubble: {
    maxWidth: width * 0.7,
    borderRadius: 20,
    padding: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  userBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  cleanerBubble: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 4,
  },
  messageImage: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    marginBottom: SPACING.sm,
  },
  messageText: {
    fontSize: TYPOGRAPHY.sizes.base,
    lineHeight: TYPOGRAPHY.lineHeights.normal * TYPOGRAPHY.sizes.base,
    marginBottom: SPACING.xs,
  },
  userMessageText: {
    color: COLORS.text.inverse,
  },
  cleanerMessageText: {
    color: COLORS.text.primary,
  },
  messageTime: {
    fontSize: TYPOGRAPHY.sizes.xs,
    alignSelf: 'flex-end',
  },
  userMessageTime: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  cleanerMessageTime: {
    color: COLORS.text.disabled,
  },
  quickRepliesContainer: {
    maxHeight: 60,
    marginBottom: SPACING.sm,
  },
  quickRepliesContent: {
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
  },
  quickReplyButton: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickReplyText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.text.secondary,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  inputContainer: {
    backgroundColor: 'transparent',
  },
  inputBlur: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  inputContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  textInput: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.primary,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sendButton: {
    marginLeft: SPACING.sm,
    borderRadius: 20,
    overflow: 'hidden',
  },
  sendButtonActive: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonGradient: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Quick Reply Categories Styles
  quickReplyCategoriesContainer: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  categoriesScroll: {
    flexDirection: 'row',
  },
  categoryTab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    marginRight: SPACING.sm,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  activeCategoryTab: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryTabText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '500',
    color: COLORS.text.secondary,
  },
  activeCategoryTabText: {
    color: COLORS.text.inverse,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.secondary,
  },
});

export default IndividualChatScreen; 