import { populateSampleData, clearSampleData, checkSampleDataExists, initializeSampleData } from '../../src/services/sampleData';
import { supabase } from '../../src/services/supabase';

// Mock supabase
jest.mock('../../src/services/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('SampleData Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('populateSampleData', () => {
    it('should populate sample cleaner data successfully', async () => {
      const mockUpsert = jest.fn().mockResolvedValue({ data: {}, error: null });
      const mockFrom = jest.fn().mockReturnValue({
        upsert: mockUpsert,
      });
      
      mockSupabase.from = mockFrom;

      await populateSampleData();

      // Should call upsert for both users and cleaner_profiles tables
      expect(mockFrom).toHaveBeenCalledWith('users');
      expect(mockFrom).toHaveBeenCalledWith('cleaner_profiles');
      
      // Should call upsert multiple times for each cleaner
      expect(mockUpsert).toHaveBeenCalledTimes(12); // 6 users + 6 cleaner profiles
    });

    it('should handle errors during population', async () => {
      const mockUpsert = jest.fn().mockResolvedValue({ 
        data: null, 
        error: { message: 'Database error' } 
      });
      const mockFrom = jest.fn().mockReturnValue({
        upsert: mockUpsert,
      });
      
      mockSupabase.from = mockFrom;

      // Should not throw error, just log it
      await expect(populateSampleData()).resolves.not.toThrow();
    });
  });

  describe('clearSampleData', () => {
    it('should clear sample data successfully', async () => {
      const mockDelete = jest.fn().mockResolvedValue({ error: null });
      const mockIn = jest.fn().mockReturnValue({ delete: mockDelete });
      const mockFrom = jest.fn().mockReturnValue({
        delete: () => ({ in: mockIn }),
      });
      
      mockSupabase.from = mockFrom;

      await clearSampleData();

      expect(mockFrom).toHaveBeenCalledWith('cleaner_profiles');
      expect(mockFrom).toHaveBeenCalledWith('users');
      expect(mockIn).toHaveBeenCalledTimes(2);
    });

    it('should handle errors during clearing', async () => {
      const mockDelete = jest.fn().mockResolvedValue({ 
        error: { message: 'Delete failed' } 
      });
      const mockIn = jest.fn().mockReturnValue({ delete: mockDelete });
      const mockFrom = jest.fn().mockReturnValue({
        delete: () => ({ in: mockIn }),
      });
      
      mockSupabase.from = mockFrom;

      // Should not throw error, just log it
      await expect(clearSampleData()).resolves.not.toThrow();
    });
  });

  describe('checkSampleDataExists', () => {
    it('should return true when sample data exists', async () => {
      const mockLimit = jest.fn().mockResolvedValue({ 
        data: [{ id: 'sample-id' }], 
        error: null 
      });
      const mockIn = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockSelect = jest.fn().mockReturnValue({ in: mockIn });
      const mockFrom = jest.fn().mockReturnValue({
        select: mockSelect,
      });
      
      mockSupabase.from = mockFrom;

      const result = await checkSampleDataExists();

      expect(result).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('users');
      expect(mockSelect).toHaveBeenCalledWith('id');
    });

    it('should return false when sample data does not exist', async () => {
      const mockLimit = jest.fn().mockResolvedValue({ 
        data: [], 
        error: null 
      });
      const mockIn = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockSelect = jest.fn().mockReturnValue({ in: mockIn });
      const mockFrom = jest.fn().mockReturnValue({
        select: mockSelect,
      });
      
      mockSupabase.from = mockFrom;

      const result = await checkSampleDataExists();

      expect(result).toBe(false);
    });

    it('should return false when there is an error', async () => {
      const mockLimit = jest.fn().mockResolvedValue({ 
        data: null, 
        error: { message: 'Database error' } 
      });
      const mockIn = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockSelect = jest.fn().mockReturnValue({ in: mockIn });
      const mockFrom = jest.fn().mockReturnValue({
        select: mockSelect,
      });
      
      mockSupabase.from = mockFrom;

      const result = await checkSampleDataExists();

      expect(result).toBe(false);
    });
  });

  describe('initializeSampleData', () => {
    it('should populate data when it does not exist', async () => {
      // Mock checkSampleDataExists to return false
      const mockLimit = jest.fn().mockResolvedValue({ 
        data: [], 
        error: null 
      });
      const mockIn = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockSelect = jest.fn().mockReturnValue({ in: mockIn });
      
      // Mock populateSampleData
      const mockUpsert = jest.fn().mockResolvedValue({ data: {}, error: null });
      
      const mockFrom = jest.fn()
        .mockReturnValueOnce({
          select: mockSelect, // for checkSampleDataExists
        })
        .mockReturnValue({
          upsert: mockUpsert, // for populateSampleData
        });
      
      mockSupabase.from = mockFrom;

      await initializeSampleData();

      // Should check for existing data and then populate
      expect(mockFrom).toHaveBeenCalledWith('users');
      expect(mockUpsert).toHaveBeenCalled();
    });

    it('should not populate data when it already exists', async () => {
      // Mock checkSampleDataExists to return true
      const mockLimit = jest.fn().mockResolvedValue({ 
        data: [{ id: 'sample-id' }], 
        error: null 
      });
      const mockIn = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockSelect = jest.fn().mockReturnValue({ in: mockIn });
      const mockFrom = jest.fn().mockReturnValue({
        select: mockSelect,
      });
      
      mockSupabase.from = mockFrom;

      await initializeSampleData();

      // Should only check for existing data, not populate
      expect(mockFrom).toHaveBeenCalledWith('users');
      expect(mockFrom).toHaveBeenCalledTimes(1);
    });
  });
});