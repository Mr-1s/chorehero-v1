import { supabase } from './supabase';
import { getConversationId } from '../utils/conversationId';

export interface ChatMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'booking_update';
  created_at: string;
  is_read: boolean;
  sender?: {
    id: string;
    name: string;
    avatar_url: string;
    role: 'customer' | 'cleaner';
  };
}

export interface ChatThread {
  id: string;
  customer_id: string;
  cleaner_id: string;
  booking_id: string | null;
  conversation_id: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

// Keep ChatRoom as alias for backwards compatibility
export type ChatRoom = ChatThread;

export interface CreateChatRoomParams {
  customer_id: string;
  cleaner_id: string;
  booking_id?: string;
}

export interface SendMessageParams {
  roomId: string;
  senderId: string;
  content: string;
  messageType?: 'text' | 'image' | 'booking_update';
}

class MessageService {
  /**
   * Create or get existing chat thread between two users
   */
  async createOrGetChatRoom(params: CreateChatRoomParams): Promise<{ success: boolean; data?: ChatThread; error?: string }> {
    try {
      const { customer_id, cleaner_id, booking_id } = params;
      const conversationId = getConversationId(customer_id, cleaner_id);
      
      console.log('🏠 Creating/getting chat thread between:', customer_id, 'and', cleaner_id);
      
      // Check if thread already exists for this conversation
      const { data: existingThread, error: findError } = await supabase
        .from('chat_threads')
        .select('*')
        .eq('conversation_id', conversationId)
        .single();

      if (findError && findError.code !== 'PGRST116') {
        console.error('❌ Error finding existing thread:', findError);
        
        // Check if it's a table doesn't exist error
        if (findError.code === '42P01' || findError.code === 'PGRST205') {
          throw new Error('Chat tables not created. Please run the database schema setup first.');
        }
        
        throw findError;
      }

      if (existingThread) {
        console.log('✅ Found existing chat thread:', existingThread.id);
        if (booking_id && !existingThread.booking_id) {
          await supabase
            .from('chat_threads')
            .update({ booking_id })
            .eq('id', existingThread.id);
        }
        return { success: true, data: existingThread };
      }

      const { data: legacyThread } = await supabase
        .from('chat_threads')
        .select('*')
        .or(`and(customer_id.eq.${customer_id},cleaner_id.eq.${cleaner_id}),and(customer_id.eq.${cleaner_id},cleaner_id.eq.${customer_id})`)
        .maybeSingle();

      if (legacyThread) {
        await supabase
          .from('chat_threads')
          .update({ conversation_id: conversationId, booking_id: booking_id || legacyThread.booking_id })
          .eq('id', legacyThread.id);
        return { success: true, data: { ...legacyThread, conversation_id: conversationId } };
      }

      // Create new chat thread
      const { data: newThread, error: createError } = await supabase
        .from('chat_threads')
        .insert({
          conversation_id: conversationId,
          customer_id,
          cleaner_id,
          booking_id: booking_id || null,
          last_message_at: null
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Error creating chat thread:', createError);
        throw createError;
      }

      console.log('✅ Created new chat thread:', newThread.id);
      return { success: true, data: newThread };
      
    } catch (error) {
      console.error('❌ MessageService error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create chat thread'
      };
    }
  }

  /**
   * Send a message in a chat thread
   */
  async sendMessage(params: SendMessageParams): Promise<{ success: boolean; data?: ChatMessage; error?: string }> {
    try {
      const { roomId, senderId, content, messageType = 'text' } = params;

      // Trust & safety: block off-platform payment keywords
      const OFF_PLATFORM_KEYWORDS = ['venmo', 'cash', 'zelle', 'paypal', 'off app', 'off-platform', 'pay me directly'];
      const contentLower = (content || '').toLowerCase();
      const containsOffPlatform = OFF_PLATFORM_KEYWORDS.some((k) => contentLower.includes(k));

      if (containsOffPlatform && messageType === 'text') {
        await supabase.from('flagged_messages').insert({
          thread_id: roomId,
          sender_id: senderId,
          content: content?.slice(0, 500),
          reason: 'off_platform_payment',
        });
        return {
          success: false,
          error: 'Please keep payments and communication on-platform for your safety.',
        };
      }

      console.log('💬 Sending message to thread:', roomId);

      // Insert the message
      const { data: message, error: messageError } = await supabase
        .from('chat_messages')
        .insert({
          thread_id: roomId,
          sender_id: senderId,
          content,
          message_type: messageType,
          is_read: false
        })
        .select(`
          *,
          sender:users(id, name, avatar_url, role)
        `)
        .single();

      if (messageError) {
        console.error('❌ Error sending message:', messageError);
        throw messageError;
      }

      // Update the chat thread's last message time
      const { error: updateError } = await supabase
        .from('chat_threads')
        .update({
          last_message_at: new Date().toISOString()
        })
        .eq('id', roomId);

      if (updateError) {
        console.warn('⚠️ Error updating thread last message:', updateError);
        // Don't throw - message was sent successfully
      }

      console.log('✅ Message sent successfully');
      return { success: true, data: message };
      
    } catch (error) {
      console.error('❌ Send message error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send message'
      };
    }
  }

  /**
   * Get messages for a chat thread
   */
  async getMessages(roomId: string, limit: number = 50): Promise<{ success: boolean; data?: ChatMessage[]; error?: string }> {
    try {
      console.log('📨 Getting messages for thread:', roomId);
      
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select(`
          *,
          sender:users(id, name, avatar_url, role)
        `)
        .eq('thread_id', roomId)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('❌ Error getting messages:', error);
        throw error;
      }

      console.log(`✅ Got ${messages?.length || 0} messages`);
      return { success: true, data: messages || [] };
      
    } catch (error) {
      console.error('❌ Get messages error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get messages'
      };
    }
  }

  /**
   * Mark messages as read
   */
  async markMessagesAsRead(roomId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('👁️ Marking messages as read for thread:', roomId, 'user:', userId);
      
      const { error } = await supabase
        .from('chat_messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('thread_id', roomId)
        .neq('sender_id', userId) // Don't mark own messages as read
        .eq('is_read', false);

      if (error) {
        console.error('❌ Error marking messages as read:', error);
        throw error;
      }

      console.log('✅ Messages marked as read');
      return { success: true };
      
    } catch (error) {
      console.error('❌ Mark messages as read error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to mark messages as read'
      };
    }
  }

  /**
   * Delete a message (only sender can delete)
   */
  async deleteMessage(messageId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('id', messageId)
        .eq('sender_id', userId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('❌ Delete message error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete message'
      };
    }
  }

  /**
   * Get chat threads for a user
   */
  async getChatRooms(userId: string): Promise<{ success: boolean; data?: ChatThread[]; error?: string }> {
    try {
      console.log('🏠 Getting chat threads for user:', userId);
      
      const { data: threads, error } = await supabase
        .from('chat_threads')
        .select('*')
        .or(`customer_id.eq.${userId},cleaner_id.eq.${userId}`)
        .order('last_message_at', { ascending: false });

      if (error) {
        console.error('❌ Error getting chat threads:', error);
        throw error;
      }

      const deduped = new Map<string, ChatThread>();
      (threads || []).forEach(thread => {
        const conversationId = thread.conversation_id || getConversationId(thread.customer_id, thread.cleaner_id);
        const existing = deduped.get(conversationId);
        if (!existing || (thread.last_message_at || '') > (existing.last_message_at || '')) {
          deduped.set(conversationId, { ...thread, conversation_id: conversationId });
        }
      });

      console.log(`✅ Got ${deduped.size} chat threads`);
      return { success: true, data: Array.from(deduped.values()) };
      
    } catch (error) {
      console.error('❌ Get chat threads error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get chat threads'
      };
    }
  }

  /**
   * Subscribe to real-time messages for a thread
   */
  subscribeToMessages(roomId: string, callback: (message: ChatMessage) => void) {
    console.log('🔔 Subscribing to messages for thread:', roomId);
    
    const subscription = supabase
      .channel(`messages:${roomId}`)
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'chat_messages',
          filter: `thread_id=eq.${roomId}`
        }, 
        async (payload) => {
          console.log('📨 New message received:', payload);
          
          // Get sender info
          const { data: sender } = await supabase
            .from('users')
            .select('id, name, avatar_url, role')
            .eq('id', payload.new.sender_id)
            .single();

          const message: ChatMessage = {
            ...payload.new as any,
            sender
          };
          
          callback(message);
        }
      )
      .subscribe();

    return subscription;
  }

  /**
   * Subscribe to real-time chat thread updates
   */
  subscribeToChatRooms(userId: string, callback: (room: ChatThread) => void) {
    console.log('🔔 Subscribing to chat thread updates for user:', userId);
    
    const subscription = supabase
      .channel(`threads:${userId}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'chat_threads'
        }, 
        (payload) => {
          console.log('🏠 Chat thread update:', payload);
          
          // Check if this thread involves the current user
          const newData = payload.new as ChatThread;
          const oldData = payload.old as ChatThread;
          
          if ((newData?.customer_id === userId || newData?.cleaner_id === userId) ||
              (oldData?.customer_id === userId || oldData?.cleaner_id === userId)) {
            callback(newData);
          }
        }
      )
      .subscribe();

    return subscription;
  }
}

export const messageService = new MessageService();
