/**
 * Universal Service Card Component
 * Renders service cards in multiple variants with consistent styling
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ServiceCardData, ServiceCardVariant, ServiceCardTheme } from '../types/serviceCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ServiceCardProps {
  data: ServiceCardData;
  variant?: ServiceCardVariant;
  theme?: Partial<ServiceCardTheme>;
  onPress?: (data: ServiceCardData) => void;
  onSecondaryAction?: (data: ServiceCardData) => void;
  style?: any;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({
  data,
  variant = 'compact',
  theme = {},
  onPress,
  onSecondaryAction,
  style,
}) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  // Default theme configuration
  const defaultTheme: ServiceCardTheme = {
    variant,
    primary_color: '#3ad3db',
    accent_color: '#ffffff',
    text_color: '#1C1C1E',
    background_style: 'image_overlay',
    corner_radius: 16,
    shadow_intensity: 'medium',
    animation_style: 'hover',
  };

  const cardTheme = { ...defaultTheme, ...theme };

  // Calculate card dimensions based on variant
  const getCardDimensions = () => {
    switch (variant) {
      case 'featured':
        return { width: SCREEN_WIDTH - 40, height: 280 };
      case 'compact':
        return { width: (SCREEN_WIDTH - 56) / 2, height: 220 };
      case 'list':
        return { width: SCREEN_WIDTH - 40, height: 120 };
      case 'video':
        return { width: 200, height: 280 };
      case 'minimal':
        return { width: (SCREEN_WIDTH - 56) / 2, height: 160 };
      default:
        return { width: (SCREEN_WIDTH - 56) / 2, height: 220 };
    }
  };

  const cardDimensions = getCardDimensions();

  const handlePress = async () => {
    if (cardTheme.animation_style !== 'none') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.(data);
  };

  const handleSecondaryAction = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSecondaryAction?.(data);
  };

  const renderRatingBadge = () => (
    <View style={styles.ratingBadge}>
      <Ionicons name="star" size={12} color="#FFD700" />
      <Text style={styles.ratingText}>{data.rating.average_rating}</Text>
    </View>
  );

  const renderPricingInfo = () => (
    <View style={styles.pricingContainer}>
      <Text style={styles.priceText}>{data.pricing.price_display}</Text>
      {data.service_details.estimated_duration && (
        <Text style={styles.durationText}>• {data.service_details.estimated_duration}</Text>
      )}
    </View>
  );

  const renderEngagementStats = () => {
    if (!data.engagement) return null;
    
    return (
      <View style={styles.engagementContainer}>
        <View style={styles.engagementStat}>
          <Ionicons name="eye" size={12} color="#ffffff" />
          <Text style={styles.engagementText}>{data.engagement.view_display}</Text>
        </View>
        {data.engagement.like_count > 0 && (
          <View style={styles.engagementStat}>
            <Ionicons name="heart" size={12} color="#ffffff" />
            <Text style={styles.engagementText}>{data.engagement.like_count}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderProviderInfo = () => {
    if (!data.provider) return null;
    
    return (
      <View style={styles.providerContainer}>
        {data.provider.cleaner_avatar && (
          <Image 
            source={{ uri: data.provider.cleaner_avatar }}
            style={styles.providerAvatar}
          />
        )}
        <Text style={styles.providerName} numberOfLines={1}>
          {data.provider.cleaner_name}
        </Text>
        {data.provider.is_verified && (
          <Ionicons name="checkmark-circle" size={14} color="#3ad3db" />
        )}
      </View>
    );
  };

  const renderCompactLayout = () => (
    <TouchableOpacity
      style={[
        styles.cardContainer,
        {
          width: cardDimensions.width,
          height: cardDimensions.height,
          borderRadius: cardTheme.corner_radius,
        },
        style,
      ]}
      onPress={handlePress}
      activeOpacity={0.9}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ 
            uri: imageError ? data.media.fallback_image_url || data.media.primary_image_url : data.media.primary_image_url 
          }}
          style={styles.cardImage}
          onLoadStart={() => setImageLoading(true)}
          onLoad={() => setImageLoading(false)}
          onError={() => {
            setImageError(true);
            setImageLoading(false);
          }}
        />
        
        {imageLoading && (
          <View style={styles.imageLoader}>
            <ActivityIndicator size="small" color="#3ad3db" />
          </View>
        )}
        
        <LinearGradient
          colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.7)']}
          style={styles.imageOverlay}
        />
        
        {/* Top badges */}
        <View style={styles.topBadges}>
          {renderRatingBadge()}
          {data.metadata.is_featured && (
            <View style={styles.featuredBadge}>
              <Text style={styles.featuredText}>Featured</Text>
            </View>
          )}
        </View>
        
        {/* Content overlay */}
        <View style={styles.contentOverlay}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {data.title}
          </Text>
          
          <Text style={styles.cardDescription} numberOfLines={1}>
            {data.description}
          </Text>
          
          {renderPricingInfo()}
          {renderProviderInfo()}
          {renderEngagementStats()}
        </View>
        
        {/* Action button */}
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={handlePress}
        >
          <Text style={styles.actionButtonText}>
            {data.actions.primary_action_text}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderListLayout = () => (
    <TouchableOpacity
      style={[
        styles.listContainer,
        {
          width: cardDimensions.width,
          height: cardDimensions.height,
          borderRadius: cardTheme.corner_radius,
        },
        style,
      ]}
      onPress={handlePress}
      activeOpacity={0.9}
    >
      <Image
        source={{ 
          uri: imageError ? data.media.fallback_image_url || data.media.primary_image_url : data.media.primary_image_url 
        }}
        style={styles.listImage}
        onError={() => setImageError(true)}
      />
      
      <View style={styles.listContent}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle} numberOfLines={1}>
            {data.title}
          </Text>
          {renderRatingBadge()}
        </View>
        
        <Text style={styles.listDescription} numberOfLines={2}>
          {data.description}
        </Text>
        
        <View style={styles.listFooter}>
          {renderPricingInfo()}
          <TouchableOpacity 
            style={styles.listActionButton}
            onPress={handlePress}
          >
            <Text style={styles.listActionText}>
              {data.actions.primary_action_text}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderVideoLayout = () => (
    <TouchableOpacity
      style={[
        styles.videoContainer,
        {
          width: cardDimensions.width,
          height: cardDimensions.height,
          borderRadius: cardTheme.corner_radius,
        },
        style,
      ]}
      onPress={handlePress}
      activeOpacity={0.9}
    >
      <View style={styles.videoImageContainer}>
        <Image
          source={{ 
            uri: imageError ? data.media.fallback_image_url || data.media.primary_image_url : data.media.primary_image_url 
          }}
          style={styles.videoImage}
          onError={() => setImageError(true)}
        />
        
        {/* Play button overlay */}
        <View style={styles.playButtonOverlay}>
          <Ionicons name="play-circle" size={40} color="rgba(255,255,255,0.9)" />
        </View>
        
        {renderEngagementStats()}
      </View>
      
      <View style={styles.videoContent}>
        <Text style={styles.videoTitle} numberOfLines={2}>
          {data.title}
        </Text>
        {renderProviderInfo()}
      </View>
    </TouchableOpacity>
  );

  // Render based on variant
  switch (variant) {
    case 'list':
      return renderListLayout();
    case 'video':
      return renderVideoLayout();
    case 'featured':
    case 'compact':
    case 'minimal':
    default:
      return renderCompactLayout();
  }
};

const styles = StyleSheet.create({
  // Base container styles
  cardContainer: {
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  
  // Image container and overlay
  imageContainer: {
    flex: 1,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  imageLoader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  
  // Badge styles
  topBadges: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ratingText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  featuredBadge: {
    backgroundColor: '#3ad3db',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  featuredText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  
  // Content overlay
  contentOverlay: {
    position: 'absolute',
    bottom: 50,
    left: 12,
    right: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cardDescription: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  
  // Pricing and duration
  pricingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  durationText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginLeft: 4,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  
  // Provider info
  providerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  providerAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 6,
  },
  providerName: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
    marginRight: 4,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  
  // Engagement stats
  engagementContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  engagementStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  engagementText: {
    fontSize: 10,
    color: '#ffffff',
    marginLeft: 2,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  
  // Action button
  actionButton: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: '#3ad3db',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  
  // List layout styles
  listContainer: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  listImage: {
    width: 120,
    height: '100%',
  },
  listContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    flex: 1,
  },
  listDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  listFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listActionButton: {
    backgroundColor: '#3ad3db',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  listActionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Video layout styles
  videoContainer: {
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  videoImageContainer: {
    flex: 1,
    position: 'relative',
  },
  videoImage: {
    width: '100%',
    height: '100%',
  },
  playButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  videoContent: {
    padding: 12,
    height: 80,
    justifyContent: 'space-between',
  },
  videoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    lineHeight: 18,
  },
});
