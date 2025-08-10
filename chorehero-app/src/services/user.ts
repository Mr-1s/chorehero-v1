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
  // Check if user already exists by email
  async checkUserExists(email: string): Promise<boolean> {
    try {
      // In production, this would query your database
      // For now, simulate with Supabase structure
      const { data, error } = await supabase
        .from('users')
        .select('email')
        .eq('email', email.toLowerCase())
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 means no rows found, which is expected for new users
        console.error('Error checking user existence:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('Error in checkUserExists:', error);
      return false;
    }
  }

  // Sign up new user
  async signUp(email: string, password: string): Promise<AuthResponse> {
    try {
      // First check if user already exists
      const userExists = await this.checkUserExists(email);
      
      if (userExists) {
        return {
          success: false,
          error: 'An account with this email already exists. Please sign in instead.',
          requiresSignIn: true
        };
      }

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

      // Check if email confirmation is required
      if (authData.user && !authData.session) {
        return {
          success: false,
          error: 'Please check your email and click the confirmation link to activate your account. Then return to sign in.',
          requiresSignIn: false
        };
      }

      // Create user profile in database
      const newUser: User = {
        id: authData.user.id,
        email: email.toLowerCase(),
        created_at: authData.user.created_at || new Date().toISOString(),
        profile_completed: false // This will be managed in the app logic, not the database
      };

      // Store minimal user record for now (full profile will be completed during onboarding)
      // Note: We'll set basic required fields, role will be set during onboarding
      const { error: dbError } = await supabase
        .from('users')
        .insert([{
          id: newUser.id,
          phone: 'pending', // Temporary, will be updated during onboarding
          email: newUser.email,
          name: 'New User', // Temporary, will be updated during onboarding
          role: 'customer', // Default role, will be updated during account type selection
        }]);

      if (dbError) {
        console.error('Database error creating user:', dbError);
        // Continue anyway - user auth was created successfully
      }

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

      // Get user profile from database
      const existingUser = await this.getUserByEmail(email);
      
      if (existingUser) {
        return {
          success: true,
          user: existingUser
        };
      } else {
        // User exists in auth but not in our users table, create minimal profile
        const newUser: User = {
          id: authData.user.id,
          email: email.toLowerCase(),
          created_at: authData.user.created_at || new Date().toISOString(),
          profile_completed: false
        };

        // Try to create user record with required fields
        await supabase
          .from('users')
          .insert([{
            id: newUser.id,
            phone: 'pending',
            email: newUser.email,
            name: 'Returning User',
            role: 'customer', // Default role
          }]);

        return {
          success: true,
          user: newUser
        };
      }
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