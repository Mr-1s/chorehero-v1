# Realtime subscription audit

Snapshot of every `supabase.channel(...)` site at the time of the stability sprint, plus a verdict on cleanup and focus-refresh behavior.

| File | Channel | Cleanup | Focus refresh? | Notes |
|---|---|---|---|---|
| [src/services/cleanerBookingService.ts](../src/services/cleanerBookingService.ts) | `new-bookings` | `removeChannel` | n/a (caller is `subscribeToNewBookings`) | OK |
| [src/services/cleanerBookingService.ts](../src/services/cleanerBookingService.ts) | `new-assigned-bookings` | `removeChannel` | n/a | OK |
| [src/services/booking.ts](../src/services/booking.ts) | `booking_${bookingId}` | `subscription.unsubscribe()` returned to caller | n/a | OK — caller responsibility |
| [src/services/presenceService.ts](../src/services/presenceService.ts) | `presence_updates` | `removeChannel` in `stop()` | n/a | OK |
| [src/services/presenceService.ts](../src/services/presenceService.ts) | `presence_${userId}` | returns `removeChannel` cleanup | yes (callers wire to component lifecycle) | OK |
| [src/services/trackingWorkflowService.ts](../src/services/trackingWorkflowService.ts) | `location-${bookingId}` | `removeChannel` returned cleanup | yes | OK |
| [src/screens/cleaner/DashboardScreen.tsx](../src/screens/cleaner/DashboardScreen.tsx) | `dashboard-bookings-cancelled` | `removeChannel` in effect cleanup | yes (already refreshes via `useFocusEffect`) | OK |
| [src/screens/shared/LiveTrackingScreen.tsx](../src/screens/shared/LiveTrackingScreen.tsx) | `booking-${bookingId}` | `subscription.unsubscribe()` in effect cleanup | n/a (single-purpose screen) | OK |
| [src/screens/shared/IndividualChatScreen.tsx](../src/screens/shared/IndividualChatScreen.tsx) | `messages-delete:${roomId}` | `removeChannel` in effect cleanup | n/a | OK |
| [src/screens/cleaner/JobsScreenNew.tsx](../src/screens/cleaner/JobsScreenNew.tsx) | `bookings-cancelled` | `removeChannel` in effect cleanup | yes | OK |
| [src/screens/shared/VideoFeedScreen.tsx](../src/screens/shared/VideoFeedScreen.tsx) | `content_posts_delete` | `removeChannel` in effect cleanup | n/a | OK |
| [src/services/supabase.ts](../src/services/supabase.ts) | `booking-${bookingId}`, `location-${bookingId}`, `chat-${threadId}`, `notifications-${userId}` | helper returns the channel; cleanup is caller responsibility | n/a | Verify each consumer unsubscribes |
| [src/services/enhancedLocationService.ts](../src/services/enhancedLocationService.ts) | `location_updates` (broadcast) | not returned for cleanup — fire-and-forget broadcast send | n/a | OK for broadcast send-only path |
| [src/services/enhancedLocationService.ts](../src/services/enhancedLocationService.ts) | `location_updates` (subscribe) | returned subscription; caller must unsubscribe | n/a | Caller responsibility |
| [src/services/chatService.ts](../src/services/chatService.ts) | `thread_${threadId}` | returned to caller | n/a | Caller responsibility |
| [src/services/messageService.ts](../src/services/messageService.ts) | `messages:${roomId}` | returned to caller | n/a | Caller responsibility |
| [src/services/messageService.ts](../src/services/messageService.ts) | `threads:${userId}` | returned to caller | n/a | Caller responsibility |
| [src/hooks/useProNotifications.ts](../src/hooks/useProNotifications.ts) | `pro-new-bookings` | `removeChannel` in effect cleanup | n/a | OK |
| [src/context/EnhancedMessageContext.tsx](../src/context/EnhancedMessageContext.tsx) | `public:messages` | `subscription.unsubscribe()` in effect cleanup | n/a | OK |
| [src/context/EnhancedMessageContext.tsx](../src/context/EnhancedMessageContext.tsx) | `typing` | `subscription.unsubscribe()` in effect cleanup | n/a | OK |
| [src/context/EnhancedMessageContext.tsx](../src/context/EnhancedMessageContext.tsx) | `user_presence` | `subscription.unsubscribe()` in effect cleanup | n/a | OK |

## Findings

- Every channel created **inside a React effect** has a matching cleanup. No leaked subscriptions found in app screens or hooks.
- Service-layer helpers (`booking.subscribeToBookingUpdates`, `chatService.subscribeToMessages`, `messageService.subscribeToMessages`, `messageService.subscribeToChatRooms`, `enhancedLocationService.subscribeToLocationUpdates`) **return the raw subscription**. Cleanup is caller responsibility. None of the audited callers leak — but new callers must remember to unsubscribe in their effect cleanup.
- The notification-badge stale-state issue we fixed in the last sprint was **not** a leaked channel — it was a missing `useFocusEffect` refresh on screens whose `currentScreen` prop didn't flip when a root-stack screen was pushed. That fix is already in place in [src/components/FloatingNavigation.tsx](../src/components/FloatingNavigation.tsx) and [src/screens/shared/BookingScreen.tsx](../src/screens/shared/BookingScreen.tsx).

## Convention to enforce going forward

- Channels created inside a React `useEffect` or `useFocusEffect` MUST `removeChannel` (or `subscription.unsubscribe()`) in the cleanup function.
- Service helpers that return a subscription MUST document that the caller is responsible for cleanup, and the caller MUST wire it to a component lifecycle.
- Screens that subscribe to data that affects header/tab badges (notifications, quotes, booking alerts) MUST also call a `useFocusEffect`-based refresh, because realtime alone doesn't flip state when the user navigates away and back.
