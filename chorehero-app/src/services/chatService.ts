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
}

export interface CreateChatThreadParams {
  customer_id: string;
  cleaner_id: string;
  booking_id: string;
}

export interface SendMessageParams {
  threadId: string;
  senderId: string;
  content: string;
  messageType?: 'text' | 'image' | 'booking_update';
}

class ChatService {
  /**
   * Create or get existing chat thread for a booking
   */
  async createOrGetChatThread(params: CreateChatThreadParams): Promise<{ success: boolean; data?: ChatThread; error?: string }> {
    try {
      const { customer_id, cleaner_id, booking_id } = params;
      const conversationId = getConversationId(customer_id, cleaner_id);
      
      console.log('🏠 Creating/getting chat thread for conversation:', conversationId);
      
      // Check if thread already exists for this conversation
      const { data: existingThread, error: findError } = await supabase
        .from('chat_threads')
        .select('*')
        .eq('conversation_id', conversationId)
        .single();

      if (findError && findError.code !== 'PGRST116') {
        console.error('❌ Error finding existing thread:', findError);
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

      // Create new thread
      console.log('📝 Creating new chat thread...');
      const { data: newThread, error: createError } = await supabase
        .from('chat_threads')
        .insert({
          conversation_id: conversationId,
          customer_id,
          cleaner_id,
          booking_id,
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Error creating thread:', createError);
        throw createError;
      }

      console.log('✅ Chat thread created:', newThread.id);
      return { success: true, data: newThread };

    } catch (error) {
      console.error('❌ Chat thread creation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create chat thread'
      };
    }
  }

  /**
   * Send a message to a chat thread
   */
  async sendMessage(params: SendMessageParams): Promise<{ success: boolean; data?: ChatMessage; error?: string }> {
    try {
      const { threadId, senderId, content, messageType = 'text' } = params;

      console.log('💬 Sending message to thread:', threadId);

      const { data: message, error } = await supabase
        .from('chat_messages')
        .insert({
          thread_id: threadId,
          sender_id: senderId,
          content,
          message_type: messageType,
        })
        .select(`
          *,
          sender:users(id, name, avatar_url, role)
        `)
        .single();

      if (error) {
        console.error('❌ Error sending message:', error);
        throw error;
      }

      // Update thread's last_message_at
      await supabase
        .from('chat_threads')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', threadId);

      console.log('✅ Message sent:', message.id);
      return { success: true, data: message as ChatMessage };

    } catch (error) {
      console.error('❌ Send message failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send message'
      };
    }
  }

  /**
   * Get messages for a chat thread
   */
  async getMessages(threadId: string, limit = 50): Promise<{ success: boolean; data?: ChatMessage[]; error?: string }> {
    try {
      console.log('📖 Getting messages for thread:', threadId);

      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select(`
          *,
          sender:users(id, name, avatar_url, role)
        `)
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('❌ Error getting messages:', error);
        throw error;
      }

      console.log(`✅ Retrieved ${messages?.length || 0} messages`);
      return { success: true, data: messages as ChatMessage[] || [] };

    } catch (error) {
      console.error('❌ Get messages failed:', error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Failed to get messages'
      };
    }
  }

  /**
   * Get chat threads for a user
   */
  async getUserThreads(userId: string): Promise<{ success: boolean; data?: ChatThread[]; error?: string }> {
    try {
      console.log('📋 Getting chat threads for user:', userId);

      const { data: threads, error } = await supabase
        .from('chat_threads')
        .select('*')
        .or(`customer_id.eq.${userId},cleaner_id.eq.${userId}`)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (error) {
        console.error('❌ Error getting threads:', error);
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

      console.log(`✅ Retrieved ${deduped.size} threads`);
      return { success: true, data: Array.from(deduped.values()) };

    } catch (error) {
      console.error('❌ Get threads failed:', error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Failed to get threads'
      };
    }
  }

  /**
   * Mark messages as read
   */
  async markMessagesAsRead(threadId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('chat_messages')
        .update({ 
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('thread_id', threadId)
        .neq('sender_id', userId) // Don't mark own messages as read
        .eq('is_read', false);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to mark messages as read'
      };
    }
  }

  /**
   * Subscribe to new messages in a thread
   */
  subscribeToMessages(threadId: string, callback: (message: ChatMessage) => void) {
    return supabase
      .channel(`thread_${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          console.log('📨 New message received:', payload.new);
          callback(payload.new as ChatMessage);
        }
      )
      .subscribe();
  }
}

export const chatService = new ChatService();
export default chatService;