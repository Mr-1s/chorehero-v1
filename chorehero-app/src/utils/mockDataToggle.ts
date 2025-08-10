import { MOCK_DATA_CONFIG } from './constants';

/**
 * Mock Data Toggle Utility
 * Provides functions to check mock data settings and return appropriate data
 */

export class MockDataToggle {
  /**
   * Check if mock data is enabled globally
   */
  static isEnabled(): boolean {
    return MOCK_DATA_CONFIG.ENABLED;
  }

  /**
   * Check if mock data is enabled for a specific area
   */
  static isEnabledFor(area: keyof typeof MOCK_DATA_CONFIG): boolean {
    if (!MOCK_DATA_CONFIG.ENABLED) return false;
    
    const areaConfig = MOCK_DATA_CONFIG[area];
    if (typeof areaConfig === 'boolean') return areaConfig;
    if (typeof areaConfig === 'object') return true; // If it's an object, check individual features
    return false;
  }

  /**
   * Check if mock data is enabled for a specific feature within an area
   */
  static isEnabledForFeature(area: 'CLEANER' | 'CUSTOMER' | 'SHARED', feature: string): boolean {
    if (!MOCK_DATA_CONFIG.ENABLED) return false;
    
    const areaConfig = MOCK_DATA_CONFIG[area] as any;
    if (!areaConfig) return false;
    
    return areaConfig[feature] === true;
  }

  /**
   * Return mock data or empty array based on settings
   */
  static getData<T>(area: keyof typeof MOCK_DATA_CONFIG, mockData: T, emptyState: T = [] as any): T {
    return this.isEnabledFor(area) ? mockData : emptyState;
  }

  /**
   * Return mock data or empty array based on feature settings
   */
  static getFeatureData<T>(
    area: 'CLEANER' | 'CUSTOMER' | 'SHARED', 
    feature: string, 
    mockData: T, 
    emptyState: T = [] as any
  ): T {
    return this.isEnabledForFeature(area, feature) ? mockData : emptyState;
  }

  /**
   * Get mock profile data or basic user data
   */
  static getProfileData<T>(
    area: 'CLEANER' | 'CUSTOMER',
    mockProfile: T,
    realUserData: Partial<T> = {}
  ): T {
    if (this.isEnabledForFeature(area, 'PROFILE')) {
      return mockProfile;
    }
    
    // Return minimal profile with real user data
    return { ...mockProfile, ...realUserData } as T;
  }

  /**
   * Get dashboard counts/stats
   */
  static getDashboardStats(
    area: 'CLEANER' | 'CUSTOMER',
    mockStats: any,
    emptyStats: any = {}
  ) {
    return this.isEnabledForFeature(area, 'DASHBOARD') ? mockStats : emptyStats;
  }

  /**
   * Toggle mock data globally
   */
  static setGlobalEnabled(enabled: boolean): void {
    (MOCK_DATA_CONFIG as any).ENABLED = enabled;
  }

  /**
   * Toggle mock data for a specific area
   */
  static setAreaEnabled(area: 'CLEANER' | 'CUSTOMER' | 'SHARED', enabled: boolean): void {
    if (typeof MOCK_DATA_CONFIG[area] === 'object') {
      Object.keys(MOCK_DATA_CONFIG[area]).forEach(key => {
        (MOCK_DATA_CONFIG[area] as any)[key] = enabled;
      });
    }
  }

  /**
   * Toggle mock data for a specific feature
   */
  static setFeatureEnabled(
    area: 'CLEANER' | 'CUSTOMER' | 'SHARED', 
    feature: string, 
    enabled: boolean
  ): void {
    const areaConfig = MOCK_DATA_CONFIG[area] as any;
    if (areaConfig && typeof areaConfig === 'object') {
      areaConfig[feature] = enabled;
    }
  }

  /**
   * Get current configuration for debugging
   */
  static getConfig() {
    return MOCK_DATA_CONFIG;
  }

  /**
   * Reset to default configuration
   */
  static resetToDefaults(): void {
    MOCK_DATA_CONFIG.ENABLED = true;
    
    // Reset cleaner settings
    Object.keys(MOCK_DATA_CONFIG.CLEANER).forEach(key => {
      (MOCK_DATA_CONFIG.CLEANER as any)[key] = true;
    });
    
    // Reset customer settings
    Object.keys(MOCK_DATA_CONFIG.CUSTOMER).forEach(key => {
      (MOCK_DATA_CONFIG.CUSTOMER as any)[key] = true;
    });
    
    // Reset shared settings
    Object.keys(MOCK_DATA_CONFIG.SHARED).forEach(key => {
      (MOCK_DATA_CONFIG.SHARED as any)[key] = true;
    });
  }
}

// Export convenience functions
export const useMockData = MockDataToggle.isEnabled;
export const useMockDataFor = MockDataToggle.isEnabledFor;
export const useMockDataForFeature = MockDataToggle.isEnabledForFeature;
export const getMockData = MockDataToggle.getData;
export const getFeatureMockData = MockDataToggle.getFeatureData; 