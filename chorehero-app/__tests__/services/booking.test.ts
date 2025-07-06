import { bookingService } from '../../src/services/booking';
import { supabase } from '../../src/services/supabase';
import { BookingRequest, BookingStatus } from '../../src/types/booking';

// Mock supabase
jest.mock('../../src/services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
    })),
  },
}));

// Mock stripe service
jest.mock('../../src/services/stripe', () => ({
  stripeService: {
    createPaymentIntent: jest.fn(),
    confirmPayment: jest.fn(),
    processMarketplacePayment: jest.fn(),
  },
}));

describe('BookingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createBooking', () => {
    const mockBookingRequest: BookingRequest = {
      customer_id: 'customer-123',
      cleaner_id: 'cleaner-456',
      service_type: 'express',
      address_id: 'address-789',
      scheduled_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      add_ons: ['inside_fridge'],
      special_instructions: 'Please be quiet, baby sleeping',
      payment_method_id: 'pm_123',
      tip_amount: 10,
    };

    it('should create booking successfully', async () => {
      const mockBooking = {
        id: 'booking-123',
        ...mockBookingRequest,
        status: 'pending' as BookingStatus,
        price_breakdown: {
          service_base: 45,
          add_ons_total: 15,
          platform_fee: 15,
          tip: 10,
          tax: 6.75,
          total: 91.75,
          cleaner_earnings: 42,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      (supabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockBooking,
          error: null,
        }),
      });

      const result = await bookingService.createBooking(mockBookingRequest);

      expect(result.success).toBe(true);
      expect(result.data.booking.id).toBe('booking-123');
      expect(result.data.booking.status).toBe('pending');
      expect(result.data.booking.price_breakdown.total).toBe(91.75);
    });

    it('should handle booking creation failure', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database constraint violation' },
        }),
      });

      const result = await bookingService.createBooking(mockBookingRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database constraint violation');
    });

    it('should validate booking request data', async () => {
      const invalidRequest = {
        ...mockBookingRequest,
        scheduled_time: new Date(Date.now() - 86400000).toISOString(), // Past date
      };

      const result = await bookingService.createBooking(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('past');
    });

    it('should handle missing required fields', async () => {
      const incompleteRequest = {
        customer_id: 'customer-123',
        // Missing required fields
      } as BookingRequest;

      const result = await bookingService.createBooking(incompleteRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });
  });

  describe('getBookingById', () => {
    it('should retrieve booking successfully', async () => {
      const mockBooking = {
        id: 'booking-123',
        customer_id: 'customer-123',
        status: 'confirmed' as BookingStatus,
        service_type: 'express',
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockBooking,
          error: null,
        }),
      });

      const result = await bookingService.getBookingById('booking-123');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('booking-123');
      expect(result.data.status).toBe('confirmed');
    });

    it('should handle booking not found', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows found' },
        }),
      });

      const result = await bookingService.getBookingById('nonexistent-booking');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Booking not found');
    });

    it('should handle invalid booking ID format', async () => {
      const result = await bookingService.getBookingById('');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid booking ID');
    });
  });

  describe('updateBookingStatus', () => {
    it('should update status successfully', async () => {
      const mockUpdatedBooking = {
        id: 'booking-123',
        status: 'in_progress' as BookingStatus,
        updated_at: new Date().toISOString(),
      };

      (supabase.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockUpdatedBooking,
          error: null,
        }),
      });

      const result = await bookingService.updateBookingStatus(
        'booking-123',
        'in_progress',
        'user-123'
      );

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('in_progress');
    });

    it('should handle invalid status transitions', async () => {
      // Try to go from completed to pending (invalid transition)
      const result = await bookingService.updateBookingStatus(
        'booking-123',
        'pending',
        'completed'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid status transition');
    });

    it('should handle update failure', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Update failed' },
        }),
      });

      const result = await bookingService.updateBookingStatus(
        'booking-123',
        'confirmed',
        'user-123'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });
  });

  describe('getUserBookings', () => {
    it('should retrieve user bookings successfully', async () => {
      const mockBookings = [
        {
          id: 'booking-1',
          customer_id: 'customer-123',
          status: 'confirmed' as BookingStatus,
        },
        {
          id: 'booking-2',
          customer_id: 'customer-123',
          status: 'completed' as BookingStatus,
        },
      ];

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        then: jest.fn().mockResolvedValue({
          data: mockBookings,
          error: null,
        }),
      });

      const result = await bookingService.getCustomerBookings('customer-123');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('booking-1');
    });

    it('should handle empty booking list', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        then: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      const result = await bookingService.getCustomerBookings('customer-123');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should handle database error', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        then: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database connection failed' },
        }),
      });

      const result = await bookingService.getCustomerBookings('customer-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });
  });

  describe('cancelBooking', () => {
    it('should cancel booking successfully', async () => {
      const mockCancelledBooking = {
        id: 'booking-123',
        status: 'cancelled' as BookingStatus,
        updated_at: new Date().toISOString(),
      };

      (supabase.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockCancelledBooking,
          error: null,
        }),
      });

      const result = await bookingService.cancelBooking(
        'booking-123',
        'customer-123',
        'Change of plans'
      );

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('cancelled');
    });

    it('should handle cancellation of non-cancellable booking', async () => {
      // Try to cancel a completed booking
      const result = await bookingService.cancelBooking(
        'booking-123',
        'customer-123',
        'Change of plans'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot be cancelled');
    });

    it('should require cancellation reason', async () => {
      const result = await bookingService.cancelBooking(
        'booking-123',
        'customer-123',
        '' // Empty reason
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('reason is required');
    });
  });

  describe('subscribeToBookingUpdates', () => {
    it('should set up real-time subscription', () => {
      const mockCallback = jest.fn();
      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn(),
      };

      (supabase.channel as jest.Mock).mockReturnValue(mockChannel);

      const subscription = bookingService.subscribeToBookingUpdates(
        'booking-123',
        mockCallback
      );

      expect(supabase.channel).toHaveBeenCalledWith('booking-booking-123');
      expect(mockChannel.on).toHaveBeenCalled();
      expect(mockChannel.subscribe).toHaveBeenCalled();
      expect(subscription).toBeDefined();
    });

    it('should handle subscription callback', () => {
      const mockCallback = jest.fn();
      const mockChannel = {
        on: jest.fn().mockImplementation((event, callback) => {
          // Simulate receiving an update
          callback({
            eventType: 'UPDATE',
            new: { id: 'booking-123', status: 'confirmed' },
          });
          return mockChannel;
        }),
        subscribe: jest.fn(),
      };

      (supabase.channel as jest.Mock).mockReturnValue(mockChannel);

      bookingService.subscribeToBookingUpdates('booking-123', mockCallback);

      expect(mockCallback).toHaveBeenCalledWith({
        id: 'booking-123',
        status: 'confirmed',
      });
    });
  });
});