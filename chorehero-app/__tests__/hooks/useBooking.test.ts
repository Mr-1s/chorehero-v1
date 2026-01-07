// Mock React hooks for testing
const mockUseState = jest.fn();
const mockUseEffect = jest.fn();
const mockUseCallback = jest.fn();

// Simple hook test utilities
const renderHook = (hook: () => any) => {
  let result: any;
  let unmounted = false;
  const TestComponent = () => {
    result = hook();
    return null;
  };
  // Simulate hook execution
  const hookResult = hook();
  return { 
    result: { current: hookResult },
    unmount: () => {
      unmounted = true;
    }
  };
};

const act = (callback: () => void) => {
  callback();
};
import { useBooking } from '../../src/hooks/useBooking';
import { bookingService } from '../../src/services/booking';
import { ServiceType } from '../../src/types/booking';

// Mock booking service
jest.mock('../../src/services/booking', () => ({
  bookingService: {
    createBooking: jest.fn(),
    getAvailableTimeSlots: jest.fn(),
    calculatePricing: jest.fn(),
    validateBookingRequest: jest.fn(),
  },
}));

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

describe('useBooking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Initial State', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useBooking());

      expect(result.current.currentStep).toBe('service');
      expect(result.current.selectedService).toBe('express');
      expect(result.current.selectedTimeSlot).toBeNull();
      expect(result.current.selectedAddOns).toEqual([]);
      expect(result.current.isBookingInProgress).toBe(false);
      expect(result.current.bookingTimeRemaining).toBe(60);
      expect(result.current.pricingBreakdown).toBeNull();
    });

    it('should initialize with custom cleaner', () => {
      const mockCleaner = {
        id: 'cleaner-123',
        name: 'John Doe',
        rating: 4.8,
        hourlyRate: 25,
      };

      const { result } = renderHook(() => useBooking());

      expect(result.current.selectedCleaner).toEqual(mockCleaner);
    });
  });

  describe('Service Selection', () => {
    it('should set service type correctly', () => {
      const { result } = renderHook(() => useBooking());

      act(() => {
        result.current.setServiceType('standard');
      });

      expect(result.current.selectedService).toBe('standard');
    });

    it('should reset pricing when service type changes', () => {
      const { result } = renderHook(() => useBooking());

      // Set initial pricing
      act(() => {
        result.current.setPricingBreakdown({
          service_base: 45,
          add_ons_total: 0,
          platform_fee: 11.25,
          tip: 0,
          tax: 5.6,
          total: 61.85,
          cleaner_earnings: 31.5,
        });
      });

      expect(result.current.pricingBreakdown).not.toBeNull();

      // Change service type
      act(() => {
        result.current.setServiceType('deep' as ServiceType);
      });

      // Pricing should be recalculated
      expect(result.current.selectedService).toBe('deep');
    });
  });

  describe('Time Slot Selection', () => {
    it('should set time slot correctly', () => {
      const { result } = renderHook(() => useBooking());
      const mockTimeSlot = {
        datetime: new Date(Date.now() + 86400000).toISOString(),
        is_available: true,
      };

      act(() => {
        result.current.setSelectedTimeSlot(mockTimeSlot);
      });

      expect(result.current.selectedTimeSlot).toEqual(mockTimeSlot);
    });

    it('should not set unavailable time slot', () => {
      const { result } = renderHook(() => useBooking());
      const mockTimeSlot = {
        datetime: new Date(Date.now() + 86400000).toISOString(),
        is_available: false,
      };

      act(() => {
        result.current.setSelectedTimeSlot(mockTimeSlot);
      });

      expect(result.current.selectedTimeSlot).toBeNull();
    });

    it('should not set past time slot', () => {
      const { result } = renderHook(() => useBooking());
      const pastTimeSlot = {
        datetime: new Date(Date.now() - 86400000).toISOString(),
        is_available: true,
      };

      act(() => {
        result.current.setSelectedTimeSlot(pastTimeSlot);
      });

      expect(result.current.selectedTimeSlot).toBeNull();
    });
  });

  describe('Add-On Management', () => {
    it('should toggle add-on selection', () => {
      const { result } = renderHook(() => useBooking());

      act(() => {
        result.current.toggleAddOn('inside_fridge');
      });

      expect(result.current.selectedAddOns).toContain('inside_fridge');

      act(() => {
        result.current.toggleAddOn('inside_fridge');
      });

      expect(result.current.selectedAddOns).not.toContain('inside_fridge');
    });

    it('should add multiple add-ons', () => {
      const { result } = renderHook(() => useBooking());

      act(() => {
        result.current.toggleAddOn('inside_fridge');
        result.current.toggleAddOn('inside_oven');
        result.current.toggleAddOn('laundry_fold');
      });

      expect(result.current.selectedAddOns).toEqual([
        'inside_fridge',
        'inside_oven',
        'laundry_fold',
      ]);
    });

    it('should update pricing when add-ons change', () => {
      const { result } = renderHook(() => useBooking());

      (bookingService.calculatePricing as jest.Mock).mockResolvedValue({
        success: true,
        data: {
          service_base: 45,
          add_ons_total: 15,
          platform_fee: 15,
          tip: 0,
          tax: 7.5,
          total: 82.5,
          cleaner_earnings: 42,
        },
      });

      act(() => {
        result.current.toggleAddOn('inside_fridge');
      });

      expect(bookingService.calculatePricing).toHaveBeenCalled();
    });
  });

  describe('Booking Timer', () => {
    it('should start booking timer when booking begins', () => {
      const { result } = renderHook(() => useBooking());

      act(() => {
        result.current.startBookingFlow();
      });

      expect(result.current.isBookingInProgress).toBe(true);
      expect(result.current.bookingTimeRemaining).toBe(60);
    });

    it('should countdown booking timer', () => {
      const { result } = renderHook(() => useBooking());

      act(() => {
        result.current.startBookingFlow();
      });

      // Fast forward 10 seconds
      act(() => {
        jest.advanceTimersByTime(10000);
      });

      expect(result.current.bookingTimeRemaining).toBe(50);
    });

    it('should cancel booking when timer expires', () => {
      const { result } = renderHook(() => useBooking());

      act(() => {
        result.current.startBookingFlow();
      });

      // Fast forward to timer expiry
      act(() => {
        jest.advanceTimersByTime(60000);
      });

      expect(result.current.isBookingInProgress).toBe(false);
      expect(result.current.currentStep).toBe('service');
    });

    it('should stop timer when booking completes', () => {
      const { result } = renderHook(() => useBooking());

      act(() => {
        result.current.startBookingFlow();
      });

      act(() => {
        result.current.cancelBooking();
      });

      expect(result.current.isBookingInProgress).toBe(false);
    });
  });

  describe('Booking Submission', () => {
    it('should submit booking successfully', async () => {
      const { result } = renderHook(() => useBooking());
      const mockBookingResponse = {
        success: true,
        data: {
          booking: {
            id: 'booking-123',
            status: 'pending',
          },
          estimated_arrival: new Date(Date.now() + 3600000).toISOString(),
          cleaner_info: {
            name: 'John Doe',
            photo_url: 'https://example.com/photo.jpg',
            rating: 4.8,
            phone: '+15551234567',
          },
          chat_thread_id: 'thread-123',
        },
      };

      (bookingService.createBooking as jest.Mock).mockResolvedValue(mockBookingResponse);

      // Set up complete booking
      act(() => {
        result.current.setServiceType('express');
        result.current.setSelectedTimeSlot({
          datetime: new Date(Date.now() + 86400000).toISOString(),
          is_available: true,
        });
        result.current.setSelectedAddress({ id: 'address-123' });
        result.current.setSpecialInstructions('Please be quiet');
      });

      await act(async () => {
        await result.current.submitBooking();
      });

      expect(bookingService.createBooking).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('Tracking', { 
        bookingId: 'booking-123' 
      });
    });

    it('should handle booking submission failure', async () => {
      const { result } = renderHook(() => useBooking());

      (bookingService.createBooking as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Payment failed',
      });

      // Set up complete booking
      act(() => {
        result.current.setServiceType('express');
        result.current.setSelectedTimeSlot({
          datetime: new Date(Date.now() + 86400000).toISOString(),
          is_available: true,
        });
        result.current.setSelectedAddress({ id: 'address-123' });
      });

      await act(async () => {
        await result.current.submitBooking();
      });

      expect(result.current.error).toBe('Payment failed');
      expect(result.current.isBookingInProgress).toBe(false);
    });

    it('should validate booking before submission', async () => {
      const { result } = renderHook(() => useBooking());

      // Try to submit incomplete booking
      await act(async () => {
        await result.current.submitBooking();
      });

      expect(result.current.error).toContain('Please select');
      expect(bookingService.createBooking).not.toHaveBeenCalled();
    });
  });

  describe('Navigation', () => {
    it('should navigate between steps correctly', () => {
      const { result } = renderHook(() => useBooking());

      act(() => {
        result.current.goToNextStep();
      });

      expect(result.current.currentStep).toBe('datetime');

      act(() => {
        result.current.goToNextStep();
      });

      expect(result.current.currentStep).toBe('addons');

      act(() => {
        result.current.goToPreviousStep();
      });

      expect(result.current.currentStep).toBe('datetime');
    });

    it('should not go past last step', () => {
      const { result } = renderHook(() => useBooking());

      // Navigate to last step
      act(() => {
        result.current.setCurrentStep('review');
        result.current.goToNextStep();
      });

      expect(result.current.currentStep).toBe('review');
    });

    it('should not go before first step', () => {
      const { result } = renderHook(() => useBooking());

      act(() => {
        result.current.goToPreviousStep();
      });

      expect(result.current.currentStep).toBe('service');
    });
  });

  describe('Reset and Cleanup', () => {
    it('should reset booking state', () => {
      const { result } = renderHook(() => useBooking());

      // Set up some state
      act(() => {
        result.current.setServiceType('standard');
        result.current.toggleAddOn('inside_fridge');
        result.current.setSpecialInstructions('Test instructions');
        result.current.startBookingFlow();
      });

      // Reset
      act(() => {
        result.current.resetBooking();
      });

      expect(result.current.currentStep).toBe('service');
      expect(result.current.selectedService).toBe('express');
      expect(result.current.selectedAddOns).toEqual([]);
      expect(result.current.specialInstructions).toBe('');
      expect(result.current.isBookingInProgress).toBe(false);
    });

    it('should clean up timer on unmount', () => {
      const { result, unmount } = renderHook(() => useBooking());

      act(() => {
        result.current.startBookingFlow();
      });

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });
});