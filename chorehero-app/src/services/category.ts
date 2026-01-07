import { supabase } from './supabase';
import { ApiResponse } from '../types/api';

export interface ServiceCategory {
  id: string;
  name: string;
  display_name: string;
  description: string;
  icon_name: string;
  is_active: boolean;
  sort_order: number;
}

export interface CategoryService {
  id: string;
  name: string;
  description: string;
  base_price: number;
  estimated_duration: number;
  room_type: string;
  category: string;
  included_tasks: string[];
  image?: string;
  rating?: number;
  reviews?: number;
}

export interface CategoryCleaner {
  id: string;
  name: string;
  avatar_url: string;
  rating_average: number;
  total_jobs: number;
  hourly_rate: number;
  specialties: string[];
  bio: string;
  verification_status: string;
}

class CategoryServiceClass {
  // Get all available categories
  async getCategories(): Promise<ApiResponse<ServiceCategory[]>> {
    try {
      const { data, error } = await supabase
        .from('service_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      return {
        success: true,
        data: data || [],
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Failed to fetch categories',
      };
    }
  }

  // Get services by category/room type
  async getServicesByCategory(category: string): Promise<ApiResponse<CategoryService[]>> {
    try {
      let query = supabase
        .from('services')
        .select('*')
        .eq('is_active', true);

      // Handle special case for 'Featured' - get most popular across all categories
      if (category.toLowerCase() === 'featured') {
        // For featured, we'll get a mix of popular services from different rooms
        query = query.in('room_type', ['kitchen', 'bathroom', 'living_room']);
      } else {
        // Map UI category names to database room_type values
        const roomTypeMap: { [key: string]: string } = {
          'Kitchen': 'kitchen',
          'Bathroom': 'bathroom',
          'Living Room': 'living_room',
          'Bedroom': 'bedroom',
          'Outdoors': 'outdoors',
        };

        const roomType = roomTypeMap[category] || category.toLowerCase().replace(' ', '_');
        query = query.eq('room_type', roomType);
      }

      const { data, error } = await query.order('base_price', { ascending: true });

      if (error) throw error;

      // Add mock images and ratings for now (in production, these would come from the database)
      const servicesWithImages = (data || []).map((service: any) => ({
        ...service,
        image: this.getServiceImage(service.room_type, service.name),
        rating: 4.5 + Math.random() * 0.5, // Mock rating between 4.5-5.0
        reviews: Math.floor(Math.random() * 400) + 100, // Mock reviews 100-500
      }));

      return {
        success: true,
        data: servicesWithImages,
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Failed to fetch services',
      };
    }
  }

  // Get cleaners by specialty matching the selected category
  async getCleanersBySpecialty(category: string): Promise<ApiResponse<CategoryCleaner[]>> {
    try {
      let specialtyFilter: string[];

      // Handle special case for 'Featured' - get top-rated cleaners across all specialties
      if (category.toLowerCase() === 'featured') {
        specialtyFilter = ['Kitchen', 'Bathroom', 'Living Room', 'Bedroom', 'Outdoors'];
      } else {
        specialtyFilter = [category];
      }

      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          name,
          avatar_url,
          cleaner_profiles (
            rating_average,
            total_jobs,
            hourly_rate,
            specialties,
            bio,
            verification_status
          )
        `)
        .eq('role', 'cleaner')
        .eq('is_active', true)
        .not('cleaner_profiles', 'is', null);

      if (error) throw error;

      // Filter by specialty overlap and transform data
      const filteredCleaners = (data || [])
        .filter((cleaner: any) => {
          const specialties = cleaner.cleaner_profiles?.specialties || [];
          return specialtyFilter.some(specialty => 
            specialties.includes(specialty)
          );
        })
        .map((cleaner: any) => ({
          id: cleaner.id,
          name: cleaner.name,
          avatar_url: cleaner.avatar_url || 'https://randomuser.me/api/portraits/women/32.jpg',
          rating_average: cleaner.cleaner_profiles?.rating_average || 4.5,
          total_jobs: cleaner.cleaner_profiles?.total_jobs || 0,
          hourly_rate: cleaner.cleaner_profiles?.hourly_rate || 25,
          specialties: cleaner.cleaner_profiles?.specialties || [],
          bio: cleaner.cleaner_profiles?.bio || 'Professional cleaner',
          verification_status: cleaner.cleaner_profiles?.verification_status || 'verified',
        }))
        .filter((cleaner: any) => cleaner.verification_status === 'verified')
        .sort((a: any, b: any) => b.rating_average - a.rating_average)
        .slice(0, 10); // Limit to top 10 cleaners

      return {
        success: true,
        data: filteredCleaners,
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Failed to fetch cleaners',
      };
    }
  }

  // Get recommended services for a user based on category and booking history
  async getRecommendedServices(userId?: string, category?: string): Promise<ApiResponse<CategoryService[]>> {
    try {
      // For now, we'll return a curated list based on category
      // In a full implementation, this would analyze user booking history
      
      let query = supabase
        .from('services')
        .select('*')
        .eq('is_active', true);

      if (category && category.toLowerCase() !== 'featured') {
        const roomTypeMap: { [key: string]: string } = {
          'Kitchen': 'kitchen',
          'Bathroom': 'bathroom',
          'Living Room': 'living_room',
          'Bedroom': 'bedroom',
          'Outdoors': 'outdoors',
        };

        const roomType = roomTypeMap[category] || category.toLowerCase().replace(' ', '_');
        query = query.eq('room_type', roomType);
      }

      const { data, error } = await query
        .order('base_price', { ascending: false }) // Show premium services first for recommendations
        .limit(6);

      if (error) throw error;

      // Add mock images and ratings
      const servicesWithImages = (data || []).map((service: any) => ({
        ...service,
        image: this.getServiceImage(service.room_type, service.name),
        rating: 4.6 + Math.random() * 0.4, // Slightly higher ratings for recommended
        reviews: Math.floor(Math.random() * 300) + 150, // Mock reviews 150-450
      }));

      return {
        success: true,
        data: servicesWithImages,
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Failed to fetch recommended services',
      };
    }
  }

  // Helper function to get service images (mock implementation)
  private getServiceImage(roomType: string, serviceName: string): string {
    const imageMap: { [key: string]: string } = {
      'kitchen': 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
      'bathroom': 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
      'living_room': 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
      'bedroom': 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
      'outdoors': 'https://images.unsplash.com/photo-1596815064285-45ed8a9c0463?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
      'general': 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
    };

    return imageMap[roomType] || imageMap['general'];
  }
}

export const categoryService = new CategoryServiceClass(); 