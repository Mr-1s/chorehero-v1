import { authService } from '../../src/services/auth';
import { supabase } from '../../src/services/supabase';

// Mock supabase
jest.mock('../../src/services/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: jest.fn(),
      verifyOtp: jest.fn(),
      signOut: jest.fn(),
      getUser: jest.fn(),
      getSession: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
  },
}));

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendVerificationCode', () => {
    it('should send verification code successfully', async () => {
      const mockPhone = '+15551234567';
      const mockResponse = { data: {}, error: null };

      (supabase.auth.signInWithOtp as jest.Mock).mockResolvedValue(mockResponse);

      const result = await authService.sendVerificationCode(mockPhone);

      expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
        phone: mockPhone,
      });
      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
    });

    it('should handle verification code send failure', async () => {
      const mockPhone = '+15551234567';
      const mockError = { message: 'Phone number is invalid' };

      (supabase.auth.signInWithOtp as jest.Mock).mockResolvedValue({
        data: null,
        error: mockError,
      });

      const result = await authService.sendVerificationCode(mockPhone);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Phone number is invalid');
    });

    it('should handle network errors', async () => {
      const mockPhone = '+15551234567';

      (supabase.auth.signInWithOtp as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      const result = await authService.sendVerificationCode(mockPhone);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('verifyPhoneCode', () => {
    it('should verify code for existing user successfully', async () => {
      const mockPhone = '+15551234567';
      const mockCode = '123456';
      const mockUser = {
        id: 'user-123',
        phone: mockPhone,
        name: 'John Doe',
        role: 'customer',
      };
      const mockSession = {
        access_token: 'token-123',
        refresh_token: 'refresh-123',
        expires_at: Date.now() + 3600000,
      };

      (supabase.auth.verifyOtp as jest.Mock).mockResolvedValue({
        data: { user: { id: 'user-123' }, session: mockSession },
        error: null,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockUser,
          error: null,
        }),
      });

      const result = await authService.verifyPhoneCode(mockPhone, mockCode);

      expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
        phone: mockPhone,
        token: mockCode,
        type: 'sms',
      });
      expect(result.success).toBe(true);
      expect(result.data?.user).toEqual(mockUser);
      expect(result.data?.session).toEqual(mockSession);
    });

    it('should handle invalid verification code', async () => {
      const mockPhone = '+15551234567';
      const mockCode = '000000';

      (supabase.auth.verifyOtp as jest.Mock).mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid or expired OTP' },
      });

      const result = await authService.verifyPhoneCode(mockPhone, mockCode);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or expired OTP');
    });

    it('should handle new user (no profile found)', async () => {
      const mockPhone = '+15551234567';
      const mockCode = '123456';
      const mockSession = {
        access_token: 'token-123',
        refresh_token: 'refresh-123',
        expires_at: Date.now() + 3600000,
      };

      (supabase.auth.verifyOtp as jest.Mock).mockResolvedValue({
        data: { user: { id: 'user-123' }, session: mockSession },
        error: null,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows found' },
        }),
      });

      const result = await authService.verifyPhoneCode(mockPhone, mockCode);

      expect(result.success).toBe(true);
      expect(result.data).toBeNull(); // New user, no profile found
    });
  });

  describe('completeRegistration', () => {
    it('should complete registration for new customer', async () => {
      const mockUserId = 'user-123';
      const mockUserData = {
        name: 'John Doe',
        role: 'customer' as const,
        email: 'john@example.com',
        phone: '+15551234567',
      };
      const mockCreatedUser = {
        id: mockUserId,
        ...mockUserData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      (supabase.from as jest.Mock).mockReturnValue({
        upsert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockCreatedUser,
          error: null,
        }),
      });

      const result = await authService.completeRegistration(mockUserId, mockUserData);

      expect(result.success).toBe(true);
      expect(result.data.name).toBe(mockUserData.name);
      expect(result.data.role).toBe(mockUserData.role);
    });

    it('should handle registration failure', async () => {
      const mockUserId = 'user-123';
      const mockUserData = {
        name: 'John Doe',
        role: 'customer' as const,
        phone: '+15551234567',
      };

      (supabase.from as jest.Mock).mockReturnValue({
        upsert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      });

      const result = await authService.completeRegistration(mockUserId, mockUserData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('signOut', () => {
    it('should sign out successfully', async () => {
      (supabase.auth.signOut as jest.Mock).mockResolvedValue({
        error: null,
      });

      const result = await authService.signOut();

      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should handle sign out failure', async () => {
      (supabase.auth.signOut as jest.Mock).mockResolvedValue({
        error: { message: 'Sign out failed' },
      });

      const result = await authService.signOut();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Sign out failed');
    });
  });

  describe('getCurrentUser', () => {
    it('should get current user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        name: 'John Doe',
        role: 'customer',
      };
      const mockSession = {
        access_token: 'token-123',
        refresh_token: 'refresh-123',
        expires_at: Date.now() + 3600000,
      };

      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockUser,
          error: null,
        }),
      });

      const result = await authService.getCurrentUser();

      expect(result.success).toBe(true);
      expect(result.data?.user).toEqual(mockUser);
      expect(result.data?.session).toEqual(mockSession);
    });

    it('should handle no authenticated session', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const result = await authService.getCurrentUser();

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it('should handle missing profile for authenticated user', async () => {
      const mockSession = {
        access_token: 'token-123',
        refresh_token: 'refresh-123',
        expires_at: Date.now() + 3600000,
      };

      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows found' },
        }),
      });

      const result = await authService.getCurrentUser();

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });
});