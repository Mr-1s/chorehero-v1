import { supabase } from './supabase';
import { bookingTemplateService } from './bookingTemplateService';

export interface IncentiveBenefit {
  id: string;
  title: string;
  description: string;
  icon: string;
  value: string;
  isUnlocked: boolean;
}

export interface CustomizationLevel {
  level: number;
  title: string;
  description: string;
  requirements: string[];
  benefits: IncentiveBenefit[];
  isUnlocked: boolean;
  progress: number; // 0-100
}

export interface CleanerIncentiveStats {
  customization_score: number;
  completion_rate_bonus: number;
  customer_rating_bonus: number;
  profile_completeness: number;
  total_incentive_earned: number;
  next_level_progress: number;
}

class CleanerIncentiveService {
  /**
   * Calculate incentive benefits for customizing booking flow
   */
  async calculateIncentives(cleanerId: string): Promise<CleanerIncentiveStats> {
    try {
      // Get cleaner's templates and analytics
      const [templatesResult, preferencesResult] = await Promise.all([
        bookingTemplateService.getCleanerTemplates(cleanerId),
        bookingTemplateService.getBookingPreferences(cleanerId),
      ]);

      const templates = templatesResult.data || [];
      const activeTemplate = templates.find(t => t.is_active);
      
      let customization_score = 0;
      let completion_rate_bonus = 0;
      let customer_rating_bonus = 0;
      let profile_completeness = 0;

      // Base customization score
      if (activeTemplate) {
        customization_score += 20; // Base for having active template

        // Bonus for custom questions
        const questionsResult = await bookingTemplateService.getTemplateQuestions(activeTemplate.id);
        const customQuestions = questionsResult.data?.length || 0;
        customization_score += Math.min(customQuestions * 5, 25); // Up to 25 points

        // Bonus for custom add-ons
        const addonsResult = await bookingTemplateService.getTemplateAddons(activeTemplate.id);
        const customAddons = addonsResult.data?.length || 0;
        customization_score += Math.min(customAddons * 3, 15); // Up to 15 points

        // Bonus for multiple templates
        customization_score += Math.min((templates.length - 1) * 10, 30); // Up to 30 points

        // Performance bonuses
        completion_rate_bonus = Math.max(0, (activeTemplate.completion_rate - 50) * 0.5);
        customer_rating_bonus = Math.max(0, (activeTemplate.customer_rating - 4.0) * 20);
      }

      // Profile completeness calculation
      if (preferencesResult.data) {
        const prefs = preferencesResult.data;
        let completeness = 0;
        
        if (prefs.minimum_booking_hours > 0) completeness += 10;
        if (prefs.advance_notice_hours > 0) completeness += 10;
        if (prefs.cancellation_policy) completeness += 15;
        if (prefs.custom_cancellation_fee !== undefined) completeness += 10;
        if (prefs.travel_fee_per_mile > 0) completeness += 10;
        
        profile_completeness = completeness;
        customization_score += completeness * 0.5; // Bonus for profile completeness
      }

      const total_incentive_earned = customization_score + completion_rate_bonus + customer_rating_bonus;
      const next_level_progress = (total_incentive_earned % 100) / 100 * 100;

      return {
        customization_score: Math.round(customization_score),
        completion_rate_bonus: Math.round(completion_rate_bonus),
        customer_rating_bonus: Math.round(customer_rating_bonus),
        profile_completeness: Math.round(profile_completeness),
        total_incentive_earned: Math.round(total_incentive_earned),
        next_level_progress: Math.round(next_level_progress),
      };
    } catch (error) {
      console.error('Error calculating incentives:', error);
      return {
        customization_score: 0,
        completion_rate_bonus: 0,
        customer_rating_bonus: 0,
        profile_completeness: 0,
        total_incentive_earned: 0,
        next_level_progress: 0,
      };
    }
  }

  /**
   * Get customization levels and benefits
   */
  getCustomizationLevels(stats: CleanerIncentiveStats): CustomizationLevel[] {
    const currentLevel = Math.floor(stats.total_incentive_earned / 100);

    return [
      {
        level: 1,
        title: "Getting Started",
        description: "Create your first custom booking template",
        requirements: [
          "Create and activate a booking template",
          "Add a custom description",
          "Set your basic preferences"
        ],
        benefits: [
          {
            id: "basic_customization",
            title: "Basic Customization",
            description: "Customize booking flow steps and descriptions",
            icon: "construct-outline",
            value: "Unlocked",
            isUnlocked: currentLevel >= 1
          },
          {
            id: "profile_badge",
            title: "Customized Profile Badge",
            description: "Show customers you offer personalized service",
            icon: "ribbon-outline",
            value: "Featured",
            isUnlocked: currentLevel >= 1
          }
        ],
        isUnlocked: currentLevel >= 1,
        progress: currentLevel >= 1 ? 100 : Math.min(stats.total_incentive_earned, 100)
      },
      {
        level: 2,
        title: "Professional",
        description: "Add custom questions and specialized services",
        requirements: [
          "Add 3+ custom questions",
          "Create 2+ custom add-ons",
          "Maintain 60%+ completion rate"
        ],
        benefits: [
          {
            id: "custom_questions",
            title: "Unlimited Custom Questions",
            description: "Ask customers exactly what you need to know",
            icon: "help-circle-outline",
            value: "Unlimited",
            isUnlocked: currentLevel >= 2
          },
          {
            id: "priority_listing",
            title: "Priority in Search Results",
            description: "Appear higher in customer searches",
            icon: "trending-up-outline",
            value: "+25% visibility",
            isUnlocked: currentLevel >= 2
          },
          {
            id: "custom_addons",
            title: "Custom Add-on Services",
            description: "Offer your specialized cleaning services",
            icon: "add-circle-outline",
            value: "Unlimited",
            isUnlocked: currentLevel >= 2
          }
        ],
        isUnlocked: currentLevel >= 2,
        progress: currentLevel >= 2 ? 100 : Math.max(0, Math.min((stats.total_incentive_earned - 100) / 100 * 100, 100))
      },
      {
        level: 3,
        title: "Elite Cleaner",
        description: "Multiple templates and premium features",
        requirements: [
          "Create 2+ different templates",
          "Maintain 4.5+ star rating",
          "Complete 25+ bookings"
        ],
        benefits: [
          {
            id: "multiple_templates",
            title: "Multiple Booking Templates",
            description: "Different flows for different service types",
            icon: "copy-outline",
            value: "Unlimited",
            isUnlocked: currentLevel >= 3
          },
          {
            id: "analytics_dashboard",
            title: "Advanced Analytics",
            description: "Track template performance and customer behavior",
            icon: "analytics-outline",
            value: "Full access",
            isUnlocked: currentLevel >= 3
          },
          {
            id: "commission_reduction",
            title: "Reduced Platform Fee",
            description: "Lower commission on customized bookings",
            icon: "wallet-outline",
            value: "-2% fee",
            isUnlocked: currentLevel >= 3
          }
        ],
        isUnlocked: currentLevel >= 3,
        progress: currentLevel >= 3 ? 100 : Math.max(0, Math.min((stats.total_incentive_earned - 200) / 100 * 100, 100))
      },
      {
        level: 4,
        title: "Master Professional",
        description: "Top-tier customization and exclusive benefits",
        requirements: [
          "Maintain 80%+ completion rate",
          "5.0 star average rating",
          "100+ completed bookings"
        ],
        benefits: [
          {
            id: "featured_placement",
            title: "Featured Cleaner Status",
            description: "Premium placement across the app",
            icon: "star-outline",
            value: "Featured",
            isUnlocked: currentLevel >= 4
          },
          {
            id: "direct_booking",
            title: "Direct Booking Links",
            description: "Share custom booking links for your templates",
            icon: "link-outline",
            value: "Custom URLs",
            isUnlocked: currentLevel >= 4
          },
          {
            id: "priority_support",
            title: "Priority Customer Support",
            description: "Dedicated support for template optimization",
            icon: "headset-outline",
            value: "24/7 priority",
            isUnlocked: currentLevel >= 4
          },
          {
            id: "referral_bonus",
            title: "Enhanced Referral Rewards",
            description: "Higher bonuses for referring new cleaners",
            icon: "people-outline",
            value: "+50% bonus",
            isUnlocked: currentLevel >= 4
          }
        ],
        isUnlocked: currentLevel >= 4,
        progress: currentLevel >= 4 ? 100 : Math.max(0, Math.min((stats.total_incentive_earned - 300) / 100 * 100, 100))
      }
    ];
  }

  /**
   * Get next achievable milestone
   */
  getNextMilestone(stats: CleanerIncentiveStats): { title: string; description: string; progress: number; target: number } | null {
    const levels = this.getCustomizationLevels(stats);
    const nextLevel = levels.find(level => !level.isUnlocked);
    
    if (!nextLevel) return null;

    return {
      title: `Reach ${nextLevel.title}`,
      description: nextLevel.requirements[0], // Show first requirement
      progress: stats.total_incentive_earned,
      target: nextLevel.level * 100
    };
  }

  /**
   * Get completion tips for improving customization score
   */
  getImprovementTips(cleanerId: string, stats: CleanerIncentiveStats): string[] {
    const tips = [];

    if (stats.customization_score < 20) {
      tips.push("🎯 Create your first booking template to start earning customization points");
    }

    if (stats.customization_score < 50) {
      tips.push("❓ Add custom questions to better understand your customers' needs");
      tips.push("⭐ Create specialized add-on services to increase your earnings");
    }

    if (stats.completion_rate_bonus < 10) {
      tips.push("📈 Improve your booking completion rate by simplifying your flow");
    }

    if (stats.customer_rating_bonus < 10) {
      tips.push("⭐ Focus on excellent service to boost your customer ratings");
    }

    if (stats.profile_completeness < 50) {
      tips.push("📝 Complete your booking preferences for a professional appearance");
    }

    if (tips.length === 0) {
      tips.push("🚀 You're doing great! Create additional templates for different service types");
      tips.push("📊 Monitor your analytics to optimize template performance");
    }

    return tips;
  }

  /**
   * Track customization milestones
   */
  async trackMilestone(cleanerId: string, milestone: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('cleaner_milestones')
        .insert({
          cleaner_id: cleanerId,
          milestone_type: 'customization',
          milestone_name: milestone,
          achieved_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error tracking milestone:', error);
      }
    } catch (error) {
      console.error('Error tracking milestone:', error);
    }
  }

  /**
   * Calculate booking flow optimization score
   */
  async getOptimizationScore(templateId: string): Promise<{
    score: number;
    suggestions: string[];
    strengths: string[];
  }> {
    try {
      const [stepsResult, questionsResult, addonsResult, analyticsResult] = await Promise.all([
        bookingTemplateService.getTemplateFlowSteps(templateId),
        bookingTemplateService.getTemplateQuestions(templateId),
        bookingTemplateService.getTemplateAddons(templateId),
        bookingTemplateService.getTemplateAnalytics(templateId, 30),
      ]);

      const steps = stepsResult.data || [];
      const questions = questionsResult.data || [];
      const addons = addonsResult.data || [];
      const analytics = analyticsResult.data || [];

      let score = 0;
      const suggestions = [];
      const strengths = [];

      // Flow length optimization
      if (steps.length >= 3 && steps.length <= 6) {
        score += 20;
        strengths.push("Optimal flow length (3-6 steps)");
      } else if (steps.length > 6) {
        suggestions.push("Consider reducing steps - shorter flows have higher completion rates");
      } else {
        suggestions.push("Add more steps to gather necessary information");
      }

      // Question optimization
      if (questions.length > 0) {
        score += 15;
        strengths.push("Custom questions help personalize service");
        
        if (questions.filter(q => q.is_required).length <= 2) {
          score += 10;
          strengths.push("Good balance of required vs optional questions");
        } else {
          suggestions.push("Reduce required questions to improve completion rate");
        }
      } else {
        suggestions.push("Add 2-3 custom questions to better understand customer needs");
      }

      // Add-on optimization
      if (addons.length >= 2 && addons.length <= 5) {
        score += 15;
        strengths.push("Good variety of add-on services");
      } else if (addons.length > 5) {
        suggestions.push("Too many add-ons can overwhelm customers");
      } else {
        suggestions.push("Add specialized services to increase average booking value");
      }

      // Performance based scoring
      if (analytics.length > 0) {
        const totalViews = analytics.reduce((sum, a) => sum + a.views_count, 0);
        const totalCompleted = analytics.reduce((sum, a) => sum + a.completed_count, 0);
        const completionRate = totalViews > 0 ? (totalCompleted / totalViews) * 100 : 0;

        if (completionRate >= 70) {
          score += 25;
          strengths.push("Excellent completion rate");
        } else if (completionRate >= 50) {
          score += 15;
          suggestions.push("Simplify flow to improve completion rate");
        } else {
          suggestions.push("Flow may be too complex - consider reducing steps");
        }
      }

      // Pricing strategy
      const addonPrices = addons.map(a => a.price);
      if (addonPrices.length > 0) {
        const avgPrice = addonPrices.reduce((sum, p) => sum + p, 0) / addonPrices.length;
        if (avgPrice >= 15 && avgPrice <= 50) {
          score += 15;
          strengths.push("Competitive add-on pricing");
        } else if (avgPrice > 50) {
          suggestions.push("Consider more affordable add-on options");
        } else {
          suggestions.push("Increase add-on prices to better reflect service value");
        }
      }

      return {
        score: Math.min(100, score),
        suggestions,
        strengths
      };
    } catch (error) {
      console.error('Error calculating optimization score:', error);
      return {
        score: 0,
        suggestions: ["Unable to analyze template performance"],
        strengths: []
      };
    }
  }
}

export const cleanerIncentiveService = new CleanerIncentiveService();
