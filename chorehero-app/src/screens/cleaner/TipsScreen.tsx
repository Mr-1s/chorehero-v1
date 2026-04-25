/**
 * TipsScreen - Video recording tips and insights for cleaners
 * 
 * Provides guidance on how to create better video content,
 * tips for showcasing work, and best practices.
 * 
 * Updated to use CleanerTheme and shared components.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { cleanerTheme } from '../../utils/theme';
import { useCleanerStore } from '../../store/cleanerStore';
import { wp, hp } from '../../utils/responsive';

const { colors, typography, radii, shadows, spacing } = cleanerTheme;
const BRAND_ORANGE = '#FFA52F';
const BRAND_ORANGE_DARK = '#E8941A';

// Tips data
const TIPS_CATEGORIES = [
  {
    id: 'filming',
    title: 'Filming Basics',
    icon: 'videocam',
    color: BRAND_ORANGE,
    tips: [
      {
        title: 'Good Lighting is Key',
        description: 'Film during daylight hours or use bright, even lighting. Natural light from windows works great!',
        icon: 'sunny',
      },
      {
        title: 'Steady Your Shot',
        description: 'Use a tripod or prop your phone against something stable. Shaky footage looks unprofessional.',
        icon: 'hand-left',
      },
      {
        title: 'Landscape Mode',
        description: 'Hold your phone horizontally for wider shots that show more of your work area.',
        icon: 'phone-landscape',
      },
      {
        title: 'Clean Your Lens',
        description: 'A quick wipe of your camera lens makes a huge difference in video clarity.',
        icon: 'eye',
      },
    ],
  },
  {
    id: 'content',
    title: 'Content Ideas',
    icon: 'bulb',
    color: colors.primary,
    tips: [
      {
        title: 'Before & After Shots',
        description: 'Show the transformation! Start with the messy space, then reveal the clean result.',
        icon: 'swap-horizontal',
      },
      {
        title: 'Time-Lapse Magic',
        description: 'Record your entire cleaning session and speed it up. Satisfying to watch!',
        icon: 'time',
      },
      {
        title: 'Focus on Details',
        description: 'Close-ups of sparkling surfaces, organized shelves, and pristine corners impress viewers.',
        icon: 'search',
      },
      {
        title: 'Show Your Process',
        description: 'Walk viewers through your cleaning routine. Educational content builds trust.',
        icon: 'list',
      },
    ],
  },
  {
    id: 'engagement',
    title: 'Boost Engagement',
    icon: 'heart',
    color: BRAND_ORANGE_DARK,
    tips: [
      {
        title: 'Keep It Short',
        description: '15-30 seconds is ideal. Attention spans are short—make every second count!',
        icon: 'timer',
      },
      {
        title: 'Add Music',
        description: 'Upbeat background music makes your videos more enjoyable. Use royalty-free tracks.',
        icon: 'musical-notes',
      },
      {
        title: 'Post Consistently',
        description: 'Regular uploads keep you visible. Aim for 2-3 videos per week.',
        icon: 'calendar',
      },
      {
        title: 'Engage with Comments',
        description: 'Reply to questions and thank viewers. Building community leads to more bookings.',
        icon: 'chatbubbles',
      },
    ],
  },
  {
    id: 'professional',
    title: 'Pro Tips',
    icon: 'star',
    color: '#F59E0B',
    tips: [
      {
        title: 'Wear Your Brand',
        description: 'Consistent uniforms or branded clothing makes you look professional and memorable.',
        icon: 'shirt',
      },
      {
        title: 'Show Your Tools',
        description: 'Quality equipment signals professionalism. Feature your favorite cleaning products.',
        icon: 'construct',
      },
      {
        title: 'Get Permission',
        description: 'Always ask clients before filming in their space. Respect privacy!',
        icon: 'shield-checkmark',
      },
      {
        title: 'Tell Your Story',
        description: 'Share why you love cleaning. Personal connection converts viewers to clients.',
        icon: 'person-circle',
      },
    ],
  },
];

interface TipCardProps {
  title: string;
  description: string;
  icon: string;
  color: string;
}

const TipCard: React.FC<TipCardProps> = ({ title, description, icon, color }) => (
  <View style={styles.tipCard}>
    <View style={[styles.tipIconContainer, { backgroundColor: `${color}20` }]}>
      <Ionicons name={icon as any} size={24} color={color} />
    </View>
    <View style={styles.tipContent}>
      <Text style={styles.tipTitle}>{title}</Text>
      <Text style={styles.tipDescription}>{description}</Text>
    </View>
  </View>
);

interface CategorySectionProps {
  category: typeof TIPS_CATEGORIES[0];
  isExpanded: boolean;
  onToggle: () => void;
}

const CategorySection: React.FC<CategorySectionProps> = ({ category, isExpanded, onToggle }) => (
  <View style={styles.categoryContainer}>
    <TouchableOpacity style={styles.categoryHeader} onPress={onToggle} activeOpacity={0.8}>
      <View style={styles.categoryHeaderLeft}>
        <View style={[styles.categoryIcon, { backgroundColor: `${category.color}20` }]}>
          <Ionicons name={category.icon as any} size={24} color={category.color} />
        </View>
        <Text style={styles.categoryTitle}>{category.title}</Text>
      </View>
      <Ionicons
        name={isExpanded ? 'chevron-up' : 'chevron-down'}
        size={24}
        color={colors.textSecondary}
      />
    </TouchableOpacity>
    
    {isExpanded && (
      <View style={styles.tipsContainer}>
        {category.tips.map((tip, index) => (
          <TipCard
            key={index}
            title={tip.title}
            description={tip.description}
            icon={tip.icon}
            color={category.color}
          />
        ))}
      </View>
    )}
  </View>
);

const TipsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['filming']));
  const { currentCleaner, availableBookings, activeBookings, fetchDashboard, isLoading } = useCleanerStore();
  const openJobsCount = availableBookings.length;
  const hasLiveDemand = openJobsCount > 0;

  // Animation refs
  const bannerFade = useRef(new Animated.Value(0)).current;
  const bannerSlide = useRef(new Animated.Value(-20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(bannerFade, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(bannerSlide, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!currentCleaner && !isLoading) {
      fetchDashboard();
    }
  }, [currentCleaner, isLoading, fetchDashboard]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.mainScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Earnings Header */}
        <View style={styles.earningsHeader}>
          <View style={styles.earningsBlock}>
            <Text style={styles.earningsLabel}>Earned this Week</Text>
            <Text style={styles.earningsValue}>
              {currentCleaner ? `$${Math.round(currentCleaner.weeklyEarnings)}` : '$0'}
            </Text>
          </View>
          <View style={styles.earningsDivider} />
          <View style={styles.earningsBlock}>
            <Text style={styles.earningsLabel}>Open Jobs Nearby</Text>
            <Text style={styles.earningsValue}>{openJobsCount}</Text>
          </View>
        </View>

        {/* Get booked: compact card (not full-width orange) */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: bannerFade,
              transform: [{ translateY: bannerSlide }],
            },
          ]}
        >
          <View style={styles.getBookedCard}>
            <View style={styles.getBookedAccent} />
            <View style={styles.getBookedInner}>
              <Ionicons name="sparkles" size={26} color={BRAND_ORANGE} />
              <View style={styles.headerTextContainer}>
                <Text style={styles.getBookedTitle}>Get Booked Fast</Text>
                <Text style={styles.getBookedSubtitle}>
                  {hasLiveDemand
                    ? `${openJobsCount} open jobs nearby right now`
                    : 'New local jobs will appear here first—check Jobs often.'}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Primary CTA: quote jobs */}
        <TouchableOpacity
          style={styles.quoteJobsBanner}
          onPress={() => navigation.navigate('Jobs', { initialTab: 'available' })}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={[BRAND_ORANGE, BRAND_ORANGE_DARK]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.quoteJobsGradient}
          >
            <Ionicons name="videocam" size={24} color="#fff" />
            <View style={styles.quoteJobsText}>
              <Text style={styles.quoteJobsTitle}>
                {hasLiveDemand ? `Browse quote jobs (${openJobsCount} new)` : 'Browse quote jobs'}
              </Text>
              <Text style={styles.quoteJobsSubtitle}>
                {activeBookings.length > 0
                  ? `You have ${activeBookings.length} active job${activeBookings.length > 1 ? 's' : ''} in progress`
                  : 'Send quick video quotes and get booked.'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.9)" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Tips Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Content Playbook</Text>

          {TIPS_CATEGORIES.map((category) => (
            <CategorySection
              key={category.id}
              category={category}
              isExpanded={expandedCategories.has(category.id)}
              onToggle={() => toggleCategory(category.id)}
            />
          ))}
        </View>

        <TouchableOpacity
          style={styles.ctaButtonOutline}
          onPress={() => navigation.navigate('VideoUpload')}
          activeOpacity={0.9}
        >
          <Ionicons name="videocam" size={22} color={BRAND_ORANGE} />
          <Text style={styles.ctaTextOutline}>Start recording</Text>
        </TouchableOpacity>

        <View style={{ height: 120 }} />
      </ScrollView>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  earningsHeader: {
    marginHorizontal: wp('5%'),
    marginTop: hp('2%'),
    marginBottom: hp('1.5%'),
    backgroundColor: '#FFFFFF',
    borderRadius: wp('4.5%'),
    paddingVertical: hp('1.7%'),
    paddingHorizontal: wp('4%'),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    ...shadows.soft,
  },
  earningsBlock: {
    flex: 1,
    alignItems: 'center',
  },
  earningsDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(148, 163, 184, 0.4)',
  },
  earningsLabel: {
    fontSize: wp('3%'),
    color: colors.textMuted,
    marginBottom: hp('0.5%'),
    fontWeight: '600',
  },
  earningsValue: {
    fontSize: wp('5%'),
    fontWeight: '800',
    color: colors.textPrimary,
  },
  header: {
    paddingHorizontal: wp('5%'),
    paddingTop: hp('1.2%'),
    paddingBottom: hp('1%'),
  },
  getBookedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    flexDirection: 'row',
    overflow: 'hidden',
    ...shadows.soft,
  },
  getBookedAccent: { width: 4, backgroundColor: BRAND_ORANGE },
  getBookedInner: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  headerTextContainer: { flex: 1 },
  getBookedTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.2 },
  getBookedSubtitle: { ...typography.label, color: colors.textSecondary, marginTop: 4 },
  quoteJobsBanner: {
    marginHorizontal: wp('5%'),
    marginBottom: hp('2%'),
    borderRadius: radii.card,
    overflow: 'hidden',
    shadowColor: BRAND_ORANGE,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },
  quoteJobsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: wp('4%'),
    gap: wp('3%'),
  },
  quoteJobsText: { flex: 1 },
  quoteJobsTitle: { fontSize: wp('4%'), fontWeight: '700', color: '#fff' },
  quoteJobsSubtitle: { fontSize: wp('3%'), color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  mainScroll: {
    flex: 1,
  },
  mainScrollContent: {
    flexGrow: 1,
  },
  section: {
    marginTop: hp('2%'),
    paddingHorizontal: wp('5%'),
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#374151',
    marginBottom: spacing.lg,
    letterSpacing: -0.2,
  },
  categoryContainer: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.card,
    marginBottom: hp('1.5%'),
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.soft,
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: wp('3%'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTitle: {
    ...typography.cardTitle,
    color: colors.textPrimary,
    marginLeft: 12,
  },
  tipsContainer: {
    paddingHorizontal: wp('4%'),
    paddingBottom: hp('2%'),
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderRadius: wp('3%'),
    padding: 14,
    marginTop: hp('1.2%'),
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  tipIconContainer: {
    width: 44,
    height: 44,
    borderRadius: wp('3%'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipContent: {
    flex: 1,
    marginLeft: 12,
  },
  tipTitle: {
    ...typography.label,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: hp('0.5%'),
  },
  tipDescription: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
    lineHeight: 18,
  },
  ctaButtonOutline: {
    marginTop: hp('2%'),
    marginHorizontal: wp('5%'),
    borderRadius: radii.card,
    borderWidth: 2,
    borderColor: BRAND_ORANGE,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 10,
  },
  ctaTextOutline: { fontSize: 16, fontWeight: '700', color: BRAND_ORANGE },
});

export default TipsScreen;
