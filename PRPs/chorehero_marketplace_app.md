name: "ChoreHero Video-First Marketplace App PRP"
description: |

## Purpose
Implementation plan for ChoreHero - a video-first cleaning service marketplace app connecting customers with verified cleaners through video profiles, enabling trust-based 60-second bookings.

## Core Principles
1. **Video-First**: Every cleaner interaction starts with video discovery
2. **Trust-Building**: Prioritize safety and verification over speed
3. **Dual-Role Architecture**: Customer and cleaner apps with shared core
4. **Express Clean Focus**: Optimize for 30-45 minute service sessions
5. **MVP Boundaries**: Booking, payments, tracking, chat, ratings only

---

## Goal
Build a React Native marketplace app that solves the trust barrier in home cleaning services through video-first cleaner discovery, enabling customers to book verified cleaners in under 60 seconds while maintaining safety and transparency.

## Why
- **Trust is paramount**: Users need confidence when letting strangers into their homes
- **Market gap**: Current platforms use generic profiles and stock photos, creating anxiety
- **Cleaner empowerment**: Enable cleaners to showcase personality and earn fair wages (70% retention)
- **Urban professional need**: Target busy professionals who value time over money

## What
A dual-role React Native app with video-first cleaner discovery, 60-second booking flow, real-time tracking, and integrated payments.

### Success Criteria
- [ ] Customer can book service in under 60 seconds
- [ ] Video watch-through rate > 70% 
- [ ] App crash rate < 0.5%
- [ ] Payment success rate > 98%
- [ ] Real-time tracking with <200ms API response time
- [ ] Two-way rating system with video testimonials
- [ ] Background check verification display

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Include these in your context window
- url: https://docs.expo.dev/versions/latest/
  why: React Native/Expo setup, video handling, permissions
  
- file: CHOREHERO_PRD.md
  why: Complete user stories, UX flows, technical requirements
  
- file: design_system.md
  why: Color palette, typography, component patterns
  
- url: https://supabase.com/docs/guides/realtime
  why: Real-time features for tracking, chat, notifications
  
- url: https://stripe.com/docs/connect
  why: Marketplace payments, cleaner payouts, commission handling
  
- url: https://docs.expo.dev/versions/latest/sdk/av/
  why: Video player implementation, streaming, caching
  
- url: https://developers.google.com/maps/documentation/javascript/overview
  why: Real-time tracking, location services, route optimization
  
- docfile: CLAUDE.md
  why: ChoreHero-specific development guidelines and constraints
```

### Current Codebase tree
```bash
Context-Engineering-Intro/
├── CHOREHERO_PRD.md           # Complete product requirements
├── CLAUDE.md                  # Development guidelines + ChoreHero rules
├── design_system.md           # Visual DNA, colors, typography
├── INITIAL.md                 # Project overview and tech stack
├── PRPs/                      # Implementation plans
│   ├── templates/
│   │   └── prp_base.md
│   └── EXAMPLE_multi_agent_prp.md
├── examples/                  # Empty - to be populated
├── README.md                  # Context engineering documentation
└── LICENSE
```

### Desired Codebase tree with files to be added
```bash
chorehero-app/
├── src/
│   ├── components/            # Reusable UI components
│   │   ├── VideoPlayer.tsx    # Custom video player with controls
│   │   ├── CleanerCard.tsx    # Video-first cleaner profile cards
│   │   ├── BookingFlow.tsx    # 60-second booking components
│   │   ├── TrackingMap.tsx    # Real-time location tracking
│   │   └── ChatInterface.tsx  # In-app messaging
│   ├── screens/               # Screen components
│   │   ├── customer/          # Customer-facing screens
│   │   │   ├── DiscoverScreen.tsx    # Video gallery (TikTok-style)
│   │   │   ├── BookingScreen.tsx     # Service selection & scheduling
│   │   │   ├── TrackingScreen.tsx    # Live service tracking
│   │   │   └── HistoryScreen.tsx     # Past bookings & ratings
│   │   ├── cleaner/           # Cleaner-facing screens
│   │   │   ├── ProfileScreen.tsx     # Video upload & profile mgmt
│   │   │   ├── JobsScreen.tsx        # Available & active jobs
│   │   │   ├── EarningsScreen.tsx    # Payment history & analytics
│   │   │   └── ScheduleScreen.tsx    # Calendar & availability
│   │   └── shared/            # Shared between roles
│   │       ├── AuthScreen.tsx        # Phone verification
│   │       ├── ChatScreen.tsx        # In-app messaging
│   │       └── RatingsScreen.tsx     # Two-way rating system
│   ├── services/              # Business logic & API calls
│   │   ├── supabase.ts        # Database client & real-time subscriptions
│   │   ├── stripe.ts          # Payment processing & Connect
│   │   ├── maps.ts            # Google Maps integration
│   │   ├── video.ts           # Video upload, streaming, caching
│   │   └── auth.ts            # Authentication & verification
│   ├── hooks/                 # Custom React hooks
│   │   ├── useVideoPlayer.ts  # Video playback state management
│   │   ├── useLocation.ts     # Location tracking & permissions
│   │   ├── useBooking.ts      # Booking flow state
│   │   └── useChat.ts         # Real-time messaging
│   ├── utils/                 # Utility functions
│   │   ├── constants.ts       # App constants & config
│   │   ├── validation.ts      # Input validation schemas
│   │   └── helpers.ts         # General helper functions
│   └── types/                 # TypeScript type definitions
│       ├── user.ts            # User, customer, cleaner types
│       ├── booking.ts         # Booking, service, payment types
│       └── api.ts             # API response types
├── app.json                   # Expo configuration
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript configuration
└── supabase/                  # Database schema & functions
    ├── migrations/            # Database migrations
    ├── functions/             # Edge functions
    └── schema.sql             # Database schema
```

### Known Gotchas of our codebase & Library Quirks
```typescript
// CRITICAL: Expo AV requires specific video formats for optimal performance
// Use MP4 with H.264 codec, max 1080p resolution for mobile compatibility

// GOTCHA: Supabase real-time subscriptions need proper cleanup
// Always unsubscribe in useEffect cleanup to prevent memory leaks

// GOTCHA: React Native video players need platform-specific handling
// iOS and Android have different video caching and playback behaviors

// CRITICAL: Google Maps API rate limits for real-time tracking
// Implement exponential backoff and batch location updates

// GOTCHA: Stripe Connect requires separate onboarding flow for cleaners
// Must complete verification before accepting payments

// CRITICAL: Video upload to Supabase Storage requires signed URLs
// Implement proper file size limits and compression

// GOTCHA: Expo location services need incremental permissions
// Request foreground first, then background for tracking
```

## Implementation Blueprint

### Data models and structure

Create the core data models ensuring type safety and consistency.
```typescript
// User Management
interface BaseUser {
  id: string;
  phone: string;
  email?: string;
  name: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

interface Customer extends BaseUser {
  role: 'customer';
  addresses: Address[];
  payment_methods: PaymentMethod[];
  booking_history: Booking[];
}

interface Cleaner extends BaseUser {
  role: 'cleaner';
  video_profile_url: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  background_check_date?: string;
  rating_average: number;
  total_jobs: number;
  earnings_total: number;
  availability_schedule: AvailabilitySlot[];
}

// Booking System
interface Booking {
  id: string;
  customer_id: string;
  cleaner_id: string;
  service_type: 'express' | 'standard' | 'deep';
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  address: Address;
  scheduled_time: string;
  estimated_duration: number;
  price_breakdown: PriceBreakdown;
  add_ons: AddOn[];
  tracking_data?: LocationUpdate[];
  chat_thread_id: string;
  created_at: string;
}

// Payment System
interface PriceBreakdown {
  service_base: number;
  add_ons_total: number;
  platform_fee: number;
  tip: number;
  total: number;
}
```

### List of tasks to be completed to fulfill the PRP in order

```yaml
Task 1 - Project Setup:
CREATE chorehero-app/:
  - INITIALIZE: npx create-expo-app chorehero-app --template
  - INSTALL core dependencies: expo-av, @supabase/supabase-js, @stripe/stripe-react-native
  - CONFIGURE: app.json with permissions, navigation, video support
  - SETUP: TypeScript configuration with strict mode

Task 2 - Database Schema:
CREATE supabase/schema.sql:
  - DESIGN: Users table with role-based columns
  - CREATE: Bookings table with comprehensive status tracking
  - SETUP: Real-time subscriptions for booking status
  - IMPLEMENT: Row Level Security (RLS) policies

Task 3 - Authentication System:
CREATE src/services/auth.ts:
  - IMPLEMENT: Phone number verification with Supabase Auth
  - SETUP: Role-based routing (customer vs cleaner)
  - HANDLE: Onboarding flow differences by role
  - INTEGRATE: Background check API for cleaners

Task 4 - Video Discovery Interface:
CREATE src/screens/customer/DiscoverScreen.tsx:
  - IMPLEMENT: TikTok-style video gallery with swipe navigation
  - INTEGRATE: Expo AV for video playback
  - OPTIMIZE: Video caching and preloading
  - HANDLE: Loading states and error handling

Task 5 - Booking Flow:
CREATE src/screens/customer/BookingScreen.tsx:
  - IMPLEMENT: 60-second booking with progress indicators
  - INTEGRATE: Google Maps for location confirmation
  - SETUP: Service selection with real-time pricing
  - HANDLE: Payment processing with Stripe

Task 6 - Real-Time Tracking:
CREATE src/screens/customer/TrackingScreen.tsx:
  - IMPLEMENT: Live location tracking with Google Maps
  - SETUP: Supabase real-time subscriptions
  - HANDLE: ETA calculations and updates
  - INTEGRATE: Chat interface overlay

Task 7 - Cleaner Onboarding:
CREATE src/screens/cleaner/ProfileScreen.tsx:
  - IMPLEMENT: Video upload with compression
  - SETUP: Stripe Connect onboarding
  - HANDLE: Background check integration
  - VALIDATE: Profile completeness requirements

Task 8 - In-App Messaging:
CREATE src/components/ChatInterface.tsx:
  - IMPLEMENT: Real-time messaging with Supabase
  - SETUP: Canned responses and templates
  - HANDLE: Photo sharing capabilities
  - INTEGRATE: Push notifications

Task 9 - Payment System:
CREATE src/services/stripe.ts:
  - IMPLEMENT: Stripe Connect marketplace payments
  - SETUP: Automatic cleaner payouts (70% retention)
  - HANDLE: Tip processing and adjustment
  - INTEGRATE: Payment method management

Task 10 - Rating System:
CREATE src/screens/shared/RatingsScreen.tsx:
  - IMPLEMENT: Two-way rating system
  - SETUP: Video testimonial recording
  - HANDLE: Rating aggregation and display
  - INTEGRATE: Feedback loop for service improvement
```

### Per task pseudocode as needed

```typescript
// Task 4 - Video Discovery Interface
export const DiscoverScreen: React.FC = () => {
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  // PATTERN: Preload next 3 videos for smooth swiping
  useEffect(() => {
    const preloadVideos = async () => {
      const nextCleaners = cleaners.slice(currentIndex + 1, currentIndex + 4);
      await Promise.all(nextCleaners.map(cleaner => 
        Video.preloadAsync(cleaner.video_profile_url)
      ));
    };
    preloadVideos();
  }, [currentIndex]);
  
  // CRITICAL: Video player must handle portrait orientation
  const handleSwipeUp = () => {
    // GOTCHA: Stop current video before advancing
    videoRef.current?.stopAsync();
    setCurrentIndex(prev => Math.min(prev + 1, cleaners.length - 1));
  };
  
  // PATTERN: Track video watch time for analytics
  const handleVideoStatus = (status: VideoStatus) => {
    if (status.positionMillis > 20000) { // 20 seconds
      analyticsService.trackVideoEngagement(cleaners[currentIndex].id);
    }
  };
};

// Task 5 - Booking Flow
export const BookingScreen: React.FC = () => {
  const [bookingStep, setBookingStep] = useState(1);
  const [selectedService, setSelectedService] = useState<ServiceType>();
  const [estimatedPrice, setEstimatedPrice] = useState(0);
  
  // PATTERN: Real-time price calculation
  useEffect(() => {
    const calculatePrice = async () => {
      const price = await pricingService.calculateTotal({
        serviceType: selectedService,
        addOns: selectedAddOns,
        location: selectedAddress
      });
      setEstimatedPrice(price);
    };
    calculatePrice();
  }, [selectedService, selectedAddOns]);
  
  // CRITICAL: Must complete booking in under 60 seconds
  const handleBookingConfirm = async () => {
    const bookingData = {
      cleaner_id: selectedCleaner.id,
      service_type: selectedService,
      scheduled_time: selectedTimeSlot,
      address: selectedAddress,
      add_ons: selectedAddOns,
      payment_method_id: selectedPaymentMethod.id
    };
    
    // GOTCHA: Handle payment processing failures gracefully
    try {
      const booking = await bookingService.createBooking(bookingData);
      await stripeService.processPayment(booking.id);
      navigation.navigate('TrackingScreen', { bookingId: booking.id });
    } catch (error) {
      showErrorAlert('Booking failed. Please try again.');
    }
  };
};
```

### Integration Points
```yaml
DATABASE:
  - migration: "Create comprehensive schema for users, bookings, payments"
  - indexes: "CREATE INDEX idx_cleaner_location ON cleaners(location)"
  - rls: "Row Level Security policies for data privacy"
  
EXTERNAL_APIS:
  - stripe: "Stripe Connect for marketplace payments"
  - google_maps: "Maps API for location and tracking"
  - checkr: "Background check verification API"
  - twilio: "SMS verification for phone numbers"
  
STORAGE:
  - supabase_storage: "Video files with CDN distribution"
  - video_compression: "Automatic compression for mobile optimization"
  - caching: "Implement proper video caching strategy"
  
NOTIFICATIONS:
  - expo_notifications: "Push notifications for booking updates"
  - real_time: "Supabase real-time subscriptions"
  - webhooks: "Stripe webhooks for payment status"
```

## Validation Loop

### Level 1: Syntax & Style
```bash
# Run these FIRST - fix any errors before proceeding
npx expo lint --fix                    # Auto-fix what's possible
npx tsc --noEmit                      # Type checking
npx eslint src/ --fix                 # Code style

# Expected: No errors. If errors, READ the error and fix.
```

### Level 2: Unit Tests
```typescript
// CREATE __tests__/BookingFlow.test.tsx
describe('BookingFlow', () => {
  test('completes booking in under 60 seconds', async () => {
    const startTime = Date.now();
    await bookingService.createBooking(mockBookingData);
    const endTime = Date.now();
    expect(endTime - startTime).toBeLessThan(60000);
  });
  
  test('handles payment processing failures', async () => {
    mockStripeService.processPayment.mockRejectedValueOnce(new Error('Payment failed'));
    const result = await bookingService.createBooking(mockBookingData);
    expect(result.status).toBe('payment_failed');
  });
  
  test('video player preloads next videos', async () => {
    render(<DiscoverScreen />);
    await waitFor(() => {
      expect(Video.preloadAsync).toHaveBeenCalledTimes(3);
    });
  });
});
```

```bash
# Run and iterate until passing:
npx jest --testPathPattern=BookingFlow
# If failing: Read error, understand root cause, fix code, re-run
```

### Level 3: Integration Test
```bash
# Start Expo development server
npx expo start

# Test on physical device (required for video, location, camera)
# Use Expo Go app or development build

# Test critical user flows:
# 1. Customer registration -> video discovery -> booking -> payment
# 2. Cleaner onboarding -> video upload -> job acceptance -> completion
# 3. Real-time tracking during active service

# Expected: All flows complete without crashes
# If error: Check Metro logs and device logs for stack traces
```

### Level 4: Performance Validation
```bash
# Test video performance
# Expected: Video load time < 2 seconds, smooth playback
# Memory usage should remain stable during video swiping

# Test real-time features
# Expected: Location updates < 200ms latency
# Chat messages delivered instantly

# Test payment processing
# Expected: >98% success rate, fallback handling works
```

## Final validation Checklist
- [ ] All unit tests pass: `npx jest`
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] No linting errors: `npx expo lint`
- [ ] Video discovery works smoothly on device
- [ ] 60-second booking flow completes successfully
- [ ] Real-time tracking updates location accurately
- [ ] Payment processing completes without errors
- [ ] Two-way rating system functions properly
- [ ] App performance meets specified metrics
- [ ] Both customer and cleaner roles work correctly

## Confidence Score
**85%** - High confidence based on:
- Comprehensive technical research completed
- Clear MVP scope with proven patterns
- Established tech stack with good documentation
- Detailed user flows and requirements
- Validation loops include performance testing

**Risk factors:**
- Video streaming performance on various devices (5%)
- Real-time location tracking accuracy (5%)
- Stripe Connect marketplace complexity (5%) 