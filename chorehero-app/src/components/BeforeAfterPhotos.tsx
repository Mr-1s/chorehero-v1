import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../utils/constants';

const { width: screenWidth } = Dimensions.get('window');
const photoWidth = (screenWidth - SPACING.xl * 3) / 2;

interface BeforeAfterPhotosProps {
  beforePhotos: string[];
  afterPhotos: string[];
  title?: string;
  showLabels?: boolean;
  onPhotoPress?: (uri: string, type: 'before' | 'after') => void;
}

export const BeforeAfterPhotos: React.FC<BeforeAfterPhotosProps> = ({
  beforePhotos,
  afterPhotos,
  title = "Cleaning Transformation",
  showLabels = true,
  onPhotoPress,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  // Ensure we have the same number of before/after photos for comparison
  const maxPhotos = Math.min(beforePhotos.length, afterPhotos.length);
  const photoPairs = Array.from({ length: maxPhotos }, (_, index) => ({
    before: beforePhotos[index],
    after: afterPhotos[index],
  }));

  if (photoPairs.length === 0) {
    return null;
  }

  const handlePhotoPress = (uri: string, type: 'before' | 'after') => {
    if (onPhotoPress) {
      onPhotoPress(uri, type);
    }
  };

  return (
    <View style={styles.container}>
      {title && (
        <Text style={styles.title}>{title}</Text>
      )}
      
      {/* Photo indicators if multiple pairs */}
      {photoPairs.length > 1 && (
        <View style={styles.indicators}>
          {photoPairs.map((_, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.indicator,
                selectedIndex === index && styles.indicatorActive
              ]}
              onPress={() => setSelectedIndex(index)}
            />
          ))}
        </View>
      )}
      
      {/* Current photo pair */}
      <View style={styles.photoPair}>
        {/* Before Photo */}
        <View style={styles.photoContainer}>
          {showLabels && (
            <View style={styles.photoLabel}>
              <Text style={styles.photoLabelText}>BEFORE</Text>
            </View>
          )}
          <TouchableOpacity
            onPress={() => handlePhotoPress(photoPairs[selectedIndex].before, 'before')}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: photoPairs[selectedIndex].before }}
              style={styles.photo}
              resizeMode="cover"
            />
          </TouchableOpacity>
        </View>
        
        {/* Arrow separator */}
        <View style={styles.separator}>
          <Ionicons name="arrow-forward" size={24} color={COLORS.primary} />
        </View>
        
        {/* After Photo */}
        <View style={styles.photoContainer}>
          {showLabels && (
            <View style={[styles.photoLabel, styles.photoLabelAfter]}>
              <Text style={styles.photoLabelText}>AFTER</Text>
            </View>
          )}
          <TouchableOpacity
            onPress={() => handlePhotoPress(photoPairs[selectedIndex].after, 'after')}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: photoPairs[selectedIndex].after }}
              style={styles.photo}
              resizeMode="cover"
            />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Navigation buttons for multiple pairs */}
      {photoPairs.length > 1 && (
        <View style={styles.navigation}>
          <TouchableOpacity
            style={[styles.navButton, selectedIndex === 0 && styles.navButtonDisabled]}
            onPress={() => setSelectedIndex(Math.max(0, selectedIndex - 1))}
            disabled={selectedIndex === 0}
          >
            <Ionicons 
              name="chevron-back" 
              size={20} 
              color={selectedIndex === 0 ? COLORS.text.disabled : COLORS.primary} 
            />
            <Text style={[styles.navButtonText, selectedIndex === 0 && styles.navButtonTextDisabled]}>
              Previous
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.navButton, selectedIndex === photoPairs.length - 1 && styles.navButtonDisabled]}
            onPress={() => setSelectedIndex(Math.min(photoPairs.length - 1, selectedIndex + 1))}
            disabled={selectedIndex === photoPairs.length - 1}
          >
            <Text style={[styles.navButtonText, selectedIndex === photoPairs.length - 1 && styles.navButtonTextDisabled]}>
              Next
            </Text>
            <Ionicons 
              name="chevron-forward" 
              size={20} 
              color={selectedIndex === photoPairs.length - 1 ? COLORS.text.disabled : COLORS.primary} 
            />
          </TouchableOpacity>
        </View>
      )}
      
      {/* Photo count */}
      {photoPairs.length > 1 && (
        <Text style={styles.photoCount}>
          {selectedIndex + 1} of {photoPairs.length}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: SPACING.lg,
  },
  title: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.semibold,
    color: COLORS.text.primary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  indicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.text.disabled,
    marginHorizontal: SPACING.xs,
  },
  indicatorActive: {
    backgroundColor: COLORS.primary,
  },
  photoPair: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
  },
  photoContainer: {
    position: 'relative',
  },
  photo: {
    width: photoWidth,
    height: photoWidth * 0.75, // 4:3 aspect ratio
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
  },
  photoLabel: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    zIndex: 1,
  },
  photoLabelAfter: {
    backgroundColor: 'rgba(0, 150, 0, 0.8)',
  },
  photoLabelText: {
    color: COLORS.text.inverse,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  separator: {
    marginHorizontal: SPACING.md,
    padding: SPACING.sm,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    elevation: 2,
    shadowColor: COLORS.text.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.md,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonText: {
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.medium,
    marginHorizontal: SPACING.xs,
  },
  navButtonTextDisabled: {
    color: COLORS.text.disabled,
  },
  photoCount: {
    textAlign: 'center',
    color: COLORS.text.secondary,
    fontSize: TYPOGRAPHY.sizes.sm,
    marginTop: SPACING.sm,
  },
}); 