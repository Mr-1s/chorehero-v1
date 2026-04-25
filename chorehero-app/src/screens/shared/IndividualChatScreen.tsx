import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, TYPOGRAPHY } from '../../utils/constants';
import { useAuth } from '../../hooks/useAuth';
import { messageService } from '../../services/messageService';
import { supabase } from '../../services/supabase';
import { getConversationId } from '../../utils/conversationId';
import { wp, hp } from '../../utils/responsive';
import { validateOutgoingChatMessage } from '../../utils/messagingPolicy';

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

const isUuid = (id: string | undefined): id is string =>
  !!id &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

const IndividualChatScreen: React.FC<IndividualChatProps> = ({ navigation, route }) => {
  const { cleanerId, bookingId, roomId, otherParticipant } = route.params;
  /** Route may pass placeholders like "general" — only real UUIDs tie to bookings / RLS */
  const bookingUuid = isUuid(bookingId) ? bookingId : undefined;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [contextTitle, setContextTitle] = useState<string>('Booking');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [realChatMode, setRealChatMode] = useState(false);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(roomId || null);
  const [messagingUnlocked, setMessagingUnlocked] = useState(true);
  const [trackableBookingId, setTrackableBookingId] = useState<string | null>(null);
  const [trackableStatus, setTrackableStatus] = useState<string | null>(null);
  
  // No mock messages - always use real data
  const [cleanerData, setCleanerData] = useState<any>(null);

  // Initialize component
  useEffect(() => {
    initializeChat();
  }, []);

  // Listen for deleted messages so both sides update
  useEffect(() => {
    if (!currentRoomId) return;

    const channel = supabase
      .channel(`messages-delete:${currentRoomId}`)
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'chat_messages',
          filter: `thread_id=eq.${currentRoomId}`,
        },
        (payload: any) => {
          const deletedId = payload?.old?.id;
          if (deletedId) {
            setMessages(prev => prev.filter(m => m.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRoomId]);

  /** Realtime INSERTs for this thread — cleaned up on blur/unmount; dedupes optimistic rows from send. */
  useEffect(() => {
    if (!currentRoomId || !user?.id) return;

    const subscription = messageService.subscribeToMessages(currentRoomId, (newMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMessage.id)) return prev;
        const transformedMessage: Message = {
          id: newMessage.id,
          text: newMessage.content,
          sender: newMessage.sender_id === user.id ? 'user' : 'cleaner',
          timestamp: new Date(newMessage.created_at),
          type: (newMessage.message_type as 'text' | 'image' | 'system') || 'text',
        };
        return [...prev, transformedMessage];
      });

      if (newMessage.sender_id !== user.id) {
        void messageService.markMessagesAsRead(currentRoomId, user.id);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [currentRoomId, user?.id]);

  const initializeChat = async () => {
    try {
      setLoading(true);
      setMessagingUnlocked(true);

      if (!user) {
        console.log('❌ No user - cannot load chat');
        setMessages([]);
        setLoading(false);
        return;
      }

      // When a real booking is passed, verify messaging_enabled (post-payment only; RLS same rule)
      if (bookingUuid) {
        const { data: booking } = await supabase
          .from('bookings')
          .select('id, messaging_enabled, service_type, job_id')
          .eq('id', bookingUuid)
          .single();
        if (!booking?.messaging_enabled) {
          setMessagingUnlocked(false);
        }
        const b = booking as { service_type?: string; job_id?: string | null } | null;
        if (b?.service_type) {
          setContextTitle(
            String(b.service_type)
              .replace(/_/g, ' ')
              .replace(/\b\w/g, (c) => c.toUpperCase())
          );
        }
        if (b?.job_id) {
          const { data: jobRow } = await supabase
            .from('jobs')
            .select('headline')
            .eq('id', b.job_id)
            .maybeSingle();
          if (jobRow?.headline) setContextTitle(String(jobRow.headline));
        }
      } else if (bookingId && !bookingUuid) {
        setMessagingUnlocked(false);
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

      // Try to find or create a chat room (requires messaging_unlocked when bookingId)
      let roomToUse = currentRoomId;
      
      if (!roomToUse && cleanerId && user.id) {
        console.log('💬 Looking for existing chat room...');

        const isParticipantCleaner = otherParticipant?.role === 'cleaner' || !otherParticipant?.role;
        const customerId = isParticipantCleaner ? user.id : cleanerId;
        const resolvedCleanerId = isParticipantCleaner ? cleanerId : user.id;
        const conversationId = getConversationId(customerId, resolvedCleanerId);

        const { data: existingThread } = await supabase
          .from('chat_threads')
          .select('id')
          .eq('conversation_id', conversationId)
          .maybeSingle();

        if (existingThread) {
          roomToUse = existingThread.id;
          setCurrentRoomId(roomToUse);
          console.log('✅ Found existing chat room:', roomToUse);
        } else {
          const response = await messageService.createOrGetChatRoom({
            customer_id: customerId,
            cleaner_id: resolvedCleanerId,
            booking_id: bookingUuid,
          });
          if (response.success && response.data) {
            roomToUse = response.data.id;
            setCurrentRoomId(roomToUse);
            console.log('✅ Created new chat room:', roomToUse);
          }
        }
      }

      if (roomToUse) {
        console.log('💬 Loading messages for room:', roomToUse);
        setRealChatMode(true);
        
        // Load real messages (realtime subscription lives in useEffect below)
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

  const quickReplyTemplates = {
    general: [
      'Looks good — thanks!',
      'I have a quick question',
      'Perfect, see you then',
      'Appreciate the update',
    ],
    service: [
      'Could you send a photo when done?',
      'Extra attention in the kitchen please',
      'Please vacuum the carpets',
      'Windows if time allows',
    ],
    location: [
      "What's your ETA?",
      'Please use the access instructions in the app',
      'Please ring the doorbell',
      'Heads up — pet on site',
    ],
  } as const;

  const quickReplyLabel: Record<typeof quickReplyCategory, string> = {
    general: 'General',
    service: 'Job details',
    location: 'Arrival',
  };

  const quickReplies = quickReplyTemplates[quickReplyCategory];

  useEffect(() => {
    const loadTrackableBooking = async () => {
      if (!user?.id || !cleanerId) {
        setTrackableBookingId(null);
        setTrackableStatus(null);
        return;
      }

      const participantId = otherParticipant?.id || cleanerId;
      const isParticipantCleaner = otherParticipant?.role === 'cleaner' || (!otherParticipant?.role && user.role !== 'cleaner');
      const customerId = isParticipantCleaner ? user.id : participantId;
      const resolvedCleanerId = isParticipantCleaner ? participantId : user.id;

      const { data: activeBooking } = await supabase
        .from('bookings')
        .select('id, status')
        .eq('customer_id', customerId)
        .eq('cleaner_id', resolvedCleanerId)
        .in('status', ['cleaner_en_route', 'in_progress'])
        .order('scheduled_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeBooking?.id) {
        setTrackableBookingId(activeBooking.id);
        setTrackableStatus(activeBooking.status);
      } else {
        setTrackableBookingId(null);
        setTrackableStatus(null);
      }
    };

    loadTrackableBooking();
  }, [user?.id, cleanerId, otherParticipant?.id, otherParticipant?.role]);

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

  const sendMessageText = async (messageText: string) => {
    if (!messageText.trim()) return;

    const policy = validateOutgoingChatMessage(messageText);
    if (!policy.ok) {
      Alert.alert('Message not sent', policy.message);
      return;
    }

    if (realChatMode && currentRoomId && user) {
      try {
        const response = await messageService.sendMessage({
          roomId: currentRoomId,
          senderId: user.id,
          content: messageText,
          messageType: 'text'
        });

        if (response.success && response.data) {
          const msg = response.data;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [
              ...prev,
              {
                id: msg.id,
                text: msg.content,
                sender: msg.sender_id === user.id ? 'user' : 'cleaner',
                timestamp: new Date(msg.created_at),
                type: (msg.message_type as 'text' | 'image' | 'system') || 'text',
              },
            ];
          });
        } else {
          console.error('❌ Failed to send message:', response.error);
          setMessage(messageText);
          Alert.alert('Message not sent', response.error || 'Could not send. Check connection and booking chat access.');
        }
      } catch (error) {
        console.error('❌ Error sending message:', error);
        setMessage(messageText);
        Alert.alert('Message not sent', error instanceof Error ? error.message : 'Could not send.');
      }
      return;
    }

    const newMessage: Message = {
      id: Date.now().toString(),
      text: messageText,
      sender: 'user',
      timestamp: new Date(),
      type: 'text',
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    const messageText = message.trim();
    setMessage('');
    await sendMessageText(messageText);
  };

  const handleQuickReply = (reply: string) => {
    sendMessageText(reply);
  };

  const handleBackPress = () => {
    navigation.goBack();
  };

  const handleCallCleaner = () => {
    console.log('Calling cleaner...');
  };

  const handleDeleteMessage = (msg: Message) => {
    if (!user) return;

    Alert.alert(
      'Delete message?',
      'This will remove the message for both participants.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (realChatMode && currentRoomId) {
                const response = await messageService.deleteMessage(msg.id, user.id);
                if (!response.success) {
                  throw new Error(response.error || 'Failed to delete message');
                }
              }

              // Remove locally
              setMessages(prev => prev.filter(m => m.id !== msg.id));
            } catch (error) {
              Alert.alert('Error', 'Failed to delete message.');
            }
          }
        }
      ]
    );
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
        
        <TouchableOpacity
          activeOpacity={0.9}
          onLongPress={() => {
            if (isUser) {
              handleDeleteMessage(msg);
            }
          }}
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.cleanerBubble,
          ]}
        >
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
        </TouchableOpacity>

        {isUser && (
          <View style={styles.userAvatarPlaceholder} />
        )}
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading conversation...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackPress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.text.primary} />
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <Image
              source={{ uri: participant.avatar || undefined }}
              style={styles.headerAvatar}
            />
            <View style={styles.headerDetails}>
              <Text style={styles.cleanerName} numberOfLines={1}>
                {participant.name}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {contextTitle}
                {trackableStatus
                  ? ` · ${trackableStatus === 'cleaner_en_route' ? 'En route' : 'In progress'}`
                  : ''}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.policyStrip}>
          <Ionicons name="shield-checkmark" size={14} color="#047B9B" />
          <Text style={styles.policyStripText} numberOfLines={2}>
            Keep booking and payment on ChoreHero. Off-platform contact isn’t allowed.
          </Text>
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {!messagingUnlocked ? (
          <View style={styles.messagingLockedBanner}>
            <Ionicons name="lock-closed" size={32} color={COLORS.text.disabled} />
            <Text style={styles.messagingLockedText}>Messaging unlocks after payment</Text>
            <Text style={styles.messagingLockedSubtext}>Complete your booking to message your pro</Text>
          </View>
        ) : (
          messages.map(renderMessage)
        )}
      </ScrollView>

      {messagingUnlocked && (
        <View style={styles.suggestionsPanel}>
          <Text style={styles.suggestionsTitle}>Suggested replies</Text>
          <View style={styles.categoryRow}>
            {(['general', 'service', 'location'] as const).map((key) => {
              const active = quickReplyCategory === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.categoryPill, active && styles.categoryPillActive]}
                  onPress={() => setQuickReplyCategory(key)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.categoryPillText, active && styles.categoryPillTextActive]}>
                    {quickReplyLabel[key]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <ScrollView
            horizontal
            style={styles.quickRepliesScroll}
            contentContainerStyle={styles.quickRepliesContent}
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {quickReplies.map((reply, index) => (
              <TouchableOpacity
                key={`${quickReplyCategory}-${index}`}
                style={styles.quickReplyChip}
                onPress={() => handleQuickReply(reply)}
                activeOpacity={0.88}
              >
                <Text style={styles.quickReplyChipText}>{reply}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Message Input - disabled when messaging locked */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.inputBar}>
          <View style={[styles.inputContent, !messagingUnlocked && styles.inputContentDisabled]}>
            <TouchableOpacity style={styles.attachButton} disabled={!messagingUnlocked}>
              <Ionicons name="camera" size={22} color={messagingUnlocked ? COLORS.text.secondary : COLORS.text.disabled} />
            </TouchableOpacity>

            <TextInput
              style={styles.textInput}
              value={message}
              onChangeText={setMessage}
              placeholder={messagingUnlocked ? 'Message…' : 'Unlocks after payment'}
              placeholderTextColor={COLORS.text.disabled}
              multiline
              maxLength={500}
              editable={messagingUnlocked}
            />

            <TouchableOpacity
              style={[styles.sendButton, message.trim() && messagingUnlocked && styles.sendButtonActive]}
              onPress={handleSendMessage}
              disabled={!message.trim() || !messagingUnlocked}
            >
              <LinearGradient
                colors={message.trim() ? [COLORS.primary, '#26B7C9'] : [COLORS.border, COLORS.border]}
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
        </View>
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('4%'),
    paddingBottom: hp('1%'),
    minHeight: 48,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp('3%'),
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: wp('3%'),
    backgroundColor: '#E2E8F0',
  },
  headerDetails: {
    flex: 1,
    minWidth: 0,
  },
  cleanerName: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  policyStrip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: wp('4%'),
    paddingBottom: hp('1%'),
    paddingTop: 2,
  },
  policyStripText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: '#64748B',
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: wp('4%'),
  },
  messagesContent: {
    paddingVertical: hp('2%'),
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: hp('1.2%'),
    alignItems: 'flex-end',
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  cleanerMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: wp('8%'),
    height: wp('8%'),
    borderRadius: wp('4%'),
    marginRight: wp('2%'),
  },
  userAvatarPlaceholder: {
    width: wp('8%'),
    marginLeft: wp('2%'),
  },
  messageBubble: {
    maxWidth: wp('74%'),
    borderRadius: 16,
    paddingHorizontal: wp('3.6%'),
    paddingVertical: hp('1.05%'),
  },
  userBubble: {
    backgroundColor: '#1FB7C9',
    borderBottomRightRadius: 6,
  },
  cleanerBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  messageImage: {
    width: '100%',
    height: hp('18%'),
    borderRadius: wp('3%'),
    marginBottom: hp('1%'),
  },
  messageText: {
    fontSize: wp('4.05%'),
    lineHeight: 21,
    marginBottom: hp('0.3%'),
  },
  userMessageText: {
    color: COLORS.text.inverse,
  },
  cleanerMessageText: {
    color: COLORS.text.primary,
  },
  messageTime: {
    fontSize: wp('2.85%'),
    alignSelf: 'flex-end',
  },
  userMessageTime: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  cleanerMessageTime: {
    color: COLORS.text.disabled,
  },
  suggestionsPanel: {
    backgroundColor: '#F8FAFC',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    paddingTop: hp('1%'),
    paddingBottom: hp('0.8%'),
  },
  suggestionsTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginHorizontal: wp('4%'),
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
    paddingHorizontal: wp('4%'),
  },
  categoryPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryPillActive: {
    backgroundColor: 'rgba(38, 183, 201, 0.12)',
    borderColor: '#26B7C9',
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  categoryPillTextActive: {
    color: '#047B9B',
    fontWeight: '600',
  },
  quickRepliesScroll: {
    maxHeight: 44,
  },
  quickRepliesContent: {
    paddingHorizontal: wp('4%'),
    alignItems: 'center',
    paddingBottom: 4,
  },
  quickReplyChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickReplyChipText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  inputContainer: {
    backgroundColor: 'transparent',
  },
  inputBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  inputContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1%'),
    paddingBottom: hp('1.2%'),
  },
  attachButton: {
    width: wp('10%'),
    height: wp('10%'),
    borderRadius: wp('5%'),
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp('2%'),
  },
  textInput: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('0.9%'),
    fontSize: wp('4%'),
    color: COLORS.text.primary,
    maxHeight: hp('12%'),
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sendButton: {
    marginLeft: wp('2%'),
    borderRadius: wp('5%'),
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
    width: wp('10%'),
    height: wp('10%'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: hp('2%'),
    fontSize: wp('4%'),
    color: COLORS.text.secondary,
  },
  messagingLockedBanner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('8%'),
  },
  messagingLockedText: {
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: COLORS.text.primary,
    marginTop: hp('2%'),
  },
  messagingLockedSubtext: {
    fontSize: wp('3.5%'),
    color: COLORS.text.secondary,
    marginTop: hp('0.5%'),
  },
  inputContentDisabled: {
    opacity: 0.7,
  },
});

export default IndividualChatScreen; 