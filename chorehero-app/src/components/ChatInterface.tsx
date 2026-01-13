import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../utils/constants';
import { useToast } from './Toast';

const { width: screenWidth } = Dimensions.get('window');

export interface ChatMessage {
  id: string;
  booking_id: string;
  sender_id: string;
  sender_role: 'customer' | 'cleaner';
  content: string;
  message_type: 'text' | 'image' | 'system';
  image_url?: string;
  is_canned_response?: boolean;
  created_at: string;
  read_at?: string;
}

interface ChatInterfaceProps {
  bookingId: string;
  otherParticipant: {
    id: string;
    name: string;
    avatar_url?: string;
    role: 'customer' | 'cleaner';
  };
  onClose?: () => void;
  style?: any;
}

const CANNED_RESPONSES = {
  customer: [
    "I'll be home in 15 minutes",
    "The key is under the mat",
    "Please focus on the kitchen and bathroom",
    "Thank you! Everything looks great",
    "Could you please send a photo when you're done?",
  ],
  cleaner: [
    "I'm on my way! ETA: 10 minutes",
    "Just arrived at your location",
    "Starting the cleaning now",
    "Quick question about your preferences",
    "All done! Here's what I completed:",
    "Thank you for choosing our service!",
  ],
};

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  bookingId,
  otherParticipant,
  onClose,
  style,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showCannedResponses, setShowCannedResponses] = useState(false);
  const [hasImagePermission, setHasImagePermission] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    setupChat();
    requestImagePermissions();
    
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [bookingId]);

  const requestImagePermissions = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      setHasImagePermission(status === 'granted');
    } catch (error) {
      console.error('Error requesting image permissions:', error);
    }
  };

  const setupChat = async () => {
    try {
      setIsLoading(true);
      
      // Load existing messages
      await loadMessages();
      
      // Set up real-time subscription
      const channel = supabase
        .channel(`chat_${bookingId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `booking_id=eq.${bookingId}`,
          },
          (payload: any) => {
            const newMessage = payload.new as ChatMessage;
            setMessages(prev => [...prev, newMessage]);
            scrollToBottom();
            
            // Mark as read if not from current user
            if (newMessage.sender_id !== user?.id) {
              markMessageAsRead(newMessage.id);
            }
          }
        )
        .subscribe();

      channelRef.current = channel;
    } catch (error) {
      console.error('Error setting up chat:', error);
      try { (showToast as any) && showToast({ type: 'error', message: 'Failed to load chat' }); } catch {}
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      setMessages(data || []);
      
      // Mark unread messages as read
      const unreadMessages = data?.filter(
        (msg: ChatMessage) => msg.sender_id !== user?.id && !msg.read_at
      ) || [];
      
      if (unreadMessages.length > 0) {
        await markMultipleMessagesAsRead(unreadMessages.map((msg: ChatMessage) => msg.id));
      }
      
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const markMessageAsRead = async (messageId: string) => {
    try {
      await supabase
        .from('chat_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('id', messageId);
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const markMultipleMessagesAsRead = async (messageIds: string[]) => {
    try {
      await supabase
        .from('chat_messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', messageIds);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const sendMessage = async (content: string, messageType: 'text' | 'image' = 'text', imageUrl?: string, isCanned = false) => {
    if (!user?.id || (!content.trim() && !imageUrl)) return;

    try {
      setIsSending(true);
      
      const messageData = {
        booking_id: bookingId,
        sender_id: user.id,
        sender_role: user.role,
        content: content.trim(),
        message_type: messageType,
        image_url: imageUrl,
        is_canned_response: isCanned,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('chat_messages')
        .insert(messageData);

      if (error) {
        throw error;
      }

      setNewMessage('');
      setShowCannedResponses(false);
      
      // Send push notification to other participant
      await sendPushNotification(content, messageType);
      
    } catch (error) {
      console.error('Error sending message:', error);
      try { (showToast as any) && showToast({ type: 'error', message: 'Failed to send message' }); } catch {}
    } finally {
      setIsSending(false);
    }
  };

  const sendPushNotification = async (content: string, messageType: 'text' | 'image') => {
    try {
      // In a real app, this would call your push notification service
      // For now, we'll just log it
      console.log('Sending push notification:', {
        to: otherParticipant.id,
        title: `Message from ${user?.name}`,
        body: messageType === 'image' ? 'Sent a photo' : content,
        data: { bookingId, type: 'chat_message' },
      });
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  };

  const uploadImage = async (imageUri: string): Promise<string | null> => {
    try {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      
      const fileName = `chat_images/${bookingId}_${Date.now()}.jpg`;
      
      const { data, error } = await supabase.storage
        .from('images')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) {
        throw error;
      }

      const { data: urlData } = supabase.storage
        .from('images')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  };

  const handleImagePicker = () => {
    // Use toast prompt for MVP, keeping single-tap to open library
    try { (showToast as any) && showToast({ type: 'info', message: 'Opening photo library…' }); } catch {}
    openImagePicker('library');
  };

  const openImagePicker = async (source: 'camera' | 'library') => {
    try {
      let result;
      
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          try { (showToast as any) && showToast({ type: 'warning', message: 'Camera permission required' }); } catch {}
          return;
        }
        
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
      } else {
        if (!hasImagePermission) {
          try { (showToast as any) && showToast({ type: 'warning', message: 'Gallery permission required' }); } catch {}
          return;
        }
        
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets[0]) {
        setIsSending(true);
        const imageUrl = await uploadImage(result.assets[0].uri);
        
        if (imageUrl) {
          await sendMessage('', 'image', imageUrl);
        } else {
          try { (showToast as any) && showToast({ type: 'error', message: 'Failed to upload image' }); } catch {}
        }
        setIsSending(false);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      try { (showToast as any) && showToast({ type: 'error', message: 'Failed to select image' }); } catch {}
      setIsSending(false);
    }
  };

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isOwnMessage = item.sender_id === user?.id;
    const isSystemMessage = item.message_type === 'system';

    if (isSystemMessage) {
      return (
        <View style={styles.systemMessageContainer}>
          <Text style={styles.systemMessage}>{item.content}</Text>
        </View>
      );
    }

    return (
      <View style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer,
      ]}>
        {!isOwnMessage && (
          <Image
            source={{ uri: otherParticipant.avatar_url || 'https://via.placeholder.com/40' }}
            style={styles.avatar}
          />
        )}
        
        <View style={[
          styles.messageBubble,
          isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble,
        ]}>
          {item.message_type === 'image' && item.image_url && (
            <Image source={{ uri: item.image_url }} style={styles.messageImage} />
          )}
          
          {item.content && (
            <Text style={[
              styles.messageText,
              isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
            ]}>
              {item.content}
            </Text>
          )}
          
          <View style={styles.messageFooter}>
            <Text style={[
              styles.messageTime,
              isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime,
            ]}>
              {formatTime(item.created_at)}
            </Text>
            
            {isOwnMessage && (
              <Ionicons
                name={item.read_at ? 'checkmark-done' : 'checkmark'}
                size={12}
                color={item.read_at ? COLORS.primary : COLORS.text.secondary}
                style={styles.readIndicator}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderCannedResponse = (response: string, index: number) => (
    <TouchableOpacity
      key={index}
      style={styles.cannedResponseButton}
      onPress={() => sendMessage(response, 'text', undefined, true)}
    >
      <Text style={styles.cannedResponseText}>{response}</Text>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer, style]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading chat...</Text>
      </View>
    );
  }

  const userRole = user?.role as 'customer' | 'cleaner';
  const cannedResponses = CANNED_RESPONSES[userRole] || [];

  return (
    <KeyboardAvoidingView
      style={[styles.container, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Image
            source={{ uri: otherParticipant.avatar_url || 'https://via.placeholder.com/40' }}
            style={styles.headerAvatar}
          />
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{otherParticipant.name}</Text>
            <Text style={styles.headerRole}>
              {otherParticipant.role === 'cleaner' ? 'Your Cleaner' : 'Customer'}
            </Text>
          </View>
        </View>
        
        {onClose && (
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={COLORS.text.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={scrollToBottom}
      />

      {/* Canned Responses */}
      {showCannedResponses && (
        <View style={styles.cannedResponsesContainer}>
          <Text style={styles.cannedResponsesTitle}>Quick Responses</Text>
          {cannedResponses.map((response, index) => renderCannedResponse(response, index))}
        </View>
      )}

      {/* Input */}
      <View style={styles.inputContainer}>
        <TouchableOpacity
          style={styles.cannedButton}
          onPress={() => setShowCannedResponses(!showCannedResponses)}
        >
          <Ionicons
            name="chatbubbles-outline"
            size={24}
            color={showCannedResponses ? COLORS.primary : COLORS.text.secondary}
          />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.imageButton} onPress={handleImagePicker}>
          <Ionicons name="camera-outline" size={24} color={COLORS.text.secondary} />
        </TouchableOpacity>
        
        <TextInput
          style={styles.textInput}
          placeholder="Type a message..."
          placeholderTextColor={COLORS.text.secondary}
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
          maxLength={500}
          editable={!isSending}
        />
        
        <TouchableOpacity
          style={[
            styles.sendButton,
            (newMessage.trim() || isSending) && styles.sendButtonActive,
          ]}
          onPress={() => sendMessage(newMessage)}
          disabled={!newMessage.trim() || isSending}
        >
          {isSending ? (
            <ActivityIndicator size="small" color={COLORS.text.inverse} />
          ) : (
            <Ionicons name="send" size={20} color={COLORS.text.inverse} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: SPACING.md,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.semibold,
    color: COLORS.text.primary,
  },
  headerRole: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.text.secondary,
  },
  closeButton: {
    padding: SPACING.sm,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  messageContainer: {
    flexDirection: 'row',
    marginVertical: SPACING.xs,
    alignItems: 'flex-end',
  },
  ownMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: SPACING.sm,
  },
  messageBubble: {
    maxWidth: screenWidth * 0.75,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  ownMessageBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: BORDER_RADIUS.sm,
  },
  otherMessageBubble: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: BORDER_RADIUS.sm,
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.xs,
  },
  messageText: {
    fontSize: TYPOGRAPHY.sizes.base,
    lineHeight: 20,
  },
  ownMessageText: {
    color: COLORS.text.inverse,
  },
  otherMessageText: {
    color: COLORS.text.primary,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  messageTime: {
    fontSize: TYPOGRAPHY.sizes.xs,
  },
  ownMessageTime: {
    color: COLORS.text.inverse,
  },
  otherMessageTime: {
    color: COLORS.text.secondary,
  },
  readIndicator: {
    marginLeft: SPACING.xs,
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: SPACING.md,
  },
  systemMessage: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.text.secondary,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  cannedResponsesContainer: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    maxHeight: 200,
  },
  cannedResponsesTitle: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.medium,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  cannedResponseButton: {
    backgroundColor: COLORS.background,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cannedResponseText: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.primary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cannedButton: {
    padding: SPACING.sm,
    marginRight: SPACING.sm,
  },
  imageButton: {
    padding: SPACING.sm,
    marginRight: SPACING.sm,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.primary,
    backgroundColor: COLORS.background,
    maxHeight: 100,
    marginRight: SPACING.sm,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.text.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: COLORS.primary,
  },
}); 