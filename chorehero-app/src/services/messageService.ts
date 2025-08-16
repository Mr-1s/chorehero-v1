import { supabase } from './supabase';

export interface ChatMessage {
  id: string;
  room_id: string;
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

export interface ChatRoom {
  id: string;
  participants: string[];
  booking_id: string;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateChatRoomParams {
  customer_id: string;
  cleaner_id: string;
  booking_id: string;
}

export interface SendMessageParams {
  roomId: string;
  senderId: string;
  content: string;
  messageType?: 'text' | 'image' | 'booking_update';
}

class MessageService {
  /**
   * Create or get existing chat room between two users
   */
  async createOrGetChatRoom(params: CreateChatRoomParams): Promise<{ success: boolean; data?: ChatRoom; error?: string }> {
    try {
      const { customer_id, cleaner_id, booking_id } = params;
      
      console.log('🏠 Creating/getting chat thread between:', customer_id, 'and', cleaner_id);
      
      // Check if room already exists for this booking
      const { data: existingRoom, error: findError } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('booking_id', booking_id)
        .single();

      if (findError && findError.code !== 'PGRST116') {
        console.error('❌ Error finding existing room:', findError);
        
        // Check if it's a table doesn't exist error
        if (findError.code === '42P01') {
          throw new Error('Chat tables not created. Please run the database schema setup first.');
        }
        
        throw findError;
      }

      if (existingRoom) {
        console.log('✅ Found existing chat room:', existingRoom.id);
        return { success: true, data: existingRoom };
      }

      // Create new chat room
      const { data: newRoom, error: createError } = await supabase
        .from('chat_rooms')
        .insert({
          participants: [customer_id, cleaner_id],
          booking_id: booking_id,
          last_message: null,
          last_message_at: null
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Error creating chat room:', createError);
        throw createError;
      }

      console.log('✅ Created new chat room:', newRoom.id);
      return { success: true, data: newRoom };
      
    } catch (error) {
      console.error('❌ MessageService error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create chat room'
      };
    }
  }

  /**
   * Send a message in a chat room
   */
  async sendMessage(params: SendMessageParams): Promise<{ success: boolean; data?: ChatMessage; error?: string }> {
    try {
      const { roomId, senderId, content, messageType = 'text' } = params;
      
      console.log('💬 Sending message to room:', roomId);
      
      // Insert the message
      const { data: message, error: messageError } = await supabase
        .from('chat_messages')
        .insert({
          room_id: roomId,
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

      // Update the chat room's last message
      const { error: updateError } = await supabase
        .from('chat_rooms')
        .update({
          last_message: content,
          last_message_at: new Date().toISOString()
        })
        .eq('id', roomId);

      if (updateError) {
        console.warn('⚠️ Error updating room last message:', updateError);
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
   * Get messages for a chat room
   */
  async getMessages(roomId: string, limit: number = 50): Promise<{ success: boolean; data?: ChatMessage[]; error?: string }> {
    try {
      console.log('📨 Getting messages for room:', roomId);
      
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select(`
          *,
          sender:users(id, name, avatar_url, role)
        `)
        .eq('room_id', roomId)
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
      console.log('👁️ Marking messages as read for room:', roomId, 'user:', userId);
      
      const { error } = await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('room_id', roomId)
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
   * Get chat rooms for a user
   */
  async getChatRooms(userId: string): Promise<{ success: boolean; data?: ChatRoom[]; error?: string }> {
    try {
      console.log('🏠 Getting chat rooms for user:', userId);
      
      const { data: rooms, error } = await supabase
        .from('chat_rooms')
        .select('*')
        .contains('participants', [userId])
        .order('last_message_at', { ascending: false });

      if (error) {
        console.error('❌ Error getting chat rooms:', error);
        throw error;
      }

      console.log(`✅ Got ${rooms?.length || 0} chat rooms`);
      return { success: true, data: rooms || [] };
      
    } catch (error) {
      console.error('❌ Get chat rooms error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get chat rooms'
      };
    }
  }

  /**
   * Subscribe to real-time messages for a room
   */
  subscribeToMessages(roomId: string, callback: (message: ChatMessage) => void) {
    console.log('🔔 Subscribing to messages for room:', roomId);
    
    const subscription = supabase
      .channel(`messages:${roomId}`)
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`
        }, 
        async (payload: any) => {
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
   * Subscribe to real-time chat room updates
   */
  subscribeToChatRooms(userId: string, callback: (room: ChatRoom) => void) {
    console.log('🔔 Subscribing to chat room updates for user:', userId);
    
    const subscription = supabase
      .channel(`rooms:${userId}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'chat_rooms'
          // Note: We'll filter client-side since Supabase doesn't support contains in realtime filters
        }, 
        (payload: any) => {
          console.log('🏠 Chat room update:', payload);
          
          // Check if this room involves the current user
          const participants = payload.new?.participants || payload.old?.participants;
          if (participants && participants.includes(userId)) {
            callback(payload.new as ChatRoom);
          }
        }
      )
      .subscribe();

    return subscription;
  }
}

export const messageService = new MessageService();