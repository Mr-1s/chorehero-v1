import AsyncStorage from '@react-native-async-storage/async-storage';

export interface BookingProgress {
  cleanerId: string;
  currentStep: number;
  totalSteps: number;
  bookingData: {
    // Step 1: Service Details
    serviceType: string;
    cleaningType: 'regular' | 'deep' | 'move-out' | 'post-construction';
    estimatedDuration: string;
    rooms: string[];
    specialRequests: string;
    
    // Step 2: Date & Time
    selectedDate: string;
    selectedTime: string;
    isRecurring: boolean;
    recurringFrequency: string;
    
    // Step 3: Address & Access
    address: string;
    apartmentNumber: string;
    accessInstructions: string;
    parkingInfo: string;
    
    // Step 4: Contact & Preferences
    contactName: string;
    contactPhone: string;
    cleanerGender: string;
    productPreference: 'standard' | 'eco-friendly' | 'customer-provided';
    petInfo: string;
    
    // Step 5: Pricing & Payment
    selectedCleaner: string;
    estimatedCost: number;
    paymentMethod: string;
  };
  lastUpdated: number;
}

const BOOKING_PROGRESS_KEY = 'booking_progress';
const PROGRESS_EXPIRY_TIME = 30 * 60 * 1000; // 30 minutes - shorter to reduce confusion

class BookingStateManager {
  private progressCache: Map<string, BookingProgress> = new Map();

  /**
   * Save booking progress for a specific cleaner
   * Only keeps ONE active booking at a time to prevent confusion
   */
  async saveBookingProgress(cleanerId: string, currentStep: number, bookingData: any): Promise<void> {
    try {
      const progress: BookingProgress = {
        cleanerId,
        currentStep,
        totalSteps: 5,
        bookingData,
        lastUpdated: Date.now(),
      };

      // Clear cache for other cleaners - only one active booking at a time
      this.progressCache.clear();
      this.progressCache.set(cleanerId, progress);

      // Save ONLY this cleaner's progress (replace all)
      const allProgress: Record<string, BookingProgress> = {};
      allProgress[cleanerId] = progress;
      
      await AsyncStorage.setItem(BOOKING_PROGRESS_KEY, JSON.stringify(allProgress));
      
      console.log(`💾 Saved booking progress for cleaner ${cleanerId} at step ${currentStep}`);
    } catch (error) {
      console.error('❌ Failed to save booking progress:', error);
    }
  }

  /**
   * Get booking progress for a specific cleaner
   */
  async getBookingProgress(cleanerId: string): Promise<BookingProgress | null> {
    try {
      // Check cache first
      if (this.progressCache.has(cleanerId)) {
        const cached = this.progressCache.get(cleanerId)!;
        
        // Check if not expired
        if (Date.now() - cached.lastUpdated < PROGRESS_EXPIRY_TIME) {
          console.log(`📖 Retrieved cached booking progress for cleaner ${cleanerId} at step ${cached.currentStep}`);
          return cached;
        } else {
          // Remove expired progress
          this.progressCache.delete(cleanerId);
          await this.clearBookingProgress(cleanerId);
        }
      }

      // Load from AsyncStorage
      const allProgress = await this.getAllProgress();
      const progress = allProgress[cleanerId];

      if (progress) {
        // Check if not expired
        if (Date.now() - progress.lastUpdated < PROGRESS_EXPIRY_TIME) {
          this.progressCache.set(cleanerId, progress);
          console.log(`📖 Retrieved booking progress for cleaner ${cleanerId} at step ${progress.currentStep}`);
          return progress;
        } else {
          // Remove expired progress
          await this.clearBookingProgress(cleanerId);
        }
      }

      return null;
    } catch (error) {
      console.error('❌ Failed to get booking progress:', error);
      return null;
    }
  }

  /**
   * Clear booking progress for a specific cleaner
   */
  async clearBookingProgress(cleanerId: string): Promise<void> {
    try {
      // Remove from cache
      this.progressCache.delete(cleanerId);

      // Remove from AsyncStorage
      const allProgress = await this.getAllProgress();
      delete allProgress[cleanerId];
      
      await AsyncStorage.setItem(BOOKING_PROGRESS_KEY, JSON.stringify(allProgress));
      
      console.log(`🗑️ Cleared booking progress for cleaner ${cleanerId}`);
    } catch (error) {
      console.error('❌ Failed to clear booking progress:', error);
    }
  }

  /**
   * Clear all expired booking progress
   */
  async clearExpiredProgress(): Promise<void> {
    try {
      const allProgress = await this.getAllProgress();
      const now = Date.now();
      let hasChanges = false;

      for (const [cleanerId, progress] of Object.entries(allProgress)) {
        if (now - progress.lastUpdated >= PROGRESS_EXPIRY_TIME) {
          delete allProgress[cleanerId];
          this.progressCache.delete(cleanerId);
          hasChanges = true;
          console.log(`🗑️ Cleared expired booking progress for cleaner ${cleanerId}`);
        }
      }

      if (hasChanges) {
        await AsyncStorage.setItem(BOOKING_PROGRESS_KEY, JSON.stringify(allProgress));
      }
    } catch (error) {
      console.error('❌ Failed to clear expired progress:', error);
    }
  }

  /**
   * Check if there's active booking progress for a cleaner
   */
  async hasActiveProgress(cleanerId: string): Promise<boolean> {
    const progress = await this.getBookingProgress(cleanerId);
    return progress !== null && progress.currentStep > 1;
  }

  /**
   * Get all booking progress from AsyncStorage
   */
  private async getAllProgress(): Promise<Record<string, BookingProgress>> {
    try {
      const stored = await AsyncStorage.getItem(BOOKING_PROGRESS_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('❌ Failed to load booking progress:', error);
      return {};
    }
  }

  /**
   * Get summary of all active booking progress
   */
  async getActiveProgressSummary(): Promise<Array<{ cleanerId: string; currentStep: number; lastUpdated: number }>> {
    try {
      const allProgress = await this.getAllProgress();
      const now = Date.now();
      
      return Object.values(allProgress)
        .filter(progress => now - progress.lastUpdated < PROGRESS_EXPIRY_TIME)
        .map(progress => ({
          cleanerId: progress.cleanerId,
          currentStep: progress.currentStep,
          lastUpdated: progress.lastUpdated,
        }));
    } catch (error) {
      console.error('❌ Failed to get active progress summary:', error);
      return [];
    }
  }
}

export const bookingStateManager = new BookingStateManager();