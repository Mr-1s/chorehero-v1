/**
 * Unified Service Card Data Structure
 * Standard format for all service cards across the ChoreHero app
 */

export interface ServiceCardData {
  // Essential Identifiers
  id: string;
  type: 'service' | 'video' | 'cleaner_showcase' | 'category';
  
  // Display Content
  title: string;
  description: string;
  category: string; // 'kitchen', 'bathroom', 'living_room', 'bedroom', 'deep_clean', etc.
  
  // Visual Media
  media: {
    primary_image_url: string;
    fallback_image_url?: string;
    video_url?: string; // For video-based cards
    thumbnail_url?: string; // Video thumbnail
    media_type: 'image' | 'video';
    alt_text?: string; // Accessibility
  };
  
  // Pricing Information
  pricing: {
    base_price?: number; // Starting price in cents
    price_range?: string; // e.g., "$80-120", "From $65"
    price_display: string; // Formatted display price
    currency: string; // 'USD', 'EUR', etc.
    is_estimate: boolean; // Whether price is estimated
  };
  
  // Service Details
  service_details: {
    estimated_duration: string; // e.g., "2-3 hours", "45 mins"
    duration_minutes?: number; // Machine-readable duration
    difficulty_level?: 'basic' | 'standard' | 'deep' | 'premium';
    included_tasks?: string[]; // List of tasks included
    required_equipment?: string[]; // Equipment needed
    room_types?: string[]; // Applicable rooms
  };
  
  // Quality Indicators
  rating: {
    average_rating: number; // 0-5 scale
    total_reviews: number;
    rating_display: string; // e.g., "4.9", "4.8 (234 reviews)"
    trust_indicators?: string[]; // ['verified', 'background_checked', 'insured']
  };
  
  // Provider Information (for cleaner-specific cards)
  provider?: {
    cleaner_id: string;
    cleaner_name: string;
    cleaner_avatar?: string;
    company_name?: string;
    specialties: string[];
    is_verified: boolean;
    response_time?: string; // "Usually responds in 2 hours"
  };
  
  // Engagement Metrics (for video cards)
  engagement?: {
    view_count: number;
    like_count: number;
    comment_count: number;
    share_count: number;
    view_display: string; // "15.4K views"
    engagement_rate?: number; // Calculated metric
  };
  
  // Availability & Booking
  availability: {
    is_available: boolean;
    next_available_slot?: string; // ISO date string
    booking_window: string; // "Same day", "Next day", "Within 3 days"
    is_emergency_service: boolean;
    advance_notice_required?: string; // "24 hours", "Same day OK"
  };
  
  // Metadata
  metadata: {
    created_at: string; // ISO date string
    updated_at: string;
    is_featured: boolean;
    is_promoted: boolean;
    popularity_score?: number; // Algorithm ranking
    seasonal_relevance?: number; // Spring cleaning, holiday prep, etc.
    tags: string[]; // Searchable tags
    location_specific?: boolean; // Requires specific location
  };
  
  // Action Configuration
  actions: {
    primary_action: 'book_now' | 'browse_cleaners' | 'view_details' | 'watch_video';
    primary_action_text: string; // "Book Now", "Browse Cleaners", "View Details"
    secondary_action?: 'save' | 'share' | 'compare' | 'contact';
    secondary_action_text?: string;
    navigation_params?: Record<string, any>; // Parameters for navigation
  };
}

/**
 * Service Card Display Variants
 */
export type ServiceCardVariant = 
  | 'compact'        // Small card for grids
  | 'featured'       // Large hero card
  | 'list'          // Horizontal list item
  | 'video'         // Video-first display
  | 'comparison'    // Side-by-side comparison
  | 'minimal';      // Text-focused minimal design

/**
 * Service Card Theme
 */
export interface ServiceCardTheme {
  variant: ServiceCardVariant;
  primary_color: string;
  accent_color: string;
  text_color: string;
  background_style: 'gradient' | 'solid' | 'image_overlay';
  corner_radius: number;
  shadow_intensity: 'none' | 'light' | 'medium' | 'strong';
  animation_style?: 'none' | 'hover' | 'pulse' | 'glow';
}

/**
 * Factory Functions for Different Card Types
 */

// Kitchen Deep Clean Example
export const createKitchenDeepCleanCard = (): ServiceCardData => ({
  id: 'kitchen-deep-clean-001',
  type: 'service',
  title: 'Kitchen Deep Clean',
  description: 'Professional kitchen cleaning with degreasing, appliance cleaning, and sanitization',
  category: 'kitchen',
  
  media: {
    primary_image_url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop',
    fallback_image_url: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=300&fit=crop',
    media_type: 'image',
    alt_text: 'Professional kitchen deep cleaning service'
  },
  
  pricing: {
    base_price: 8000, // $80.00 in cents
    price_range: '$80-120',
    price_display: 'From $80',
    currency: 'USD',
    is_estimate: true
  },
  
  service_details: {
    estimated_duration: '2-3 hours',
    duration_minutes: 150,
    difficulty_level: 'deep',
    included_tasks: [
      'Degrease all surfaces',
      'Clean inside/outside appliances',
      'Sanitize countertops and sink',
      'Organize cabinets',
      'Deep clean stovetop and oven'
    ],
    room_types: ['kitchen']
  },
  
  rating: {
    average_rating: 4.9,
    total_reviews: 234,
    rating_display: '4.9',
    trust_indicators: ['verified', 'background_checked', 'insured']
  },
  
  availability: {
    is_available: true,
    booking_window: 'Same day',
    is_emergency_service: false,
    advance_notice_required: '2 hours'
  },
  
  metadata: {
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_featured: true,
    is_promoted: false,
    popularity_score: 0.95,
    tags: ['kitchen', 'deep-clean', 'appliances', 'degreasing', 'sanitization'],
    location_specific: false
  },
  
  actions: {
    primary_action: 'browse_cleaners',
    primary_action_text: 'Browse Cleaners',
    secondary_action: 'save',
    secondary_action_text: 'Save',
    navigation_params: {
      category: 'kitchen',
      service_type: 'deep_clean'
    }
  }
});

// Video Card Example
export const createVideoServiceCard = (videoData: any): ServiceCardData => ({
  id: `video-${videoData.id}`,
  type: 'video',
  title: videoData.title,
  description: videoData.description,
  category: videoData.category,
  
  media: {
    primary_image_url: videoData.thumbnail_url,
    video_url: videoData.media_url,
    media_type: 'video',
    alt_text: `Video: ${videoData.title}`
  },
  
  pricing: {
    price_display: videoData.metadata?.pricing_display || 'Contact for pricing',
    currency: 'USD',
    is_estimate: true
  },
  
  service_details: {
    estimated_duration: videoData.metadata?.duration_display || 'Varies',
    duration_minutes: videoData.metadata?.duration_minutes
  },
  
  rating: {
    average_rating: 4.8,
    total_reviews: 0,
    rating_display: '4.8'
  },
  
  provider: {
    cleaner_id: videoData.user.id,
    cleaner_name: videoData.user.name,
    cleaner_avatar: videoData.user.avatar_url,
    specialties: [videoData.category],
    is_verified: true
  },
  
  engagement: {
    view_count: videoData.view_count,
    like_count: videoData.like_count,
    comment_count: videoData.comment_count || 0,
    share_count: videoData.share_count || 0,
    view_display: formatCount(videoData.view_count)
  },
  
  availability: {
    is_available: true,
    booking_window: 'Contact cleaner',
    is_emergency_service: false
  },
  
  metadata: {
    created_at: videoData.created_at,
    updated_at: videoData.created_at,
    is_featured: false,
    is_promoted: false,
    tags: [videoData.category, 'video', 'professional'],
    location_specific: false
  },
  
  actions: {
    primary_action: 'view_details',
    primary_action_text: 'View Cleaner',
    secondary_action: 'share',
    secondary_action_text: 'Share',
    navigation_params: {
      cleanerId: videoData.user.id,
      videoId: videoData.id
    }
  }
});

// Helper function for formatting numbers
function formatCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

/**
 * Validation schema for service cards
 */
export const validateServiceCard = (card: ServiceCardData): boolean => {
  // Required fields validation
  if (!card.id || !card.title || !card.category) {
    return false;
  }
  
  // Media validation
  if (!card.media.primary_image_url) {
    return false;
  }
  
  // Pricing validation
  if (!card.pricing.price_display) {
    return false;
  }
  
  // Rating validation
  if (card.rating.average_rating < 0 || card.rating.average_rating > 5) {
    return false;
  }
  
  return true;
};

/**
 * Transform legacy data to new format
 */
export const transformLegacyServiceData = (legacyData: any): ServiceCardData => {
  return {
    id: legacyData.id,
    type: 'service',
    title: legacyData.name || legacyData.title,
    description: legacyData.description,
    category: legacyData.category,
    
    media: {
      primary_image_url: legacyData.image || legacyData.image_url,
      media_type: 'image'
    },
    
    pricing: {
      price_display: legacyData.price_range || `$${legacyData.base_price}`,
      currency: 'USD',
      is_estimate: true
    },
    
    service_details: {
      estimated_duration: legacyData.estimated_duration || 'Contact for details'
    },
    
    rating: {
      average_rating: legacyData.rating || 4.5,
      total_reviews: legacyData.reviews || 0,
      rating_display: (legacyData.rating || 4.5).toString()
    },
    
    availability: {
      is_available: true,
      booking_window: 'Contact for availability',
      is_emergency_service: false
    },
    
    metadata: {
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_featured: false,
      is_promoted: false,
      tags: [legacyData.category],
      location_specific: false
    },
    
    actions: {
      primary_action: 'browse_cleaners',
      primary_action_text: 'Browse Cleaners'
    }
  };
};
