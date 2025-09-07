/**
 * Service Card Service
 * Manages service card data, templates, and transformations
 */

import { ServiceCardData, transformLegacyServiceData, validateServiceCard } from '../types/serviceCard';

class ServiceCardService {
  
  /**
   * Predefined service card templates for consistency
   */
  private readonly serviceTemplates: Record<string, Partial<ServiceCardData>> = {
    kitchen: {
      category: 'kitchen',
      media: {
        primary_image_url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop',
        fallback_image_url: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=300&fit=crop',
        media_type: 'image',
      },
      service_details: {
        included_tasks: [
          'Degrease all surfaces',
          'Clean inside/outside appliances',
          'Sanitize countertops and sink',
          'Organize cabinets',
          'Deep clean stovetop and oven'
        ],
        room_types: ['kitchen']
      },
      metadata: {
        tags: ['kitchen', 'deep-clean', 'appliances', 'degreasing', 'sanitization']
      }
    },
    
    bathroom: {
      category: 'bathroom',
      media: {
        primary_image_url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400&h=300&fit=crop',
        fallback_image_url: 'https://images.unsplash.com/photo-1620626011761-996317b8d101?w=400&h=300&fit=crop',
        media_type: 'image',
      },
      service_details: {
        included_tasks: [
          'Scrub and disinfect toilet',
          'Clean shower/tub and remove soap scum',
          'Polish mirrors and fixtures',
          'Mop and sanitize floors',
          'Organize toiletries'
        ],
        room_types: ['bathroom']
      },
      metadata: {
        tags: ['bathroom', 'deep-clean', 'sanitization', 'grout-cleaning', 'fixtures']
      }
    },
    
    living_room: {
      category: 'living_room',
      media: {
        primary_image_url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=300&fit=crop',
        fallback_image_url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=300&fit=crop',
        media_type: 'image',
      },
      service_details: {
        included_tasks: [
          'Vacuum and clean carpets',
          'Dust furniture and electronics',
          'Clean upholstery',
          'Organize entertainment center',
          'Polish wood surfaces'
        ],
        room_types: ['living_room', 'family_room']
      },
      metadata: {
        tags: ['living-room', 'carpet-cleaning', 'upholstery', 'dusting', 'organizing']
      }
    },
    
    bedroom: {
      category: 'bedroom',
      media: {
        primary_image_url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&h=300&fit=crop',
        fallback_image_url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=300&fit=crop',
        media_type: 'image',
      },
      service_details: {
        included_tasks: [
          'Change and wash bedding',
          'Vacuum mattress and floors',
          'Dust surfaces and organize',
          'Clean mirrors and windows',
          'Organize closet space'
        ],
        room_types: ['bedroom', 'master_bedroom']
      },
      metadata: {
        tags: ['bedroom', 'bedding', 'mattress-cleaning', 'closet-organization', 'dusting']
      }
    }
  };

  /**
   * Create a standardized service card
   */
  createServiceCard(params: {
    id: string;
    title: string;
    description: string;
    category: string;
    base_price?: number;
    price_range?: string;
    duration?: string;
    rating?: number;
    reviews?: number;
    custom_image?: string;
    cleaner_id?: string;
    cleaner_name?: string;
    is_featured?: boolean;
  }): ServiceCardData {
    const template = this.serviceTemplates[params.category] || this.serviceTemplates.kitchen;
    
    const serviceCard: ServiceCardData = {
      id: params.id,
      type: 'service',
      title: params.title,
      description: params.description,
      category: params.category,
      
      media: {
        primary_image_url: params.custom_image || template.media!.primary_image_url!,
        fallback_image_url: template.media!.fallback_image_url,
        media_type: 'image',
        alt_text: `${params.title} service`
      },
      
      pricing: {
        base_price: params.base_price,
        price_range: params.price_range || (params.base_price ? `From $${params.base_price / 100}` : 'Contact for pricing'),
        price_display: params.price_range || (params.base_price ? `From $${params.base_price / 100}` : 'Contact for pricing'),
        currency: 'USD',
        is_estimate: true
      },
      
      service_details: {
        estimated_duration: params.duration || '2-3 hours',
        duration_minutes: this.parseDurationToMinutes(params.duration || '2-3 hours'),
        difficulty_level: 'standard',
        included_tasks: template.service_details?.included_tasks || [],
        room_types: template.service_details?.room_types || [params.category]
      },
      
      rating: {
        average_rating: params.rating || 4.8,
        total_reviews: params.reviews || 0,
        rating_display: (params.rating || 4.8).toString(),
        trust_indicators: ['verified', 'background_checked']
      },
      
      provider: params.cleaner_id ? {
        cleaner_id: params.cleaner_id,
        cleaner_name: params.cleaner_name || 'Professional Cleaner',
        specialties: [params.category],
        is_verified: true
      } : undefined,
      
      availability: {
        is_available: true,
        booking_window: 'Same day',
        is_emergency_service: false,
        advance_notice_required: '2 hours'
      },
      
      metadata: {
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_featured: params.is_featured || false,
        is_promoted: false,
        popularity_score: 0.8,
        tags: template.metadata?.tags || [params.category],
        location_specific: false
      },
      
      actions: {
        primary_action: 'browse_cleaners',
        primary_action_text: 'Browse Cleaners',
        secondary_action: 'save',
        secondary_action_text: 'Save',
        navigation_params: {
          category: params.category,
          service_type: 'standard'
        }
      }
    };

    return serviceCard;
  }

  /**
   * Create video-based service card
   */
  createVideoServiceCard(videoData: {
    id: string;
    title: string;
    description: string;
    category: string;
    video_url: string;
    thumbnail_url: string;
    cleaner_id: string;
    cleaner_name: string;
    cleaner_avatar?: string;
    view_count: number;
    like_count: number;
    pricing?: { display: string; base_price?: number };
    duration?: string;
  }): ServiceCardData {
    return {
      id: `video-${videoData.id}`,
      type: 'video',
      title: videoData.title,
      description: videoData.description,
      category: videoData.category,
      
      media: {
        primary_image_url: videoData.thumbnail_url,
        video_url: videoData.video_url,
        media_type: 'video',
        alt_text: `Video: ${videoData.title}`
      },
      
      pricing: {
        price_display: videoData.pricing?.display || 'Contact for pricing',
        base_price: videoData.pricing?.base_price,
        currency: 'USD',
        is_estimate: true
      },
      
      service_details: {
        estimated_duration: videoData.duration || 'Varies',
        duration_minutes: this.parseDurationToMinutes(videoData.duration || 'Varies')
      },
      
      rating: {
        average_rating: 4.8,
        total_reviews: 0,
        rating_display: '4.8'
      },
      
      provider: {
        cleaner_id: videoData.cleaner_id,
        cleaner_name: videoData.cleaner_name,
        cleaner_avatar: videoData.cleaner_avatar,
        specialties: [videoData.category],
        is_verified: true
      },
      
      engagement: {
        view_count: videoData.view_count,
        like_count: videoData.like_count,
        comment_count: 0,
        share_count: 0,
        view_display: this.formatCount(videoData.view_count)
      },
      
      availability: {
        is_available: true,
        booking_window: 'Contact cleaner',
        is_emergency_service: false
      },
      
      metadata: {
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
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
          cleanerId: videoData.cleaner_id,
          videoId: videoData.id
        }
      }
    };
  }

  /**
   * Transform multiple data sources into service cards
   */
  transformToServiceCards(data: any[], source: 'guest_services' | 'database_services' | 'video_content'): ServiceCardData[] {
    return data.map(item => {
      switch (source) {
        case 'guest_services':
          return this.createServiceCard({
            id: item.id,
            title: item.name,
            description: item.description,
            category: item.category,
            price_range: item.price_range,
            rating: item.rating,
            custom_image: item.image_url,
            is_featured: true
          });
          
        case 'database_services':
          return this.createServiceCard({
            id: item.id,
            title: item.name,
            description: item.description,
            category: item.category,
            base_price: item.base_price ? item.base_price * 100 : undefined, // Convert to cents
            duration: item.estimated_duration ? `${item.estimated_duration} hours` : undefined,
            rating: item.rating,
            reviews: item.reviews,
            custom_image: item.image
          });
          
        case 'video_content':
          return this.createVideoServiceCard({
            id: item.id,
            title: item.title,
            description: item.description,
            category: item.category || 'general',
            video_url: item.media_url,
            thumbnail_url: item.thumbnail_url || item.media_url,
            cleaner_id: item.user.id,
            cleaner_name: item.user.name,
            cleaner_avatar: item.user.avatar_url,
            view_count: item.view_count || 0,
            like_count: item.like_count || 0,
            pricing: item.metadata?.pricing_display ? {
              display: item.metadata.pricing_display,
              base_price: item.metadata.base_price
            } : undefined,
            duration: item.metadata?.duration_display
          });
          
        default:
          return transformLegacyServiceData(item);
      }
    }).filter(card => validateServiceCard(card));
  }

  /**
   * Get predefined service card templates
   */
  getServiceTemplates(): Record<string, ServiceCardData> {
    return {
      kitchen_deep_clean: this.createServiceCard({
        id: 'template-kitchen-deep-clean',
        title: 'Kitchen Deep Clean',
        description: 'Professional kitchen cleaning with degreasing, appliance cleaning, and sanitization',
        category: 'kitchen',
        price_range: '$80-120',
        duration: '2-3 hours',
        rating: 4.9,
        reviews: 234,
        is_featured: true
      }),
      
      bathroom_deep_clean: this.createServiceCard({
        id: 'template-bathroom-deep-clean',
        title: 'Bathroom Deep Clean',
        description: 'Complete bathroom sanitization including grout cleaning and tile restoration',
        category: 'bathroom',
        price_range: '$60-90',
        duration: '1-2 hours',
        rating: 4.8,
        reviews: 189,
        is_featured: true
      }),
      
      living_room_refresh: this.createServiceCard({
        id: 'template-living-room-refresh',
        title: 'Living Room Refresh',
        description: 'Carpet cleaning, upholstery care, and complete living space organization',
        category: 'living_room',
        price_range: '$90-150',
        duration: '2-4 hours',
        rating: 4.7,
        reviews: 156,
        is_featured: true
      }),
      
      bedroom_refresh: this.createServiceCard({
        id: 'template-bedroom-refresh',
        title: 'Bedroom Refresh',
        description: 'Mattress cleaning, closet organization, and thorough dusting service',
        category: 'bedroom',
        price_range: '$70-100',
        duration: '1-3 hours',
        rating: 4.6,
        reviews: 128,
        is_featured: true
      })
    };
  }

  /**
   * Parse duration string to minutes
   */
  private parseDurationToMinutes(duration: string): number {
    const hourMatch = duration.match(/(\d+)-?(\d+)?\s*hours?/i);
    const minMatch = duration.match(/(\d+)\s*mins?/i);
    
    if (hourMatch) {
      const min = parseInt(hourMatch[1]);
      const max = hourMatch[2] ? parseInt(hourMatch[2]) : min;
      return Math.round((min + max) / 2) * 60;
    }
    
    if (minMatch) {
      return parseInt(minMatch[1]);
    }
    
    return 120; // Default 2 hours
  }

  /**
   * Format count numbers (1.2K, 5.6M, etc.)
   */
  private formatCount(count: number): string {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  }

  /**
   * Validate and clean service card data
   */
  validateAndClean(cards: ServiceCardData[]): ServiceCardData[] {
    return cards
      .filter(card => validateServiceCard(card))
      .map(card => this.ensureDefaults(card));
  }

  /**
   * Ensure all required defaults are present
   */
  private ensureDefaults(card: ServiceCardData): ServiceCardData {
    return {
      ...card,
      media: {
        media_type: 'image',
        ...card.media,
        fallback_image_url: card.media.fallback_image_url || 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=300&fit=crop'
      },
      pricing: {
        currency: 'USD',
        is_estimate: true,
        ...card.pricing
      },
      rating: {
        average_rating: 4.5,
        total_reviews: 0,
        rating_display: '4.5',
        ...card.rating
      },
      availability: {
        is_available: true,
        booking_window: 'Contact for availability',
        is_emergency_service: false,
        ...card.availability
      },
      metadata: {
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_featured: false,
        is_promoted: false,
        tags: [],
        location_specific: false,
        ...card.metadata
      },
      actions: {
        primary_action: 'browse_cleaners',
        primary_action_text: 'Browse Cleaners',
        ...card.actions
      }
    };
  }
}

export const serviceCardService = new ServiceCardService();
