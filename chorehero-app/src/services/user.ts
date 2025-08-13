import { supabase } from './supabase';

export interface User {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  created_at: string;
  account_type?: 'customer' | 'cleaner';
  profile_completed: boolean;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
  requiresSignIn?: boolean;
}

class UserService {
  // Deprecated: we no longer check existence via public.users to avoid RLS before auth
  // Supabase auth will return a clear error if the email already exists

  // Sign up new user
  async signUp(email: string, password: string): Promise<AuthResponse> {
    try {
      // Create real Supabase Auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.toLowerCase(),
        password: password,
        options: {
          emailRedirectTo: undefined, // Skip email confirmation for beta testing
          data: {
            confirm: true // Auto-confirm for beta testing
          }
        }
      });

      if (authError) {
        console.error('Supabase auth error:', authError);
        return {
          success: false,
          error: authError.message || 'Failed to create account. Please try again.'
        };
      }

      if (!authData.user) {
        return {
          success: false,
          error: 'Failed to create account. Please try again.'
        };
      }

      // If Supabase didn't return a session, attempt immediate sign-in (beta convenience)
      if (authData.user && !authData.session) {
        try {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: email.toLowerCase(),
            password,
          });
          if (signInError) {
            return {
              success: false,
              error: signInError.message || 'Please check your email for a confirmation link, then sign in.',
              requiresSignIn: true,
            };
          }
          if (!signInData.user) {
            return {
              success: false,
              error: 'Please check your email for a confirmation link, then sign in.',
              requiresSignIn: true,
            };
          }
        } catch (e) {
          return {
            success: false,
            error: 'Please check your email for a confirmation link, then sign in.',
            requiresSignIn: true,
          };
        }
      }

      // Do NOT insert into public.users here due to RLS; onboarding will create the profile
      const newUser: User = {
        id: authData.user.id,
        email: email.toLowerCase(),
        created_at: authData.user.created_at || new Date().toISOString(),
        profile_completed: false
      };

      return {
        success: true,
        user: newUser
      };
    } catch (error) {
      console.error('Sign up error:', error);
      return {
        success: false,
        error: 'Failed to create account. Please try again.'
      };
    }
  }

  // Sign in existing user
  async signIn(email: string, password: string): Promise<AuthResponse> {
    try {
      // Use real Supabase authentication
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password: password,
      });

      if (authError) {
        console.error('Supabase sign in error:', authError);
        return {
          success: false,
          error: authError.message || 'Invalid email or password'
        };
      }

      if (!authData.user) {
        return {
          success: false,
          error: 'Invalid email or password'
        };
      }

      // Try to load a profile if one exists (non-blocking)
      const existingUser = await this.getUserByEmail(email);
      if (existingUser) {
        return { success: true, user: existingUser };
      }

      // No public.users row yet: return minimal auth user; onboarding will create profile
      const newUser: User = {
        id: authData.user.id,
        email: email.toLowerCase(),
        created_at: authData.user.created_at || new Date().toISOString(),
        profile_completed: false
      };

      return { success: true, user: newUser };
    } catch (error) {
      console.error('Sign in error:', error);
      return {
        success: false,
        error: 'Sign in failed. Please try again.'
      };
    }
  }

  // Get user profile by email
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (error) {
        console.error('Error fetching user:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getUserByEmail:', error);
      return null;
    }
  }

  // Create user in database (for production)
  async createUser(userData: Partial<User>): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .insert([{
          email: userData.email?.toLowerCase(),
          name: userData.name,
          phone: userData.phone,
          account_type: userData.account_type,
          profile_completed: false
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating user:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in createUser:', error);
      return null;
    }
  }
}

export const userService = new UserService(); 