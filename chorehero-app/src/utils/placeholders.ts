/**
 * ============================================================================
 * CHOREHERO PLACEHOLDER IMAGES & AVATARS
 * Professional placeholder images for users without uploaded photos
 * ============================================================================
 */

// Default avatar configurations
export const DEFAULT_AVATARS = {
  customer: {
    male: [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face&auto=format&q=80',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face&auto=format&q=80',
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face&auto=format&q=80',
    ],
    female: [
      'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face&auto=format&q=80',
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face&auto=format&q=80',
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face&auto=format&q=80',
    ],
    neutral: [
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face&auto=format&q=80',
      'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=150&h=150&fit=crop&crop=face&auto=format&q=80',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&h=150&fit=crop&crop=face&auto=format&q=80',
    ]
  },
  cleaner: {
    male: [
      'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop&crop=face&auto=format&q=80',
      'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=150&h=150&fit=crop&crop=face&auto=format&q=80',
      'https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=150&h=150&fit=crop&crop=face&auto=format&q=80',
    ],
    female: [
      'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop&crop=face&auto=format&q=80',
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&h=150&fit=crop&crop=face&auto=format&q=80',
      'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&h=150&fit=crop&crop=face&auto=format&q=80',
    ],
    professional: [
      'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&h=150&fit=crop&crop=face&auto=format&q=80',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face&auto=format&q=80',
      'https://images.unsplash.com/photo-1556157382-97eda2d62296?w=150&h=150&fit=crop&crop=face&auto=format&q=80',
    ]
  }
};

// Fallback solid color avatars with initials
export const FALLBACK_AVATARS = {
  colors: [
    '#3ad3db', // ChoreHero primary
    '#6366F1', // Indigo
    '#8B5CF6', // Violet  
    '#EC4899', // Pink
    '#F59E0B', // Amber
    '#10B981', // Emerald
    '#06B6D4', // Cyan
    '#84CC16', // Lime
  ]
};

// Service category placeholder images
export const SERVICE_IMAGES = {
  kitchen: 'https://images.unsplash.com/photo-1556909075-f3e0c7e5c2ed?w=400&h=300&fit=crop&auto=format&q=80',
  bathroom: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=400&h=300&fit=crop&auto=format&q=80',
  living_room: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=300&fit=crop&auto=format&q=80',
  bedroom: 'https://images.unsplash.com/photo-1615529328331-f8917597711f?w=400&h=300&fit=crop&auto=format&q=80',
  deep_clean: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=300&fit=crop&auto=format&q=80',
  move_in_out: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop&auto=format&q=80',
};

/**
 * Get a smart placeholder avatar based on user info
 */
export function getSmartPlaceholder(userRole: 'customer' | 'cleaner', userId?: string, name?: string): string {
  try {
    // Use user ID to consistently assign the same placeholder
    const userIndex = userId ? parseInt(userId.slice(-1), 16) || 0 : 0;
    
    // Determine gender hint from name (very basic)
    const maleNames = ['john', 'mike', 'david', 'chris', 'alex', 'james', 'robert', 'daniel'];
    const femaleNames = ['sarah', 'emily', 'jessica', 'amanda', 'jennifer', 'lisa', 'maria', 'anna'];
    
    const firstName = name?.toLowerCase().split(' ')[0] || '';
    let category: 'male' | 'female' | 'neutral' | 'professional' = 'neutral';
    
    if (maleNames.includes(firstName)) {
      category = 'male';
    } else if (femaleNames.includes(firstName)) {
      category = 'female';
    } else if (userRole === 'cleaner') {
      category = 'professional';
    }
    
    const avatarGroup = DEFAULT_AVATARS[userRole][category] || DEFAULT_AVATARS[userRole].neutral;
    const selectedAvatar = avatarGroup[userIndex % avatarGroup.length];
    
    return selectedAvatar;
  } catch (error) {
    console.error('Error generating smart placeholder:', error);
    return getInitialsAvatar(name || 'U', userId);
  }
}

/**
 * Generate avatar with initials and background color
 */
export function getInitialsAvatar(name: string, userId?: string): string {
  const initials = getInitials(name);
  const colorIndex = userId ? parseInt(userId.slice(-1), 16) % FALLBACK_AVATARS.colors.length : 0;
  const bgColor = FALLBACK_AVATARS.colors[colorIndex].replace('#', '');
  
  // Use a service like UI Avatars or create data URL
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${bgColor}&color=fff&size=150&font-size=0.4&format=png`;
}

/**
 * Extract initials from full name
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
}

/**
 * Get placeholder for specific service category
 */
export function getServiceImage(categoryName: string): string {
  const key = categoryName.toLowerCase().replace(/[^a-z]/g, '_') as keyof typeof SERVICE_IMAGES;
  return SERVICE_IMAGES[key] || SERVICE_IMAGES.deep_clean;
}

/**
 * Main function to get user avatar with smart fallbacks
 */
export function getUserAvatar(
  avatarUrl: string | null | undefined,
  userRole: 'customer' | 'cleaner',
  userId?: string,
  name?: string
): string {
  // Return existing avatar if available
  if (avatarUrl && avatarUrl.trim() !== '') {
    return avatarUrl;
  }
  
  // Generate smart placeholder
  return getSmartPlaceholder(userRole, userId, name);
}

/**
 * Get a professional cleaning-related video thumbnail
 */
export function getCleaningVideoThumbnail(): string {
  const thumbnails = [
    'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=400&h=300&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=300&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400&h=300&fit=crop&auto=format&q=80',
  ];
  
  return thumbnails[Math.floor(Math.random() * thumbnails.length)];
}
