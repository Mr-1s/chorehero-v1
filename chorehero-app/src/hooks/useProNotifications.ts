/**
 * Pro Notifications - Real-time subscription for new bookings.
 * When a customer pays for a quote, the pro receives:
 * - In-app toast if active in app
 * - Badge count increment
 * - Haptic feedback
 * Push notification is sent by confirm-quote-payment Edge Function.
 */
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { supabase } from '../services/supabase';
import { useAuth } from './useAuth';
import { useToast } from '../components/Toast';

export function useProNotifications(): void {
  const { user, isCleaner } = useAuth();
  const { showToast } = useToast();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const cleanerId = user?.id;
    if (!cleanerId || cleanerId.startsWith('demo_') || !isCleaner) return;

    const channel = supabase
      .channel('pro-new-bookings')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bookings',
          filter: `cleaner_id=eq.${cleanerId}`,
        },
        async (payload) => {
          if (!mountedRef.current) return;
          const row = payload.new as { id?: string; total_amount?: number; cleaner_earnings?: number };
          const amount = row.cleaner_earnings ?? row.total_amount ?? 0;
          const msg = `New booking! You earn $${Number(amount).toFixed(2)}`;

          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch {
            // Haptics may fail on simulator
          }

          showToast({ message: msg, type: 'success', durationMs: 5000 });

          try {
            const { data: { count } } = await supabase
              .from('bookings')
              .select('id', { count: 'exact', head: true })
              .eq('cleaner_id', cleanerId)
              .in('status', ['confirmed', 'cleaner_en_route', 'cleaner_arrived', 'in_progress']);
            const badgeCount = Math.min((count ?? 0) + 1, 99);
            await Notifications.setBadgeCountAsync(badgeCount);
          } catch {
            // Badge update is best-effort
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, isCleaner, showToast]);
}
