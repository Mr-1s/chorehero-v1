import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { ChatInterface } from '../../components/ChatInterface';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabase';
import { COLORS } from '../../utils/constants';

type RootStackParamList = {
  ChatScreen: {
    bookingId: string;
    otherParticipant: {
      id: string;
      name: string;
      avatar_url?: string;
      role: 'customer' | 'cleaner';
    };
  };
  TrackingScreen: { bookingId: string };
  CustomerHome: undefined;
  CleanerDashboard: undefined;
};

type ChatScreenRouteProp = RouteProp<RootStackParamList, 'ChatScreen'>;
type ChatScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ChatScreen'>;

interface BookingDetails {
  id: string;
  status: string;
  customer_id: string;
  cleaner_id: string;
  service_type: string;
  scheduled_time: string;
}

export const ChatScreen: React.FC = () => {
  const route = useRoute<ChatScreenRouteProp>();
  const navigation = useNavigation<ChatScreenNavigationProp>();
  const { user } = useAuth();
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { bookingId, otherParticipant } = route.params;

  useEffect(() => {
    loadBookingDetails();
    setupBookingSubscription();
  }, [bookingId]);

  const loadBookingDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .single();

      if (error) {
        throw error;
      }

      setBooking(data);
      
      // Verify user has access to this booking
      if (data.customer_id !== user?.id && data.cleaner_id !== user?.id) {
        Alert.alert(
          'Access Denied',
          'You do not have access to this chat.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }
    } catch (error) {
      console.error('Error loading booking details:', error);
      Alert.alert(
        'Error',
        'Failed to load booking details. Please try again.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const setupBookingSubscription = () => {
    // Subscribe to booking status changes
    const channel = supabase
      .channel(`booking_${bookingId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `id=eq.${bookingId}`,
        },
        (payload) => {
          const updatedBooking = payload.new as BookingDetails;
          setBooking(updatedBooking);
          
          // Handle booking status changes
          handleBookingStatusChange(updatedBooking.status);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleBookingStatusChange = (newStatus: string) => {
    let message = '';
    
    switch (newStatus) {
      case 'confirmed':
        message = 'Booking confirmed! Your cleaner will arrive at the scheduled time.';
        break;
      case 'in_progress':
        message = 'Cleaning service has started.';
        break;
      case 'completed':
        message = 'Cleaning service completed! Please rate your experience.';
        break;
      case 'cancelled':
        message = 'This booking has been cancelled.';
        break;
    }

    if (message) {
      // Send system message to chat
      sendSystemMessage(message);
    }
  };

  const sendSystemMessage = async (content: string) => {
    try {
      await supabase
        .from('chat_messages')
        .insert({
          booking_id: bookingId,
          sender_id: 'system',
          sender_role: 'system',
          content,
          message_type: 'system',
          created_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Error sending system message:', error);
    }
  };

  const handleClose = () => {
    // Navigate back to appropriate screen based on user role and booking status
    if (!user || !booking) {
      navigation.goBack();
      return;
    }

    if (user.role === 'customer') {
      if (booking.status === 'in_progress') {
        navigation.navigate('TrackingScreen', { bookingId });
      } else {
        navigation.navigate('CustomerHome');
      }
    } else {
      navigation.navigate('CleanerDashboard');
    }
  };

  if (isLoading || !booking) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.surface} />
        <View style={styles.loadingContainer}>
          {/* Loading will be handled by ChatInterface */}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.surface} />
      <ChatInterface
        bookingId={bookingId}
        otherParticipant={otherParticipant}
        onClose={handleClose}
        style={styles.chatInterface}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatInterface: {
    flex: 1,
  },
}); 