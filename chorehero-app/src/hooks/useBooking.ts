import { useState, useCallback, useEffect } from 'react';
import { bookingService } from '../services/booking';
import { Booking, BookingRequest, ServiceType, TimeSlot, AddOn } from '../types/booking';
import { Address, Cleaner } from '../types/user';
import { ApiResponse } from '../types/api';
import { SERVICE_TYPES, ADD_ONS } from '../utils/constants';

interface BookingState {
  // Selected options
  selectedCleaner: Cleaner | null;
  selectedAddress: Address | null;
  selectedService: ServiceType | null;
  selectedAddOns: string[];
  selectedTimeSlot: TimeSlot | null;
  specialInstructions: string;
  tipAmount: number;
  
  // Available options
  availableTimeSlots: TimeSlot[];
  
  // Pricing
  pricing: {
    service_base_price: number;
    add_ons_total: number;
    platform_fee: number;
    tax: number;
    tip: number;
    total_amount: number;
    cleaner_earnings: number;
    price_modifier?: number;
  } | null;
  
  // Loading states
  isLoadingTimeSlots: boolean;
  isCalculatingPrice: boolean;
  isCreatingBooking: boolean;
  
  // Progress tracking
  currentStep: number;
  totalSteps: number;
  startTime: number | null;
  
  // Error handling
  error: string | null;
}

const initialState: BookingState = {
  selectedCleaner: null,
  selectedAddress: null,
  selectedService: null,
  selectedAddOns: [],
  selectedTimeSlot: null,
  specialInstructions: '',
  tipAmount: 0,
  availableTimeSlots: [],
  pricing: null,
  isLoadingTimeSlots: false,
  isCalculatingPrice: false,
  isCreatingBooking: false,
  currentStep: 1,
  totalSteps: 5,
  startTime: null,
  error: null,
};

export const useBooking = () => {
  const [state, setState] = useState<BookingState>(initialState);

  // Start booking flow timer
  const startBookingFlow = useCallback(() => {
    setState(prev => ({
      ...prev,
      startTime: Date.now(),
      currentStep: 1,
      error: null,
    }));
  }, []);

  // Calculate elapsed time
  const getElapsedTime = useCallback(() => {
    if (!state.startTime) return 0;
    return Math.floor((Date.now() - state.startTime) / 1000);
  }, [state.startTime]);

  // Set selected cleaner
  const setSelectedCleaner = useCallback((cleaner: Cleaner) => {
    setState(prev => ({
      ...prev,
      selectedCleaner: cleaner,
      currentStep: Math.max(prev.currentStep, 2),
      error: null,
    }));
  }, []);

  // Set selected address
  const setSelectedAddress = useCallback((address: Address) => {
    setState(prev => ({
      ...prev,
      selectedAddress: address,
      currentStep: Math.max(prev.currentStep, 2),
      error: null,
    }));
  }, []);

  // Set selected service
  const setSelectedService = useCallback((service: ServiceType) => {
    setState(prev => ({
      ...prev,
      selectedService: service,
      currentStep: Math.max(prev.currentStep, 3),
      error: null,
      // Reset time slots when service changes
      availableTimeSlots: [],
      selectedTimeSlot: null,
    }));
  }, []);

  // Toggle add-on selection
  const toggleAddOn = useCallback((addOnId: string) => {
    setState(prev => {
      const isSelected = prev.selectedAddOns.includes(addOnId);
      const newAddOns = isSelected
        ? prev.selectedAddOns.filter(id => id !== addOnId)
        : [...prev.selectedAddOns, addOnId];
      
      return {
        ...prev,
        selectedAddOns: newAddOns,
        error: null,
      };
    });
  }, []);

  // Set special instructions
  const setSpecialInstructions = useCallback((instructions: string) => {
    setState(prev => ({
      ...prev,
      specialInstructions: instructions,
      error: null,
    }));
  }, []);

  // Set tip amount
  const setTipAmount = useCallback((amount: number) => {
    setState(prev => ({
      ...prev,
      tipAmount: Math.max(0, amount),
      error: null,
    }));
  }, []);

  // Set selected time slot
  const setSelectedTimeSlot = useCallback((timeSlot: TimeSlot) => {
    setState(prev => ({
      ...prev,
      selectedTimeSlot: timeSlot,
      currentStep: Math.max(prev.currentStep, 4),
      error: null,
    }));
  }, []);

  // Load available time slots
  const loadAvailableTimeSlots = useCallback(async (date: string) => {
    if (!state.selectedCleaner || !state.selectedService) {
      setState(prev => ({
        ...prev,
        error: 'Please select a cleaner and service first',
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      isLoadingTimeSlots: true,
      error: null,
    }));

    try {
      const response = await bookingService.getAvailableTimeSlots(
        state.selectedCleaner.id,
        date,
        state.selectedService
      );

      if (response.success) {
        setState(prev => ({
          ...prev,
          availableTimeSlots: response.data,
          isLoadingTimeSlots: false,
        }));
      } else {
        setState(prev => ({
          ...prev,
          error: response.error || 'Failed to load available time slots',
          isLoadingTimeSlots: false,
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Network error loading time slots',
        isLoadingTimeSlots: false,
      }));
    }
  }, [state.selectedCleaner, state.selectedService]);

  // Calculate pricing
  const calculatePricing = useCallback(async () => {
    if (!state.selectedService || !state.selectedTimeSlot) {
      return;
    }

    setState(prev => ({
      ...prev,
      isCalculatingPrice: true,
      error: null,
    }));

    try {
      const response = await bookingService.calculateBookingTotal(
        state.selectedService,
        state.selectedAddOns,
        state.selectedTimeSlot.datetime
      );

      if (response.success) {
        setState(prev => ({
          ...prev,
          pricing: {
            ...response.data,
            tip: prev.tipAmount,
            total_amount: response.data.total_amount + prev.tipAmount,
          },
          isCalculatingPrice: false,
        }));
      } else {
        setState(prev => ({
          ...prev,
          error: response.error || 'Failed to calculate pricing',
          isCalculatingPrice: false,
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Network error calculating price',
        isCalculatingPrice: false,
      }));
    }
  }, [state.selectedService, state.selectedAddOns, state.selectedTimeSlot, state.tipAmount]);

  // Auto-calculate pricing when dependencies change
  useEffect(() => {
    if (state.selectedService && state.selectedTimeSlot) {
      calculatePricing();
    }
  }, [state.selectedService, state.selectedAddOns, state.selectedTimeSlot, state.tipAmount, calculatePricing]);

  // Create booking
  const createBooking = useCallback(async (
    customerId: string,
    paymentMethodId: string
  ): Promise<ApiResponse<any>> => {
    if (!state.selectedCleaner || !state.selectedAddress || !state.selectedService || !state.selectedTimeSlot) {
      return {
        success: false,
        data: null,
        error: 'Please complete all booking steps',
      };
    }

    setState(prev => ({
      ...prev,
      isCreatingBooking: true,
      error: null,
    }));

    try {
      const bookingRequest: BookingRequest = {
        cleaner_id: state.selectedCleaner.id,
        service_type: state.selectedService,
        address_id: state.selectedAddress.id,
        scheduled_time: state.selectedTimeSlot.datetime,
        add_ons: state.selectedAddOns,
        special_instructions: state.specialInstructions || undefined,
        payment_method_id: paymentMethodId,
        tip_amount: state.tipAmount > 0 ? state.tipAmount : undefined,
        customer_id: customerId,
      };

      const response = await bookingService.createBooking(bookingRequest);

      if (response.success) {
        setState(prev => ({
          ...prev,
          currentStep: prev.totalSteps,
          isCreatingBooking: false,
        }));
      } else {
        setState(prev => ({
          ...prev,
          error: response.error || 'Failed to create booking',
          isCreatingBooking: false,
        }));
      }

      return response;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Network error creating booking',
        isCreatingBooking: false,
      }));

      return {
        success: false,
        data: null,
        error: 'Network error creating booking',
      };
    }
  }, [state]);

  // Reset booking state
  const resetBooking = useCallback(() => {
    setState(initialState);
  }, []);

  // Go to next step
  const nextStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: Math.min(prev.currentStep + 1, prev.totalSteps),
      error: null,
    }));
  }, []);

  // Go to previous step
  const previousStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: Math.max(prev.currentStep - 1, 1),
      error: null,
    }));
  }, []);

  // Validation helpers
  const canProceedToNextStep = useCallback(() => {
    switch (state.currentStep) {
      case 1: // Cleaner selection
        return !!state.selectedCleaner;
      case 2: // Service selection
        return !!state.selectedService && !!state.selectedAddress;
      case 3: // Time selection
        return !!state.selectedTimeSlot;
      case 4: // Review and payment
        return !!state.pricing;
      default:
        return false;
    }
  }, [state]);

  const isBookingComplete = useCallback(() => {
    return !!(
      state.selectedCleaner &&
      state.selectedAddress &&
      state.selectedService &&
      state.selectedTimeSlot &&
      state.pricing
    );
  }, [state]);

  const getProgress = useCallback(() => {
    return (state.currentStep / state.totalSteps) * 100;
  }, [state.currentStep, state.totalSteps]);

  // Get formatted pricing
  const getFormattedPricing = useCallback(() => {
    if (!state.pricing) return null;

    return {
      subtotal: (state.pricing.service_base_price + state.pricing.add_ons_total).toFixed(2),
      platformFee: state.pricing.platform_fee.toFixed(2),
      tax: state.pricing.tax.toFixed(2),
      tip: state.pricing.tip.toFixed(2),
      total: state.pricing.total_amount.toFixed(2),
      cleanerEarnings: state.pricing.cleaner_earnings.toFixed(2),
    };
  }, [state.pricing]);

  // Get service details
  const getServiceDetails = useCallback(() => {
    if (!state.selectedService) return null;
    return SERVICE_TYPES[state.selectedService];
  }, [state.selectedService]);

  // Get selected add-ons details
  const getSelectedAddOns = useCallback(() => {
    return ADD_ONS.filter(addOn => state.selectedAddOns.includes(addOn.id));
  }, [state.selectedAddOns]);

  return {
    // State
    ...state,
    
    // Actions
    startBookingFlow,
    setSelectedCleaner,
    setSelectedAddress,
    setSelectedService,
    toggleAddOn,
    setSpecialInstructions,
    setTipAmount,
    setSelectedTimeSlot,
    loadAvailableTimeSlots,
    calculatePricing,
    createBooking,
    resetBooking,
    nextStep,
    previousStep,
    
    // Computed values
    canProceedToNextStep: canProceedToNextStep(),
    isBookingComplete: isBookingComplete(),
    progress: getProgress(),
    elapsedTime: getElapsedTime(),
    formattedPricing: getFormattedPricing(),
    serviceDetails: getServiceDetails(),
    selectedAddOnsDetails: getSelectedAddOns(),
    
    // Time pressure indicator (60-second goal)
    timeRemaining: Math.max(0, 60 - getElapsedTime()),
    isTimeExpired: getElapsedTime() > 60,
    timeUrgency: getElapsedTime() > 45 ? 'high' : getElapsedTime() > 30 ? 'medium' : 'low',
  };
};