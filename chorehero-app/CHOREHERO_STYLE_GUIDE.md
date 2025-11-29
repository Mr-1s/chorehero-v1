# 🎨 ChoreHero Style Guide & Design System

## 📝 **Overview**
This guide defines the visual DNA, components, and styling patterns for ChoreHero - ensuring consistency across all screens and features.

---

## 🎯 **Visual DNA**

### **Core Psychology**
- **Trust + Speed + Transparency**
- **Emotional Target**: Safe, efficient, professional yet approachable  
- **User Mindset**: Anxious about strangers → Confident in choice

### **Brand Personality**
- 🏠 **Trustworthy**: Users let strangers into their homes
- ⚡ **Fast**: 60-second booking flow
- 🧹 **Clean**: Obvious cleanliness associations
- 👥 **Human**: Video-first, personal connections

---

## 🎨 **Color Palette**

### **Primary Colors**
```typescript
// Brand Colors
primary: '#3ad3db',      // ChoreHero Teal - trust & cleanliness
primaryDark: '#2ba8b0',  // Darker variant for interactions
primaryLight: '#5de0e6', // Lighter variant for backgrounds

// Supporting Colors  
secondary: '#1A2B4C',    // Navy - professionalism & trust
accent: '#FF6B6B',       // Coral - CTAs and highlights only
```

### **Semantic Colors**
```typescript
success: '#10B981',      // Green - completed actions
warning: '#F59E0B',      // Amber - caution states  
error: '#EF4444',        // Red - errors and destructive actions
info: '#3B82F6',         // Blue - informational content
```

### **Neutral Colors**
```typescript
// Backgrounds
background: '#FAFAFA',   // App background (light gray)
surface: '#FFFFFF',      // Card/component backgrounds
overlay: 'rgba(0, 0, 0, 0.5)', // Modal overlays

// Borders & Dividers
border: '#E5E7EB',       // Standard borders
borderLight: '#F3F4F6',  // Subtle dividers
borderDark: '#D1D5DB',   // Emphasized borders
```

### **Text Colors**
```typescript
text: {
  primary: '#1F2937',     // Main headings and important text
  secondary: '#6B7280',   // Body text and descriptions  
  disabled: '#9CA3AF',    // Disabled states and placeholders
  inverse: '#FFFFFF',     // Text on dark backgrounds
  muted: '#9CA3AF',       // Less important text
}
```

### **Color Usage Guidelines**
- **Primary (#3ad3db)**: Main CTAs, active states, brand elements
- **Secondary (#1A2B4C)**: Navigation, secondary CTAs, professional elements
- **Accent (#FF6B6B)**: Important CTAs only (book now, urgent actions)
- **Never use more than 3 colors per screen**
- **Maintain 4.5:1 contrast ratio for accessibility**

---

## 📱 **Typography**

### **Font Families**
```typescript
// Headers & Emphasis
headers: 'Inter', 'SF Pro Display', '-apple-system', 'BlinkMacSystemFont'

// Body & Interface
body: '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto'
```

### **Font Sizes & Weights**
```typescript
sizes: {
  xs: 12,     // Small labels, captions
  sm: 14,     // Body text, form inputs
  base: 16,   // Default body text
  lg: 18,     // Large body text
  xl: 20,     // Small headings
  '2xl': 24,  // Medium headings  
  '3xl': 32,  // Large headings
  '4xl': 36,  // Hero headings
}

weights: {
  normal: '400',    // Regular body text
  medium: '500',    // Emphasized text
  semibold: '600',  // Subheadings
  bold: '700',      // Headings
  extrabold: '800', // Hero headings
}
```

### **Typography Examples**
```typescript
// Hero Heading (Welcome screens)
{
  fontSize: 36,
  fontWeight: '800',
  color: '#FFFFFF',
  letterSpacing: 1.2,
  textShadowColor: 'rgba(0, 0, 0, 0.3)',
}

// Page Title
{
  fontSize: 24,
  fontWeight: '700', 
  color: '#1F2937',
  letterSpacing: 0.5,
}

// Body Text
{
  fontSize: 16,
  fontWeight: '400',
  color: '#6B7280',
  lineHeight: 24,
}

// Button Text
{
  fontSize: 16,
  fontWeight: '600',
  letterSpacing: 0.5,
}
```

---

## 🧩 **Component Patterns**

### **Cards**
```typescript
// Standard Card
{
  backgroundColor: '#FFFFFF',
  borderRadius: 12,
  padding: 16,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 8,
  elevation: 4,
}

// Elevated Card (interactive)
{
  backgroundColor: '#FFFFFF',
  borderRadius: 16,
  padding: 20,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.12,
  shadowRadius: 12,
  elevation: 8,
}
```

### **Buttons**

#### **Primary Button**
```typescript
{
  backgroundColor: '#3ad3db',
  borderRadius: 12,
  paddingVertical: 16,
  paddingHorizontal: 24,
  shadowColor: '#3ad3db',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
  elevation: 6,
}
```

#### **Secondary Button**
```typescript
{
  backgroundColor: 'transparent',
  borderWidth: 2,
  borderColor: '#3ad3db',
  borderRadius: 12,
  paddingVertical: 14,
  paddingHorizontal: 22,
}
```

#### **Destructive Button**
```typescript
{
  backgroundColor: '#EF4444',
  borderRadius: 12,
  paddingVertical: 16,
  paddingHorizontal: 24,
}
```

### **Form Elements**

#### **Text Input**
```typescript
{
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
  borderWidth: 2,
  borderColor: 'rgba(255, 255, 255, 0.2)',
  borderRadius: 12,
  paddingVertical: 16,
  paddingHorizontal: 16,
  fontSize: 16,
  color: '#374151',
}

// Focused State
{
  borderColor: '#3ad3db',
  shadowColor: '#3ad3db',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
}
```

#### **Checkbox**
```typescript
// Unchecked
{
  width: 22,
  height: 22,
  borderRadius: 6,
  borderWidth: 2,
  borderColor: '#9CA3AF',
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
}

// Checked
{
  backgroundColor: '#3ad3db',
  borderColor: '#3ad3db',
  shadowColor: '#3ad3db',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
}
```

---

## 📐 **Spacing & Layout**

### **Spacing Scale**
```typescript
spacing: {
  xs: 4,      // Tight spacing
  sm: 8,      // Small spacing  
  md: 12,     // Medium spacing
  base: 16,   // Default spacing
  lg: 20,     // Large spacing
  xl: 24,     // Extra large spacing
  '2xl': 32,  // Section spacing
  '3xl': 48,  // Page spacing
}
```

### **Layout Guidelines**
- **Screen Padding**: 20px horizontal
- **Card Padding**: 16-20px  
- **Element Spacing**: 16px between related elements
- **Section Spacing**: 32px between sections
- **Button Padding**: 16px vertical, 24px horizontal

### **Border Radius Scale**
```typescript
radius: {
  sm: 6,      // Small elements
  base: 8,    // Default
  md: 12,     // Cards, buttons
  lg: 16,     // Large cards
  xl: 20,     // Hero elements
  full: 9999, // Circular
}
```

---

## 🌟 **Interactive States**

### **Button States**
```typescript
// Default → Pressed → Disabled
default: { opacity: 1, transform: [{ scale: 1 }] }
pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] }
disabled: { opacity: 0.6 }

// With color changes
activeColor: '#2ba8b0'  // Darker primary for active states
```

### **Touch Feedback**
- **activeOpacity**: 0.7 for most touchable elements
- **Scale Animation**: 0.98 for button presses  
- **Haptic Feedback**: Light impact for interactions

---

## 🎭 **Animation Guidelines**

### **Timing Functions**
```typescript
// Ease curves
easeOut: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
easeIn: 'cubic-bezier(0.55, 0.055, 0.675, 0.19)'
easeInOut: 'cubic-bezier(0.645, 0.045, 0.355, 1)'

// Durations
fast: 200,      // Quick interactions
normal: 300,    // Standard animations  
slow: 500,      // Page transitions
```

### **Common Animations**
- **Fade In**: opacity 0 → 1 (300ms)
- **Slide Up**: translateY 20 → 0 (300ms)
- **Scale In**: scale 0.9 → 1 (200ms)
- **Spring**: Use for interactive elements

---

## 🎨 **Screen-Specific Patterns**

### **Splash Screen**
- **Background**: Dark gradient with brand accent
- **Logo**: Centered with glow effect
- **Animation**: Spring scale + fade sequence
- **Duration**: 2-3 seconds total

### **Authentication Screens**
- **Background**: Gradient from primary to secondary  
- **Cards**: White with high elevation
- **Inputs**: Semi-transparent with focus states
- **CTAs**: Full-width primary buttons

### **Onboarding Screens**
- **Progress**: Teal progress bar
- **Steps**: Card-based with clear hierarchy
- **Navigation**: Back + Continue buttons
- **Avatars**: Professional placeholders (no Lego!)

### **Main App Screens**
- **Navigation**: Bottom tabs with icons
- **Cards**: Service/cleaner cards with consistent layout
- **CTAs**: Prominent booking buttons
- **Trust Elements**: Verification badges, ratings

---

## 🔧 **Implementation**

### **Constants File Usage**
Import colors and spacing from:
```typescript
import { COLORS, TYPOGRAPHY, SPACING } from '../utils/constants';

// Usage
color: COLORS.primary
fontSize: TYPOGRAPHY.sizes.lg
margin: SPACING.base
```

### **Reusable Styles**
Create style objects for common patterns:
```typescript
// Card styles
const cardStyles = {
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.base,
    ...shadowStyle,
  }
}

// Button styles  
const buttonStyles = {
  primary: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: SPACING.base,
    ...primaryShadow,
  }
}
```

---

## ✅ **Quality Checklist**

Before shipping any screen, ensure:

### **Visual Consistency**
- [ ] Uses brand colors from style guide
- [ ] Typography follows size/weight guidelines  
- [ ] Spacing follows 4px grid system
- [ ] Interactive elements have proper states

### **Accessibility**
- [ ] 4.5:1 contrast ratio for text
- [ ] Touch targets minimum 44px
- [ ] Proper semantic labels
- [ ] Screen reader friendly

### **Brand Compliance**
- [ ] No unauthorized color usage
- [ ] Consistent component patterns
- [ ] Professional placeholder content
- [ ] Trust-focused messaging

### **Performance**
- [ ] Optimized images and assets
- [ ] Smooth 60fps animations
- [ ] Fast interaction feedback
- [ ] Proper loading states

---

## 🎯 **Key Principles**

1. **Trust First**: Every design decision should build user confidence
2. **Speed Matters**: Minimize cognitive load and interaction steps  
3. **Video Forward**: Leverage video content for human connection
4. **Mobile Native**: Design for thumbs and one-handed use
5. **Accessible**: Everyone should be able to use ChoreHero

---

**This style guide is a living document. Update it as the design system evolves!** 🚀
