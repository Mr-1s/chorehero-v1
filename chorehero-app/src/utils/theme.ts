/**
 * ChoreHero Design System Theme
 * 
 * Centralized design tokens for consistent styling across the app.
 * Used by: Video Feed, Bottom Sheet, Profile Screen, Nav Bar
 */

// ============================================================================
// COLORS
// ============================================================================

export const colors = {
  // Primary brand color (teal)
  primaryTeal: '#3AD3DB',
  primaryTealDark: '#2BC8D4',
  primaryTealSoft: '#E0F7FA',
  primaryTealBorder: 'rgba(58, 211, 219, 0.3)',
  
  // Backgrounds
  neutralBg: '#FFFFFF',
  cardBg: '#F6F7FB',
  pageBg: '#F9FAFB',
  chipBg: '#F6F7FB',
  
  // Text colors
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textInverse: '#FFFFFF',
  
  // Borders
  borderSubtle: '#E5E7EB',
  borderLight: '#F3F4F6',
  
  // Semantic colors
  star: '#F59E0B',
  starLight: '#FEF3C7',
  success: '#10B981',
  successLight: '#D1FAE5',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  
  // Award/badge colors (softer yellow to keep teal as strongest CTA)
  awardGold: '#F9A600',
  awardGoldLight: '#FFF6D6',
  awardGoldText: '#B87503',
  
  // Verification badge
  verifiedTeal: '#3AD3DB',
  verifiedTealLight: '#CCFBF1',
  verifiedTealText: '#0D9488',
  
  // Shadows
  shadowColor: '#000000',
  
  // Overlay
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.15)',
};

// ============================================================================
// TYPOGRAPHY
// ============================================================================

export const typography = {
  // Font sizes
  sizes: {
    titleLg: 22,
    titleMd: 18,
    titleSm: 16,
    body: 14,
    bodyLg: 15,
    caption: 13,
    captionSm: 12,
    tiny: 11,
  },
  
  // Font weights
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
  
  // Line heights
  lineHeights: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
    loose: 1.8,
  },
  
  // Identity header typography (used across feed, sheet, profile)
  identity: {
    name: {
      size: 18,
      weight: '600' as const,
      lineHeight: 24,
    },
    handle: {
      size: 13,
      weight: '400' as const,
      lineHeight: 18,
      opacity: 0.8,
    },
    meta: {
      size: 13,
      weight: '400' as const,
      lineHeight: 18,
      opacity: 0.8,
    },
  },
};

// ============================================================================
// SPACING
// ============================================================================

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// ============================================================================
// RADII
// ============================================================================

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  card: 24,
  pill: 999,
};

// ============================================================================
// SHADOWS
// ============================================================================

export const shadows = {
  sm: {
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  teal: {
    shadowColor: colors.primaryTeal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
};

// ============================================================================
// BUTTON STYLES
// ============================================================================

export const buttonStyles = {
  primary: {
    height: 52,
    backgroundColor: colors.primaryTeal,
    borderRadius: radii.pill,
    ...shadows.teal,
  },
  outline: {
    height: 52,
    backgroundColor: colors.neutralBg,
    borderWidth: 1.5,
    borderColor: colors.primaryTeal,
    borderRadius: radii.pill,
  },
  ghost: {
    height: 44,
    backgroundColor: colors.neutralBg,
    borderWidth: 1.5,
    borderColor: colors.primaryTeal,
    borderRadius: radii.md,
  },
};

// ============================================================================
// GLASS CARD STYLE (Shared across feed components)
// ============================================================================

export const glassCard = {
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  shadowColor: colors.shadowColor,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.15,
  shadowRadius: 8,
  elevation: 4,
};

// ============================================================================
// COMPONENT SIZES
// ============================================================================

export const componentSizes = {
  avatar: {
    sm: 32,
    md: 48,
    lg: 72,
    xl: 88,
  },
  icon: {
    sm: 16,
    md: 20,
    lg: 24,
    xl: 28,
  },
  button: {
    sm: 36,
    md: 44,
    lg: 52,
  },
};

// ============================================================================
// BOOKING FLOW SPECIFIC STYLES
// ============================================================================

export const bookingStyles = {
  // Card container - matches profile stat cards
  card: {
    backgroundColor: colors.neutralBg,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.primaryTealBorder,
    padding: spacing.lg,
    ...shadows.md,
  },
  // Selected card state
  cardSelected: {
    borderColor: colors.primaryTeal,
    backgroundColor: colors.primaryTealSoft,
    ...shadows.teal,
  },
  // Chip/tag - matches "Verified by ChoreHero" style
  chip: {
    backgroundColor: colors.neutralBg,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.primaryTeal,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipText: {
    fontSize: typography.sizes.captionSm,
    fontWeight: typography.weights.semibold,
    color: colors.primaryTeal,
  },
  // Price pill - teal background, white text
  pricePill: {
    backgroundColor: colors.primaryTeal,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  pricePillText: {
    fontSize: typography.sizes.captionSm,
    fontWeight: typography.weights.bold,
    color: colors.textInverse,
  },
  // Progress bar
  progressBar: {
    height: 6,
    backgroundColor: colors.borderSubtle,
    borderRadius: radii.pill,
    overflow: 'hidden' as const,
  },
  progressFill: {
    height: '100%' as const,
    backgroundColor: colors.primaryTeal,
    borderRadius: radii.pill,
  },
  // Quick Booking header pill - matches creator bubble
  headerPill: {
    backgroundColor: colors.neutralBg,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.primaryTealBorder,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    ...shadows.md,
  },
  // Section title - matches "Professional Cleaning • Residential"
  sectionTitle: {
    fontSize: typography.sizes.titleSm,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  // Body text - matches profile description
  bodyText: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.regular,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  // Tab switcher
  tabContainer: {
    flexDirection: 'row' as const,
    backgroundColor: colors.cardBg,
    borderRadius: radii.lg,
    padding: spacing.xs,
  },
  tabActive: {
    backgroundColor: colors.primaryTeal,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  tabInactive: {
    backgroundColor: 'transparent',
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  tabTextActive: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textInverse,
  },
  tabTextInactive: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
};

// ============================================================================
// CLEANER THEME
// ============================================================================

export const cleanerTheme = {
  colors: {
    // Primary orange accent
    primary: '#FFA52F',
    primaryDark: '#E8941A',
    primaryLight: '#FFF9F0',
    primaryBorder: '#FFD39A',
    primarySoft: 'rgba(255, 165, 47, 0.15)',
    
    // Secondary accents
    accentTeal: '#26B7C9', // Brand teal accent for cleaner UI
    success: '#10B981',
    successLight: '#D1FAE5',
    error: '#EF4444',
    errorLight: '#FEE2E2',
    errorBorder: '#FCA5A5',
    
    // Backgrounds
    bg: '#F9FAFB',
    cardBg: '#FFFFFF',
    cardGradientStart: '#FFF9F0',
    cardGradientEnd: '#FFFFFF',
    metaBg: '#F3F4F6',
    specialRequestBg: '#FEF3C7',
    
    // Text
    textPrimary: '#1F2937',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
    textInverse: '#FFFFFF',
    
    // Borders
    borderSubtle: '#E5E7EB',
    borderLight: '#F3F4F6',
    
    // Status colors
    online: '#10B981',
    offline: '#9CA3AF',
    
    // Shadows
    shadowColor: '#000000',
  },
  typography: {
    // Title sizes (24-28, semi-bold)
    title: {
      fontSize: 26,
      fontWeight: '600' as const,
      lineHeight: 32,
    },
    // Section headings (18-20, semi-bold)
    sectionHeading: {
      fontSize: 18,
      fontWeight: '600' as const,
      lineHeight: 24,
    },
    // Card titles
    cardTitle: {
      fontSize: 16,
      fontWeight: '600' as const,
      lineHeight: 22,
    },
    // Body text
    body: {
      fontSize: 14,
      fontWeight: '400' as const,
      lineHeight: 20,
    },
    // Labels/meta (12-14, medium/regular)
    label: {
      fontSize: 13,
      fontWeight: '500' as const,
      lineHeight: 16,
    },
    labelSmall: {
      fontSize: 12,
      fontWeight: '500' as const,
      lineHeight: 14,
    },
    // Metric numbers
    metricLarge: {
      fontSize: 24,
      fontWeight: '700' as const,
      lineHeight: 28,
    },
    metricMedium: {
      fontSize: 18,
      fontWeight: '600' as const,
      lineHeight: 22,
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  radii: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    card: 24,
    pill: 999,
  },
  shadows: {
    soft: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    pressed: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.03,
      shadowRadius: 4,
      elevation: 1,
    },
    orange: {
      shadowColor: '#FFA52F',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 4,
    },
  },
  // Chip/pill styles
  chip: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
};

// ============================================================================
// COMBINED THEME EXPORT
// ============================================================================

const theme = {
  colors,
  typography,
  spacing,
  radii,
  shadows,
  buttonStyles,
  componentSizes,
  bookingStyles,
  cleanerTheme,
};

export default theme;

