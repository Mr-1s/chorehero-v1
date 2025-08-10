import type { StackNavigationProp } from '@react-navigation/stack';
import { messageService } from '../services/messageService';
import { Alert } from 'react-native';

export interface MessageParticipant {
  id: string;
  name: string;
  avatar: string;
  role?: 'customer' | 'cleaner';
}

export interface MessageRouteParams {
  participant: MessageParticipant;
  bookingId?: string;
  navigation: any; // Navigation prop
  currentUserId?: string; // Current user's ID for creating chat rooms
}

/**
 * Smart message routing utility
 * This function handles routing to the Messages tab and then to specific conversations
 * It checks for existing conversations and creates new ones as needed
 */
export const routeToMessage = async ({ participant, bookingId, navigation, currentUserId }: MessageRouteParams) => {
  try {
    // Enable real messaging for authenticated users
    if (currentUserId && !currentUserId.startsWith('demo_')) {
      console.log('💬 Creating/getting chat room for real users');
      
      // Create or get existing chat room
      const response = await messageService.createOrGetChatRoom({
        participant1Id: currentUserId,
        participant2Id: participant.id,
        bookingId
      });

      if (response.success && response.data) {
        // Navigate to chat with the room ID
        navigation.navigate('IndividualChat', {
          roomId: response.data.id,
          otherParticipant: {
            id: participant.id,
            name: participant.name,
            avatar_url: participant.avatar,
            role: participant.role,
          },
        });
        return;
      } else {
        console.error('❌ Failed to create/get chat room:', response.error);
        
        // Show specific error message for database setup issues
        if (response.error?.includes('Chat tables not created')) {
          Alert.alert(
            'Database Setup Required', 
            'The messaging system needs to be set up in your database. Please check the setup instructions.',
            [{ text: 'OK', style: 'default' }]
          );
        } else {
          Alert.alert('Error', 'Failed to start conversation. Please try again.');
        }
        return;
      }
    }
    
    // Fallback for demo users - navigate directly to chat
    console.log('💬 Using demo navigation for demo users');
    
    // Navigate directly to IndividualChat (it's in the main stack, not nested in tabs)
    navigation.navigate('IndividualChat', {
      cleanerId: participant.id,
      bookingId: bookingId || 'general',
      otherParticipant: {
        id: participant.id,
        name: participant.name,
        avatar_url: participant.avatar,
        role: participant.role,
      },
    });
    
  } catch (error) {
    console.error('❌ Error in routeToMessage:', error);
    Alert.alert('Error', 'Failed to start conversation. Please try again.');
  }
};

/**
 * Alternative route that goes directly to chat (for when already in Messages context)
 */
export const routeToChat = ({ participant, bookingId, navigation }: MessageRouteParams) => {
  navigation.navigate('IndividualChat', {
    cleanerId: participant.id,
    bookingId: bookingId || 'general',
  });
};

/**
 * Check if a conversation exists for a given participant
 * This would integrate with your backend/state management in a real app
 */
export const hasExistingConversation = (participantId: string): boolean => {
  // In a real app, this would check your conversations state/database
  // For now, return true to simulate existing conversations
  return Math.random() > 0.3; // 70% chance of existing conversation
};

/**
 * Create a new conversation with a participant
 * This would integrate with your backend in a real app
 */
export const createConversation = async (participant: MessageParticipant, bookingId?: string) => {
  // In a real app, this would create a new conversation in your backend
  console.log(`Creating conversation with ${participant.name}`, { bookingId });
  
  return {
    id: `conv_${participant.id}_${Date.now()}`,
    participantId: participant.id,
    bookingId,
    createdAt: new Date().toISOString(),
  };
}; 