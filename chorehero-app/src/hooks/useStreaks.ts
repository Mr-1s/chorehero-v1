import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GAMIFICATION } from '../utils/constants';

interface StreakData {
  currentStreak: number;
  bestStreak: number;
  lastBookingDate: string | null;
  totalBookings: number;
  achievements: string[];
  points: number;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  points: number;
  unlockedAt?: string;
}

const STREAK_STORAGE_KEY = '@chorehero_streaks';

export const useStreaks = () => {
  const [streakData, setStreakData] = useState<StreakData>({
    currentStreak: 0,
    bestStreak: 0,
    lastBookingDate: null,
    totalBookings: 0,
    achievements: [],
    points: 0,
  });
  const [isActive, setIsActive] = useState(false);
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);

  // Load streak data from storage
  useEffect(() => {
    loadStreakData();
  }, []);

  // Check if streak is active (booking within last 24 hours)
  useEffect(() => {
    if (streakData.lastBookingDate) {
      const lastBooking = new Date(streakData.lastBookingDate);
      const now = new Date();
      const hoursDiff = (now.getTime() - lastBooking.getTime()) / (1000 * 60 * 60);
      setIsActive(hoursDiff <= 24);
    }
  }, [streakData.lastBookingDate]);

  const loadStreakData = async () => {
    try {
      const data = await AsyncStorage.getItem(STREAK_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        setStreakData(parsed);
      }
    } catch (error) {
      console.error('Error loading streak data:', error);
    }
  };

  const saveStreakData = async (data: StreakData) => {
    try {
      await AsyncStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(data));
      setStreakData(data);
    } catch (error) {
      console.error('Error saving streak data:', error);
    }
  };

  const recordBooking = useCallback(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    setStreakData(prev => {
      const newData = { ...prev };
      
      // Check if booking is on a new day
      if (prev.lastBookingDate !== today) {
        if (prev.lastBookingDate) {
          const lastBooking = new Date(prev.lastBookingDate);
          const daysDiff = Math.floor((now.getTime() - lastBooking.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysDiff === 1) {
            // Consecutive day - continue streak
            newData.currentStreak = prev.currentStreak + 1;
          } else if (daysDiff > 1) {
            // Streak broken - reset to 1
            newData.currentStreak = 1;
          }
        } else {
          // First booking
          newData.currentStreak = 1;
        }
        
        newData.lastBookingDate = today;
      }
      
      // Update best streak
      if (newData.currentStreak > newData.bestStreak) {
        newData.bestStreak = newData.currentStreak;
      }
      
      // Increment total bookings
      newData.totalBookings = prev.totalBookings + 1;
      
      // Check for achievements
      const achievements = checkAchievements(newData);
      newData.achievements = [...new Set([...prev.achievements, ...achievements])];
      
      // Calculate points
      newData.points = calculatePoints(newData);
      
      // Save to storage
      saveStreakData(newData);
      
      return newData;
    });
  }, []);

  const checkAchievements = (data: StreakData): string[] => {
    const newAchievements: string[] = [];
    const achievements: Achievement[] = [];
    
    // Check streak achievements
    if (data.currentStreak >= 7 && !data.achievements.includes('streak_master')) {
      newAchievements.push('streak_master');
      achievements.push({
        ...GAMIFICATION.achievements.STREAK_MASTER,
        unlockedAt: new Date().toISOString(),
      });
    }
    
    // Check explorer achievement
    if (data.totalBookings >= 5 && !data.achievements.includes('explorer')) {
      newAchievements.push('explorer');
      achievements.push({
        ...GAMIFICATION.achievements.EXPLORER,
        unlockedAt: new Date().toISOString(),
      });
    }
    
    // Check early bird achievement (would need time tracking)
    // This would be checked in the booking flow
    
    // Set new achievements for UI display
    if (achievements.length > 0) {
      setNewAchievements(achievements);
      
      // Clear new achievements after 5 seconds
      setTimeout(() => {
        setNewAchievements([]);
      }, 5000);
    }
    
    return newAchievements;
  };

  const calculatePoints = (data: StreakData): number => {
    let points = 0;
    
    // Base points for bookings
    points += data.totalBookings * 10;
    
    // Streak bonuses
    if (data.currentStreak >= 7) {
      points += GAMIFICATION.streaks.WEEKLY_BONUS;
    }
    if (data.currentStreak >= 30) {
      points += GAMIFICATION.streaks.MONTHLY_BONUS;
    }
    
    // Achievement points
    data.achievements.forEach(achievementId => {
      const achievement = Object.values(GAMIFICATION.achievements).find(a => a.id === achievementId);
      if (achievement) {
        points += achievement.points;
      }
    });
    
    return points;
  };

  const getStreakReward = useCallback(() => {
    const { currentStreak } = streakData;
    
    if (currentStreak === 7) {
      return GAMIFICATION.rewards.STREAK_7;
    } else if (currentStreak === 30) {
      return GAMIFICATION.rewards.STREAK_30;
    }
    
    return null;
  }, [streakData.currentStreak]);

  const resetStreak = useCallback(() => {
    const resetData = {
      ...streakData,
      currentStreak: 0,
      lastBookingDate: null,
    };
    
    saveStreakData(resetData);
  }, [streakData]);

  const getStreakProgress = useCallback(() => {
    const { currentStreak } = streakData;
    const nextMilestone = currentStreak < 7 ? 7 : currentStreak < 30 ? 30 : 50;
    const progress = currentStreak / nextMilestone;
    
    return {
      current: currentStreak,
      nextMilestone,
      progress: Math.min(progress, 1),
      daysToNext: nextMilestone - currentStreak,
    };
  }, [streakData.currentStreak]);

  return {
    currentStreak: streakData.currentStreak,
    bestStreak: streakData.bestStreak,
    totalBookings: streakData.totalBookings,
    achievements: streakData.achievements,
    points: streakData.points,
    isActive,
    newAchievements,
    recordBooking,
    getStreakReward,
    resetStreak,
    getStreakProgress,
  };
}; 