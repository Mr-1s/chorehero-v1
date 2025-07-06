import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Database } from '../types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
const isDevelopmentMode = process.env.EXPO_PUBLIC_DEV_MODE === 'true';

// Create a mock client for development mode
const createMockClient = () => ({
  auth: {
    signInWithOtp: () => Promise.resolve({ data: null, error: { message: 'Development mode - no backend connected' } }),
    signOut: () => Promise.resolve({ error: null }),
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
  from: () => ({
    select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'Development mode' } }) }) }),
    insert: () => Promise.resolve({ data: null, error: { message: 'Development mode' } }),
    update: () => Promise.resolve({ data: null, error: { message: 'Development mode' } }),
    delete: () => Promise.resolve({ data: null, error: { message: 'Development mode' } }),
  }),
  channel: () => ({
    on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
  }),
});

export const supabase = isDevelopmentMode && (supabaseUrl.includes('placeholder') || supabaseAnonKey.includes('placeholder'))
  ? createMockClient() as any
  : createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });

// Real-time subscription types
export type RealtimeChannel = ReturnType<typeof supabase.channel>;

// Helper function to get current user
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
};

// Helper function to get current session
export const getCurrentSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
};

// Helper function to sign out
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

// Database query helpers
export const getUserProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('users')
    .select(`
      *,
      customer_profiles(*),
      cleaner_profiles(*)
    `)
    .eq('id', userId)
    .single();
  
  if (error) throw error;
  return data;
};

// Real-time subscription helpers
export const subscribeToBookingUpdates = (
  bookingId: string,
  callback: (payload: any) => void
) => {
  return supabase
    .channel(`booking-${bookingId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bookings',
        filter: `id=eq.${bookingId}`,
      },
      callback
    )
    .subscribe();
};

export const subscribeToLocationUpdates = (
  bookingId: string,
  callback: (payload: any) => void
) => {
  return supabase
    .channel(`location-${bookingId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'location_updates',
        filter: `booking_id=eq.${bookingId}`,
      },
      callback
    )
    .subscribe();
};

export const subscribeToChatMessages = (
  threadId: string,
  callback: (payload: any) => void
) => {
  return supabase
    .channel(`chat-${threadId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `thread_id=eq.${threadId}`,
      },
      callback
    )
    .subscribe();
};

export const subscribeToNotifications = (
  userId: string,
  callback: (payload: any) => void
) => {
  return supabase
    .channel(`notifications-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      callback
    )
    .subscribe();
};