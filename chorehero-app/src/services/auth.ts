import { supabase } from './supabase';
import { User, AuthUser } from '../types/user';
import { ApiResponse } from '../types/api';
import { VALIDATION_RULES } from '../utils/constants';

export interface AuthRequest {
  phone: string;
  verification_code?: string;
}

export interface PhoneVerificationResponse {
  success: boolean;
  message: string;
  requires_verification: boolean;
}

export interface SignUpRequest extends AuthRequest {
  name: string;
  role: 'customer' | 'cleaner';
  email?: string;
}

class AuthService {
  // Phone number validation
  private validatePhoneNumber(phone: string): boolean {
    return VALIDATION_RULES.phone.pattern.test(phone);
  }

  // Format phone number to E.164 format
  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Add +1 if not present for US numbers
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned}`;
    }
    
    return phone; // Return as-is if doesn't match expected format
  }

  // Send phone verification code
  async sendVerificationCode(phone: string): Promise<ApiResponse<PhoneVerificationResponse>> {
    try {
      if (!this.validatePhoneNumber(phone)) {
        return {
          success: false,
          data: {
            success: false,
            message: VALIDATION_RULES.phone.message,
            requires_verification: false,
          },
          error: 'Invalid phone number format',
        };
      }

      const formattedPhone = this.formatPhoneNumber(phone);

      const { data, error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
        options: {
          channel: 'sms',
        },
      });

      if (error) {
        return {
          success: false,
          data: {
            success: false,
            message: 'Failed to send verification code. Please try again.',
            requires_verification: false,
          },
          error: error.message,
        };
      }

      return {
        success: true,
        data: {
          success: true,
          message: 'Verification code sent successfully',
          requires_verification: true,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: {
          success: false,
          message: 'Network error. Please check your connection.',
          requires_verification: false,
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Verify phone number with code
  async verifyPhoneCode(phone: string, code: string): Promise<ApiResponse<AuthUser | null>> {
    try {
      const formattedPhone = this.formatPhoneNumber(phone);

      const { data, error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: code,
        type: 'sms',
      });

      if (error) {
        return {
          success: false,
          data: null,
          error: 'Invalid verification code. Please try again.',
        };
      }

      if (!data.user) {
        return {
          success: false,
          data: null,
          error: 'Verification failed. Please try again.',
        };
      }

      // Check if user profile exists
      try {
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select(`
            *,
            customer_profiles(*),
            cleaner_profiles(*)
          `)
          .eq('id', data.user.id)
          .single();
        
        if (profileError) throw profileError;
        
        return {
          success: true,
          data: {
            user: userProfile as User,
            session: {
              access_token: data.session?.access_token || '',
              refresh_token: data.session?.refresh_token || '',
              expires_at: data.session?.expires_at || 0,
            },
          },
        };
      } catch (profileError) {
        // User exists in auth but no profile - needs onboarding
        return {
          success: true,
          data: null, // Indicates need for onboarding
        };
      }
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Verification failed',
      };
    }
  }

  // Complete user registration/onboarding
  async completeRegistration(
    userId: string,
    userData: {
      name: string;
      role: 'customer' | 'cleaner';
      email?: string;
      phone: string;
    }
  ): Promise<ApiResponse<User>> {
    try {
      // Create user profile
      const { data: userProfile, error: userError } = await supabase
        .from('users')
        .insert({
          id: userId,
          phone: userData.phone,
          email: userData.email,
          name: userData.name,
          role: userData.role,
        })
        .select()
        .single();

      if (userError) {
        throw userError;
      }

      // Create role-specific profile
      if (userData.role === 'customer') {
        const { error: customerError } = await supabase
          .from('customer_profiles')
          .insert({
            user_id: userId,
          });

        if (customerError) {
          throw customerError;
        }
      } else if (userData.role === 'cleaner') {
        const { error: cleanerError } = await supabase
          .from('cleaner_profiles')
          .insert({
            user_id: userId,
            hourly_rate: 25.00, // Default rate
          });

        if (cleanerError) {
          throw cleanerError;
        }
      }

      // Fetch complete profile
      const { data: completeProfile, error: fetchError } = await supabase
        .from('users')
        .select(`
          *,
          customer_profiles(*),
          cleaner_profiles(*)
        `)
        .eq('id', userId)
        .single();
      
      if (fetchError) throw fetchError;

      return {
        success: true,
        data: completeProfile as User,
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Registration failed',
      };
    }
  }

  // Get current authenticated user
  async getCurrentUser(): Promise<ApiResponse<AuthUser | null>> {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session?.user) {
        return {
          success: true,
          data: null,
        };
      }

      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select(`
          *,
          customer_profiles(*),
          cleaner_profiles(*)
        `)
        .eq('id', session.user.id)
        .single();
      
      if (profileError) {
        if (profileError.code === 'PGRST116') {
          return {
            success: true,
            data: null,
          };
        }
        throw profileError;
      }

      return {
        success: true,
        data: {
          user: userProfile as User,
          session: {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_at: session.expires_at || 0,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Failed to get current user',
      };
    }
  }

  // Sign out
  async signOut(): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      return {
        success: true,
        data: undefined,
      };
    } catch (error) {
      return {
        success: false,
        data: undefined,
        error: error instanceof Error ? error.message : 'Sign out failed',
      };
    }
  }

  // Update user profile
  async updateProfile(
    userId: string,
    updates: Partial<{
      name: string;
      email: string;
      username: string;
      avatar_url: string;
    }>
  ): Promise<ApiResponse<User>> {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      const { data: completeProfile, error: fetchError2 } = await supabase
        .from('users')
        .select(`
          *,
          customer_profiles(*),
          cleaner_profiles(*)
        `)
        .eq('id', userId)
        .single();
      
      if (fetchError2) throw fetchError2;

      return {
        success: true,
        data: completeProfile as User,
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Profile update failed',
      };
    }
  }

  // Check if phone number is already registered
  async checkPhoneExists(phone: string): Promise<boolean> {
    try {
      const formattedPhone = this.formatPhoneNumber(phone);
      
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('phone', formattedPhone)
        .limit(1);

      if (error) {
        console.error('Error checking phone existence:', error);
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      console.error('Error checking phone existence:', error);
      return false;
    }
  }

  // Refresh session
  async refreshSession(): Promise<ApiResponse<AuthUser | null>> {
    try {
      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        throw error;
      }

      if (!data.session?.user) {
        return {
          success: true,
          data: null,
        };
      }

      // Fetch user profile from database
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select(`
          *,
          customer_profiles(*),
          cleaner_profiles(*)
        `)
        .eq('id', data.session.user.id)
        .single();
      
      if (profileError) {
        console.log('ℹ️ User profile not found during refresh - may need onboarding');
        // Return success with null to indicate user needs onboarding
        return {
          success: true,
          data: null,
        };
      }

      return {
        success: true,
        data: {
          user: userProfile as User,
          session: {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at: data.session.expires_at || 0,
          },
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Session refresh failed';
      
      // Handle specific refresh token errors more gracefully
      if (errorMessage.includes('refresh') || errorMessage.includes('token')) {
        console.log('🔄 Refresh token error, session will be cleared');
        return {
          success: false,
          data: null,
          error: 'Invalid Refresh Token: Session expired',
        };
      }
      
      return {
        success: false,
        data: null,
        error: errorMessage,
      };
    }
  }

  // Get cleaner profile with detailed information
  async getCleanerProfile(userId: string): Promise<ApiResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('cleaner_profiles')
        .select(`
          *,
          users!inner(*)
        `)
        .eq('user_id', userId)
        .single();

      if (error) {
        return {
          success: false,
          data: null,
          error: error.message,
        };
      }

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Failed to load cleaner profile',
      };
    }
  }

  // Upload cleaner video to Supabase Storage
  async uploadCleanerVideo(userId: string, videoUri: string): Promise<ApiResponse<{ video_url: string }>> {
    try {
      // Read file as base64
      const response = await fetch(videoUri);
      const blob = await response.blob();
      
      const fileName = `cleaner_videos/${userId}_${Date.now()}.mp4`;
      
      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, blob, {
          contentType: 'video/mp4',
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);

      if (!urlData.publicUrl) {
        throw new Error('Failed to get video URL');
      }

      // Update cleaner profile with video URL
      const { error: updateError } = await supabase
        .from('cleaner_profiles')
        .update({
          video_profile_url: urlData.publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (updateError) {
        throw updateError;
      }

      return {
        success: true,
        data: { video_url: urlData.publicUrl },
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Failed to upload video',
      };
    }
  }

  // Initiate background check process
  async initiateBackgroundCheck(
    userId: string,
    personalInfo: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
    }
  ): Promise<ApiResponse<{ check_id: string }>> {
    try {
      // In a real app, this would integrate with Checkr or similar service
      // For now, we'll simulate the process
      const mockCheckId = `check_${userId}_${Date.now()}`;
      
      // Update cleaner profile with background check status
      const { error: updateError } = await supabase
        .from('cleaner_profiles')
        .update({
          background_check_status: 'completed', // In real app, this would be 'pending'
          background_check_id: mockCheckId,
          background_check_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (updateError) {
        throw updateError;
      }

      return {
        success: true,
        data: { check_id: mockCheckId },
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Failed to initiate background check',
      };
    }
  }

  // Update cleaner profile information
  async updateCleanerProfile(
    userId: string,
    profileData: {
      name?: string;
      bio?: string;
      experience?: string;
      specialties?: string[];
      hourly_rate?: number;
    }
  ): Promise<ApiResponse<void>> {
    try {
      // Update user table if name is provided
      if (profileData.name) {
        const { error: userError } = await supabase
          .from('users')
          .update({
            name: profileData.name,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);

        if (userError) {
          throw userError;
        }
      }

      // Update cleaner profile
      const cleanerUpdates: any = {
        updated_at: new Date().toISOString(),
      };

      if (profileData.bio) cleanerUpdates.bio = profileData.bio;
      if (profileData.experience) cleanerUpdates.experience = profileData.experience;
      if (profileData.specialties) cleanerUpdates.specialties = profileData.specialties;
      if (profileData.hourly_rate) cleanerUpdates.hourly_rate = profileData.hourly_rate;

      const { error: cleanerError } = await supabase
        .from('cleaner_profiles')
        .update(cleanerUpdates)
        .eq('user_id', userId);

      if (cleanerError) {
        throw cleanerError;
      }

      return {
        success: true,
        data: undefined,
      };
    } catch (error) {
      return {
        success: false,
        data: undefined,
        error: error instanceof Error ? error.message : 'Failed to update cleaner profile',
      };
    }
  }
}

export const authService = new AuthService();

// Auth state listener
export const onAuthStateChange = (callback: (user: AuthUser | null) => void) => {
  return supabase.auth.onAuthStateChange(async (event: any, session: any) => {
    if (event === 'SIGNED_IN' && session?.user) {
      try {
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select(`
            *,
            customer_profiles(*),
            cleaner_profiles(*)
          `)
          .eq('id', session.user.id)
          .single();
      
        if (profileError) {
          if (profileError.code === 'PGRST116') {
            console.log('ℹ️ User profile not found - needs onboarding');
            callback(null);
            return;
          }
          throw profileError;
        }
        callback({
          user: userProfile as User,
          session: {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_at: session.expires_at || 0,
          },
        });
      } catch (error) {
        console.error('Error fetching user profile:', error);
        callback(null);
      }
    } else if (event === 'SIGNED_OUT') {
      callback(null);
    }
  });
};