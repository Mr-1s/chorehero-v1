// App Configuration
export const APP_CONFIG = {
  name: 'ChoreHero',
  version: '1.0.0',
  api_timeout: 30000,
  max_retry_attempts: 3,
  video_cache_duration: 24 * 60 * 60 * 1000, // 24 hours
  location_update_interval: 5000, // 5 seconds
  booking_timeout: 60000, // 60 seconds for booking flow
};

// Design System
export const COLORS = {
  primary: '#00D4AA',
  secondary: '#1A2B4C',
  accent: '#FF6B6B',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  background: '#FAFAFA',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  text: {
    primary: '#1F2937',
    secondary: '#6B7280',
    disabled: '#9CA3AF',
    inverse: '#FFFFFF',
  },
  overlay: 'rgba(0, 0, 0, 0.5)',
};

export const TYPOGRAPHY = {
  sizes: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  lineHeights: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const BORDER_RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

// Service Configuration
export const SERVICE_TYPES = {
  express: {
    name: 'Express Clean',
    description: 'Quick 30-45 minute cleaning for maintenance',
    base_price: 45,
    estimated_duration: 35,
    included_tasks: [
      'Bathroom cleaning',
      'Kitchen surfaces',
      'Vacuum main areas',
      'Trash removal',
    ],
  },
  standard: {
    name: 'Standard Clean',
    description: 'Comprehensive cleaning for regular maintenance',
    base_price: 75,
    estimated_duration: 90,
    included_tasks: [
      'All Express Clean tasks',
      'Bedroom cleaning',
      'Dusting surfaces',
      'Mop floors',
      'Light organizing',
    ],
  },
  deep: {
    name: 'Deep Clean',
    description: 'Thorough cleaning for move-in/out or special occasions',
    base_price: 150,
    estimated_duration: 180,
    included_tasks: [
      'All Standard Clean tasks',
      'Inside appliances',
      'Baseboards & windowsills',
      'Interior windows',
      'Detailed organization',
    ],
  },
};

export const ADD_ONS = [
  {
    id: 'inside_fridge',
    name: 'Inside Fridge',
    description: 'Clean inside of refrigerator',
    price: 15,
    estimated_time_minutes: 15,
    category: 'cleaning',
  },
  {
    id: 'inside_oven',
    name: 'Inside Oven',
    description: 'Clean inside of oven',
    price: 20,
    estimated_time_minutes: 20,
    category: 'cleaning',
  },
  {
    id: 'laundry_fold',
    name: 'Laundry Folding',
    description: 'Fold and organize clean laundry',
    price: 25,
    estimated_time_minutes: 30,
    category: 'organization',
  },
  {
    id: 'inside_cabinets',
    name: 'Inside Cabinets',
    description: 'Clean inside kitchen cabinets',
    price: 30,
    estimated_time_minutes: 45,
    category: 'cleaning',
  },
  {
    id: 'garage_organize',
    name: 'Garage Organization',
    description: 'Organize garage space',
    price: 50,
    estimated_time_minutes: 60,
    category: 'organization',
  },
];

// Platform Configuration
export const PLATFORM_CONFIG = {
  commission_rate: 0.25, // 25% platform fee
  cleaner_retention_rate: 0.70, // 70% to cleaner
  tip_suggestions: [0.15, 0.18, 0.20, 0.25], // 15%, 18%, 20%, 25%
  max_search_radius_km: 25,
  min_rating_threshold: 4.0,
  max_video_duration_seconds: 60,
  max_video_file_size_mb: 50,
  max_photos_per_booking: 10,
  max_photo_file_size_mb: 5,
};

// Validation Rules
export const VALIDATION_RULES = {
  phone: {
    pattern: /^\+1[2-9]\d{2}[2-9]\d{2}\d{4}$/,
    message: 'Please enter a valid US phone number',
  },
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: 'Please enter a valid email address',
  },
  rating: {
    min: 1,
    max: 5,
    message: 'Rating must be between 1 and 5 stars',
  },
  tip: {
    min: 0,
    max: 100,
    message: 'Tip percentage must be between 0% and 100%',
  },
  video_duration: {
    min: 15,
    max: 60,
    message: 'Video must be between 15 and 60 seconds',
  },
};

// API Endpoints
export const API_ENDPOINTS = {
  auth: '/auth',
  users: '/users',
  cleaners: '/cleaners',
  customers: '/customers',
  bookings: '/bookings',
  payments: '/payments',
  chat: '/chat',
  ratings: '/ratings',
  locations: '/locations',
  videos: '/videos',
  stripe: '/stripe',
  notifications: '/notifications',
};

// Error Messages
export const ERROR_MESSAGES = {
  network: 'Network error. Please check your connection and try again.',
  auth: 'Authentication failed. Please sign in again.',
  validation: 'Please check your input and try again.',
  payment: 'Payment failed. Please try a different payment method.',
  location: 'Location access is required for this feature.',
  camera: 'Camera access is required to record videos.',
  microphone: 'Microphone access is required to record videos.',
  generic: 'Something went wrong. Please try again.',
};

// Success Messages
export const SUCCESS_MESSAGES = {
  booking_created: 'Booking created successfully! Your cleaner will be in touch soon.',
  payment_processed: 'Payment processed successfully.',
  rating_submitted: 'Thank you for your feedback!',
  profile_updated: 'Profile updated successfully.',
  video_uploaded: 'Video uploaded successfully.',
};

// Feature Flags
export const FEATURE_FLAGS = {
  video_testimonials: true,
  background_location: true,
  push_notifications: true,
  chat_photos: true,
  tip_adjustment: true,
  cleaner_ratings: true,
  express_booking: true,
  real_time_tracking: true,
};

// TikTok-Style Animations
export const ANIMATIONS = {
  duration: {
    quick: 200,
    medium: 400,
    slow: 600,
    celebration: 1000,
  },
  easing: {
    bounce: 'bounce',
    ease: 'ease',
    elastic: 'elastic',
  },
};

// Haptic Feedback Patterns
export const HAPTIC_PATTERNS = {
  light: 'impactLight',
  medium: 'impactMedium',
  heavy: 'impactHeavy',
  success: 'notificationSuccess',
  warning: 'notificationWarning',
  error: 'notificationError',
  selection: 'selection',
};

// Gamification System
export const GAMIFICATION = {
  achievements: {
    SPEED_DEMON: {
      id: 'speed_demon',
      name: 'Speed Demon',
      description: 'Book in under 15 seconds',
      icon: '⚡',
      points: 50,
    },
    STREAK_MASTER: {
      id: 'streak_master',
      name: 'Streak Master',
      description: 'Maintain a 7-day booking streak',
      icon: '🔥',
      points: 100,
    },
    SOCIAL_BUTTERFLY: {
      id: 'social_butterfly',
      name: 'Social Butterfly',
      description: 'Share 5 cleaner profiles',
      icon: '🦋',
      points: 30,
    },
    EXPLORER: {
      id: 'explorer',
      name: 'Explorer',
      description: 'Try 5 different cleaners',
      icon: '🗺️',
      points: 75,
    },
    REVIEWER: {
      id: 'reviewer',
      name: 'Reviewer',
      description: 'Leave 10 detailed reviews',
      icon: '⭐',
      points: 60,
    },
    EARLY_BIRD: {
      id: 'early_bird',
      name: 'Early Bird',
      description: 'Book before 8 AM',
      icon: '🌅',
      points: 25,
    },
  },
  rewards: {
    STREAK_7: { discount: 10, message: 'Week streak! 10% off' },
    STREAK_30: { discount: 20, message: 'Month streak! 20% off' },
    QUICK_BOOK: { points: 10, message: 'Lightning fast!' },
    VIDEO_REVIEW: { points: 25, message: 'Thanks for the review!' },
    FIRST_BOOKING: { points: 50, message: 'Welcome to ChoreHero!' },
    REFERRAL: { points: 100, message: 'Thanks for spreading the word!' },
  },
  streaks: {
    DAILY_MULTIPLIER: 1.1,
    WEEKLY_BONUS: 50,
    MONTHLY_BONUS: 200,
    MAX_STREAK_BONUS: 500,
  },
};

// Video Configuration
export const VIDEO_CONFIG = {
  maxDuration: 30, // seconds
  aspectRatio: 9 / 16, // TikTok style
  quality: 'high',
  fps: 30,
  filters: ['normal', 'bright', 'warm', 'cool', 'vintage', 'dramatic'],
  music: {
    enabled: true,
    fadeDuration: 500,
    defaultVolume: 0.7,
  },
  autoplay: {
    enabled: true,
    threshold: 0.8, // 80% of video visible
    delay: 300,
  },
  gestures: {
    doubleTapLike: true,
    swipeThreshold: 50,
    longPressMenu: true,
  },
  overlay: {
    fadeInDuration: 200,
    fadeOutDuration: 200,
    autoHideDelay: 3000,
  },
};

// TikTok-Style UI Configuration
export const TIKTOK_UI = {
  videoPlayer: {
    backgroundColor: '#000000',
    controlsColor: '#FFFFFF',
    progressBarColor: '#FF6B6B',
    overlayOpacity: 0.8,
  },
  feedSettings: {
    preloadCount: 3,
    cacheCount: 10,
    infiniteScroll: true,
    snapToVideo: true,
  },
  interactions: {
    likeAnimationDuration: 800,
    shareAnimationDuration: 600,
    bookButtonPulseDuration: 1200,
    feedbackVibrationIntensity: 'medium',
  },
  quickActions: {
    bookingTimeout: 15000, // 15 seconds for speed booking
    undoTimeout: 5000, // 5 seconds to undo actions
    celebrationDuration: 3000,
  },
};

// Social Features Configuration
export const SOCIAL_CONFIG = {
  liveActivity: {
    refreshInterval: 5000, // 5 seconds
    maxItems: 50,
    fadeoutDuration: 10000, // 10 seconds
  },
  leaderboard: {
    updateInterval: 60000, // 1 minute
    maxRank: 10,
    timeframes: ['daily', 'weekly', 'monthly', 'all-time'],
  },
  sharing: {
    platforms: ['instagram', 'tiktok', 'snapchat', 'facebook'],
    defaultMessage: 'Check out this amazing cleaner on ChoreHero! 🧹✨',
    hashtags: ['#ChoreHero', '#CleaningHero', '#SparkleAndShine'],
  },
};