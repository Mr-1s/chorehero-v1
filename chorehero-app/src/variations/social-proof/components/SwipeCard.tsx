import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView } from 'react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Cleaner } from '../../shared/types';
import { theme } from '../../shared/theme';
import { useSwipeGesture } from '../../shared/hooks/useSwipeGesture';
import { VideoTestimonial } from './VideoTestimonial';
import { mockCustomerTestimonials } from '../../shared/mockData';

interface SwipeCardProps {
  cleaner: Cleaner;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onTap: () => void;
  onTestimonialPlay: (videoUrl: string) => void;
}

export const SwipeCard: React.FC<SwipeCardProps> = ({
  cleaner,
  onSwipeLeft,
  onSwipeRight,
  onTap,
  onTestimonialPlay
}) => {
  const { gestureHandler, translateX, translateY, scale, rotation } = useSwipeGesture({
    onSwipeLeft,
    onSwipeRight,
    threshold: 70
  });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
        { rotate: `${rotation.value}deg` }
      ]
    };
  });

  const cleanerTestimonials = mockCustomerTestimonials.filter(
    t => t.cleanerId === cleaner.id
  );

  return (
    <PanGestureHandler onGestureEvent={gestureHandler}>
      <Animated.View style={[styles.card, animatedStyle]}>
        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <TouchableOpacity onPress={onTap} style={styles.cardContent}>
            {/* Video Thumbnail */}
            <View style={styles.videoContainer}>
              <Image source={{ uri: cleaner.videoThumbnail }} style={styles.videoThumbnail} />
              <View style={styles.playButton}>
                <Ionicons name="play" size={24} color={theme.colors.white} />
              </View>
              
              {/* Social Proof Badge */}
              <View style={styles.socialProofBadge}>
                <Ionicons name="people" size={16} color={theme.colors.white} />
                <Text style={styles.socialProofText}>{cleaner.reviews} reviews</Text>
              </View>
            </View>

            {/* Cleaner Info */}
            <View style={styles.info}>
              <View style={styles.header}>
                <Image source={{ uri: cleaner.profileImage }} style={styles.avatar} />
                <View style={styles.nameContainer}>
                  <Text style={styles.name}>{cleaner.name}</Text>
                  <View style={styles.ratingContainer}>
                    <Ionicons name="star" size={16} color={theme.colors.warning} />
                    <Text style={styles.rating}>{cleaner.rating}</Text>
                    <Text style={styles.reviews}>({cleaner.reviews} reviews)</Text>
                  </View>
                </View>
                <Text style={styles.price}>${cleaner.price}/hr</Text>
              </View>

              {/* Social Stats */}
              <View style={styles.socialStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{cleaner.reviews}</Text>
                  <Text style={styles.statLabel}>Reviews</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{cleaner.completedJobs}</Text>
                  <Text style={styles.statLabel}>Jobs</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{cleaner.yearsExperience}</Text>
                  <Text style={styles.statLabel}>Years</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>
                    {cleaner.customerVideos?.length || 0}
                  </Text>
                  <Text style={styles.statLabel}>Video Reviews</Text>
                </View>
              </View>

              {/* Customer Video Stories */}
              {cleaner.customerVideos && cleaner.customerVideos.length > 0 && (
                <View style={styles.customerVideosSection}>
                  <Text style={styles.sectionTitle}>Customer Stories</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.customerVideos}>
                      {cleaner.customerVideos.map((videoUrl, index) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.customerVideoThumbnail}
                          onPress={() => onTestimonialPlay(videoUrl)}
                        >
                          <Image
                            source={{ uri: `https://images.unsplash.com/photo-155841866${index + 1}-fcd25c85cd64?w=100&h=100&fit=crop` }}
                            style={styles.customerVideoImage}
                          />
                          <View style={styles.customerVideoPlayButton}>
                            <Ionicons name="play" size={12} color={theme.colors.white} />
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}

              {/* Testimonials */}
              {cleanerTestimonials.length > 0 && (
                <View style={styles.testimonialsSection}>
                  <Text style={styles.sectionTitle}>What Customers Say</Text>
                  {cleanerTestimonials.map((testimonial, index) => (
                    <VideoTestimonial
                      key={index}
                      customerName={testimonial.customerName}
                      rating={testimonial.rating}
                      text={testimonial.text}
                      videoUrl={testimonial.videoUrl}
                      beforeImage={testimonial.beforeImage}
                      afterImage={testimonial.afterImage}
                      onPlay={() => onTestimonialPlay(testimonial.videoUrl)}
                    />
                  ))}
                </View>
              )}

              {/* Referral Badge */}
              <View style={styles.referralBadge}>
                <Ionicons name="gift" size={20} color={theme.colors.accent} />
                <Text style={styles.referralText}>
                  Refer a friend and get $20 off your next clean!
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </PanGestureHandler>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    marginHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.sm,
    maxHeight: 600,
    ...theme.shadows.lg
  },
  scrollContainer: {
    flex: 1,
    borderRadius: theme.borderRadius.xl
  },
  cardContent: {
    overflow: 'hidden',
    borderRadius: theme.borderRadius.xl
  },
  videoContainer: {
    position: 'relative',
    height: 200,
    backgroundColor: theme.colors.gray[100]
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ translateX: -30 }, { translateY: -30 }]
  },
  socialProofBadge: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
    gap: theme.spacing.xs
  },
  socialProofText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.white,
    fontWeight: '600'
  },
  info: {
    padding: theme.spacing.md
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: theme.spacing.md
  },
  nameContainer: {
    flex: 1
  },
  name: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.xs
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs
  },
  rating: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.gray[700]
  },
  reviews: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.gray[600]
  },
  price: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.primary
  },
  socialStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: theme.colors.gray[50],
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md
  },
  statItem: {
    alignItems: 'center'
  },
  statNumber: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.primary
  },
  statLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.gray[600],
    marginTop: theme.spacing.xs
  },
  customerVideosSection: {
    marginBottom: theme.spacing.md
  },
  sectionTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.sm
  },
  customerVideos: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs
  },
  customerVideoThumbnail: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden'
  },
  customerVideoImage: {
    width: '100%',
    height: '100%'
  },
  customerVideoPlayButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ translateX: -10 }, { translateY: -10 }]
  },
  testimonialsSection: {
    marginBottom: theme.spacing.md
  },
  referralBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.accent + '20',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm
  },
  referralText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.accent,
    fontWeight: '500',
    flex: 1
  }
});