/**
 * Tutorial Hook
 * Manages tutorial state and triggers
 */

import { useState, useEffect, useCallback } from 'react';
import { Tutorial, tutorialService } from '../services/tutorialService';
import { useAuth } from './useAuth';

export const useTutorial = () => {
  const [currentTutorial, setCurrentTutorial] = useState<Tutorial | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const { user } = useAuth();

  /**
   * Check for tutorials that should trigger on first login
   */
  const checkFirstLoginTutorials = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const tutorials = await tutorialService.getTriggeredTutorials(
        'first_login',
        user.id,
        user.role as 'customer' | 'cleaner'
      );
      
      if (tutorials.length > 0) {
        startTutorial(tutorials[0]);
      }
    } catch (error) {
      console.error('Error checking first login tutorials:', error);
    }
  }, [user?.id, user?.role]);

  /**
   * Check for tutorials that should trigger on feature unlock
   */
  const checkFeatureUnlockTutorials = useCallback(async (feature: string) => {
    if (!user?.id) return;
    
    try {
      const tutorials = await tutorialService.getTriggeredTutorials(
        'feature_unlock',
        user.id,
        user.role as 'customer' | 'cleaner'
      );
      
      // Filter tutorials relevant to the specific feature
      const relevantTutorials = tutorials.filter(tutorial => 
        tutorial.steps.some(step => step.targetElement?.includes(feature))
      );
      
      if (relevantTutorials.length > 0) {
        startTutorial(relevantTutorials[0]);
      }
    } catch (error) {
      console.error('Error checking feature unlock tutorials:', error);
    }
  }, [user?.id, user?.role]);

  /**
   * Start a specific tutorial
   */
  const startTutorial = useCallback((tutorial: Tutorial) => {
    setCurrentTutorial(tutorial);
    setCurrentStepIndex(0);
    setIsActive(true);
  }, []);

  /**
   * Start tutorial by ID
   */
  const startTutorialById = useCallback(async (tutorialId: string) => {
    const tutorial = tutorialService.getTutorial(tutorialId);
    if (tutorial) {
      startTutorial(tutorial);
    }
  }, [startTutorial]);

  /**
   * Move to next step
   */
  const nextStep = useCallback(() => {
    if (!currentTutorial) return;
    
    if (currentStepIndex < currentTutorial.steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      completeTutorial();
    }
  }, [currentTutorial, currentStepIndex]);

  /**
   * Complete current tutorial
   */
  const completeTutorial = useCallback(() => {
    setCurrentTutorial(null);
    setCurrentStepIndex(0);
    setIsActive(false);
  }, []);

  /**
   * Skip current tutorial
   */
  const skipTutorial = useCallback(() => {
    setCurrentTutorial(null);
    setCurrentStepIndex(0);
    setIsActive(false);
  }, []);

  /**
   * Trigger tutorial for specific screen/feature
   */
  const triggerTutorial = useCallback(async (context: {
    screen?: string;
    feature?: string;
    action?: string;
  }) => {
    if (!user?.id) return;

    try {
      // Check if this context should trigger a tutorial
      const allTutorials = await tutorialService.getTriggeredTutorials(
        'feature_unlock',
        user.id,
        user.role as 'customer' | 'cleaner'
      );

      // Find tutorials that match the context
      const matchingTutorials = allTutorials.filter(tutorial => {
        return tutorial.steps.some(step => {
          if (context.screen && step.id.includes(context.screen)) return true;
          if (context.feature && step.targetElement?.includes(context.feature)) return true;
          if (context.action && step.action === context.action) return true;
          return false;
        });
      });

      if (matchingTutorials.length > 0) {
        startTutorial(matchingTutorials[0]);
      }
    } catch (error) {
      console.error('Error triggering tutorial:', error);
    }
  }, [user?.id, user?.role, startTutorial]);

  /**
   * Check if user has completed a specific tutorial
   */
  const hasTutorialCompleted = useCallback(async (tutorialId: string): Promise<boolean> => {
    if (!user?.id) return false;
    
    return !(await tutorialService.shouldShowTutorial(
      tutorialId, 
      user.id, 
      user.role as 'customer' | 'cleaner'
    ));
  }, [user?.id, user?.role]);

  /**
   * Reset all tutorial progress (for testing)
   */
  const resetAllTutorials = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      await tutorialService.resetTutorialProgress(user.id);
      console.log('All tutorial progress reset');
    } catch (error) {
      console.error('Error resetting tutorials:', error);
    }
  }, [user?.id]);

  // Auto-check for first login tutorials when user changes
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (user?.id && !isActive) {
      // Delay to ensure UI has loaded
      timeoutId = setTimeout(() => {
        checkFirstLoginTutorials();
      }, 2000);
    }
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [user?.id, isActive, checkFirstLoginTutorials]);

  return {
    // State
    currentTutorial,
    currentStepIndex,
    isActive,
    
    // Actions
    startTutorial,
    startTutorialById,
    nextStep,
    completeTutorial,
    skipTutorial,
    triggerTutorial,
    
    // Checks
    checkFirstLoginTutorials,
    checkFeatureUnlockTutorials,
    hasTutorialCompleted,
    
    // Utils
    resetAllTutorials,
  };
};
