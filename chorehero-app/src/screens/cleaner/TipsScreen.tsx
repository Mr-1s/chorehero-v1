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
  Dimensions,
  SafeAreaView,
  StatusBar,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import CleanerFloatingNavigation from '../../components/CleanerFloatingNavigation';
import { CleanerStatTile } from '../../components/cleaner';
import { cleanerTheme } from '../../utils/theme';

const { width } = Dimensions.get('window');
const { colors, typography, radii, shadows } = cleanerTheme;

// Tips data
const TIPS_CATEGORIES = [
  {
    id: 'filming',
    title: 'Filming Basics',
    icon: 'videocam',
    color: colors.accentTeal,
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
    color: '#EF4444',
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
    color: '#8B5CF6',
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

  // Animation refs
  const bannerFade = useRef(new Animated.Value(0)).current;
  const bannerSlide = useRef(new Animated.Value(-20)).current;
  const statsFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Banner animation
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

    // Stats animation (delayed)
    Animated.timing(statsFade, {
      toValue: 1,
      duration: 400,
      delay: 300,
      useNativeDriver: true,
    }).start();
  }, []);

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
      
      {/* Header Banner */}
      <Animated.View 
        style={[
          styles.header, 
          { 
            opacity: bannerFade, 
            transform: [{ translateY: bannerSlide }] 
          }
        ]}
      >
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          {/* Subtle pattern overlay */}
          <View style={styles.patternOverlay} />
          
          <View style={styles.headerContent}>
            <Ionicons name="bulb" size={28} color="#FFFFFF" />
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Video Tips & Tricks</Text>
              <Text style={styles.headerSubtitle}>Create content that converts</Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Quick Stats */}
      <Animated.View style={[styles.statsContainer, { opacity: statsFade }]}>
        <CleanerStatTile
          icon="eye"
          value="3x"
          label="More Views"
          color={colors.accentTeal}
          animateIn
          animationDelay={400}
        />
        <CleanerStatTile
          icon="calendar"
          value="2x"
          label="More Bookings"
          color={colors.primary}
          animateIn
          animationDelay={500}
        />
        <CleanerStatTile
          icon="star"
          value="Top"
          label="Performer"
          color="#8B5CF6"
          animateIn
          animationDelay={600}
        />
      </Animated.View>

      {/* Tips Categories */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Master Your Content</Text>
        
        {TIPS_CATEGORIES.map((category) => (
          <CategorySection
            key={category.id}
            category={category}
            isExpanded={expandedCategories.has(category.id)}
            onToggle={() => toggleCategory(category.id)}
          />
        ))}

        {/* CTA */}
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => navigation.navigate('VideoUpload')}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGradient}
          >
            <Ionicons name="videocam" size={24} color="#FFFFFF" />
            <Text style={styles.ctaText}>Start Recording Now</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Bottom spacing for nav */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Navigation */}
      <CleanerFloatingNavigation navigation={navigation} currentScreen="Heroes" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  headerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  patternOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.1,
    backgroundColor: 'transparent',
    // Subtle diagonal stripes pattern effect
    borderWidth: 0,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  headerTextContainer: {
    marginLeft: 16,
  },
  headerTitle: {
    ...typography.headingXL,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  headerSubtitle: {
    ...typography.label,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    ...typography.headingL,
    color: colors.textPrimary,
    marginBottom: 16,
  },
  categoryContainer: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.card,
    marginBottom: 12,
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
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTitle: {
    ...typography.cardTitle,
    color: colors.textPrimary,
    marginLeft: 12,
  },
  tipsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  tipIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
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
    marginBottom: 4,
  },
  tipDescription: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
    lineHeight: 18,
  },
  ctaButton: {
    marginTop: 24,
    borderRadius: radii.card,
    overflow: 'hidden',
    ...shadows.soft,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    gap: 10,
  },
  ctaText: {
    ...typography.cardTitle,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default TipsScreen;
