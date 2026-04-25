/**
 * useFeedPopulation - Robust feed population with demo fallback chain.
 * Ensures users ALWAYS see content (never "No videos available").
 */

import { useCallback, useState } from 'react';
import { videoFeedAlgorithmService } from '../services/videoFeedAlgorithmService';
import { guestModeService } from '../services/guestModeService';
import { contentService } from '../services/contentService';
import { FEATURE_DEMO_FALLBACK } from '../config';

export interface FeedBanner {
  show: boolean;
  type: 'waitlist';
  title: string;
  subtitle: string;
  cta: string;
  action: () => void;
  userCity?: string;
  nearestCity?: string;
}

export interface PopulateFeedResult {
  videos: PopulateFeedVideo[];
  banner: FeedBanner | null;
}

export interface PopulateFeedVideo {
  id: string;
  cleaner_id: string;
  title: string;
  description: string;
  media_url: string;
  thumbnail_url?: string;
  base_price_cents?: number | null;
  package_type?: 'fixed' | 'hourly' | 'contact' | null;
  estimated_hours?: number | null;
  is_bookable?: boolean;
  cleaner_name: string;
  cleaner_avatar: string;
  rating_average: number;
  hourly_rate: number;
  total_jobs?: number;
  distance_km?: number | null;
  isDemo: boolean;
}

const LAUNCH_CITIES = ['NYC', 'Atlanta', 'Austin'] as const;
const PRIMARY_LAUNCH_CITY = 'NYC';

/** Approximate coords for launch cities (for distance calc) */
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  NYC: { lat: 40.7128, lng: -74.006 },
  Atlanta: { lat: 33.749, lng: -84.388 },
  Austin: { lat: 30.2672, lng: -97.7431 },
};

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function findNearestLaunchCity(userLocation: {
  latitude: number;
  longitude: number;
}): string {
  const sorted = LAUNCH_CITIES.map((city) => {
    const coords = CITY_COORDS[city];
    const distance = coords
      ? haversineKm(
          userLocation.latitude,
          userLocation.longitude,
          coords.lat,
          coords.lng
        )
      : Infinity;
    return { city, distance };
  }).sort((a, b) => a.distance - b.distance);
  return sorted[0]?.city ?? PRIMARY_LAUNCH_CITY;
}

export function useFeedPopulation(
  userId: string | undefined,
  userLocation: { latitude: number; longitude: number } | undefined,
  userCity?: string | null,
  onAddToWaitlist?: (zip?: string, city?: string, state?: string) => void
) {
  const [isLoading, setIsLoading] = useState(false);

  const populateFeed = useCallback(
    async (
      append = false,
      override?: {
        userLocation?: { latitude: number; longitude: number };
        userCity?: string | null;
      }
    ): Promise<PopulateFeedResult> => {
      setIsLoading(true);
      const loc = override?.userLocation ?? userLocation;
      const city = override?.userCity ?? userCity;
      try {
        // STEP 1: Try real pros in user's area (50km radius, then 500km if empty)
        let localPros: PopulateFeedVideo[] = [];
        if (loc?.latitude != null && loc?.longitude != null) {
          let ranked = await videoFeedAlgorithmService.getRankedFeed(
            userId ?? '',
            loc,
            { limit: 20, sort_preference: 'balanced' }
          );
          // Expand radius to 500km if no results (cold start)
          if (ranked.length === 0) {
            ranked = await videoFeedAlgorithmService.getRankedFeed(
              userId ?? '',
              loc,
              { limit: 20, sort_preference: 'balanced', radius_km: 500 }
            );
          }
          localPros = ranked.map((v) => ({
            id: v.id,
            cleaner_id: v.cleaner_id,
            title: v.title,
            description: v.description,
            media_url: v.media_url,
            thumbnail_url: v.thumbnail_url,
            base_price_cents: v.base_price_cents ?? null,
            package_type: v.package_type ?? null,
            estimated_hours: v.estimated_hours ?? null,
            is_bookable: v.is_bookable ?? false,
            cleaner_name: v.cleaner.name,
            cleaner_avatar: v.cleaner.avatar_url,
            rating_average: v.cleaner.rating_average ?? 0,
            hourly_rate: v.cleaner.hourly_rate ?? 0,
            total_jobs: v.cleaner.total_jobs ?? 0,
            distance_km: v.cleaner.distance_km ?? null,
            isDemo: false,
          }));
        } else if (userId) {
          // No location: try contentService.getFeed as fallback
          const response = await contentService.getFeed(
            { limit: 20, filters: { content_type: 'video' } },
            userId
          );
          if (response.success && response.data?.posts?.length) {
            localPros = (response.data.posts as any[]).map((p) => {
              const u = p.user;
              const cp = u?.cleaner_profiles;
              return {
                id: p.id,
                cleaner_id: p.user_id,
                title: p.title || '',
                description: p.description || '',
                media_url: p.media_url,
                thumbnail_url: p.thumbnail_url,
                base_price_cents: p.base_price_cents ?? null,
                package_type: p.package_type ?? null,
                estimated_hours: p.estimated_hours ?? null,
                is_bookable: p.is_bookable ?? false,
                cleaner_name: u?.name || 'Provider',
                cleaner_avatar: u?.avatar_url || '',
                rating_average: cp?.rating_average ?? 0,
                hourly_rate: cp?.hourly_rate ?? 0,
                total_jobs: cp?.total_jobs ?? 0,
                distance_km: null,
                isDemo: false,
              };
            });
          }
        }

        // STEP 2: If < 5 local pros, add demo content from nearest launch city
        // Gated behind FEATURE_DEMO_FALLBACK so production shows real empty/waitlist state.
        if (localPros.length < 5 && FEATURE_DEMO_FALLBACK) {
          const nearestCity = loc
            ? findNearestLaunchCity(loc)
            : PRIMARY_LAUNCH_CITY;
          const demoVideos = guestModeService.fetchDemoVideos({
            city: nearestCity,
            mixWithReal: localPros.length > 0,
            labelAs: 'sample',
            limit: 15,
          });
          const demoMapped: PopulateFeedVideo[] = demoVideos.map((v) => ({
            id: v.id,
            cleaner_id: v.cleaner_id ?? v.id,
            title: v.title,
            description: v.description,
            media_url: v.video_url,
            thumbnail_url: v.thumbnail_url,
            base_price_cents: v.base_price_cents ?? null,
            package_type: v.package_type ?? null,
            estimated_hours: v.estimated_hours ?? null,
            is_bookable: v.is_bookable ?? false,
            cleaner_name: v.cleaner_name,
            cleaner_avatar: v.cleaner_avatar,
            rating_average: 4.5,
            hourly_rate: v.base_price_cents ? v.base_price_cents / 100 : 55,
            total_jobs: 0,
            distance_km: null,
            isDemo: true,
          }));
          const combined = [...localPros, ...demoMapped];
          const banner: FeedBanner = {
            show: true,
            type: 'waitlist',
            title:
              localPros.length === 0
                ? `We aren't in ${city || 'your area'} yet`
                : `Chore Hero is coming to ${city || 'your city'}!`,
            subtitle: `Browse ${nearestCity} heroes while you wait`,
            cta: localPros.length === 0 ? 'Get early access' : 'Notify me when we launch',
            action: () => onAddToWaitlist?.(),
            userCity: city ?? undefined,
            nearestCity,
          };
          return { videos: combined, banner };
        }

        // STEP 3: Healthy market, real content only
        return {
          videos: localPros,
          banner: null,
        };
      } catch (err) {
        console.warn('populateFeed error:', err);
        if (!FEATURE_DEMO_FALLBACK) {
          return { videos: [], banner: null };
        }
        const demoVideos = guestModeService.fetchDemoVideos({
          city: PRIMARY_LAUNCH_CITY,
          labelAs: 'sample',
          limit: 20,
        });
        const videos: PopulateFeedVideo[] = demoVideos.map((v) => ({
          id: v.id,
          cleaner_id: v.cleaner_id ?? v.id,
          title: v.title,
          description: v.description,
          media_url: v.video_url,
          thumbnail_url: v.thumbnail_url,
          base_price_cents: v.base_price_cents ?? null,
          package_type: v.package_type ?? null,
          estimated_hours: v.estimated_hours ?? null,
          is_bookable: v.is_bookable ?? false,
          cleaner_name: v.cleaner_name,
          cleaner_avatar: v.cleaner_avatar,
          rating_average: 4.5,
          hourly_rate: v.base_price_cents ? v.base_price_cents / 100 : 55,
          total_jobs: 0,
          distance_km: null,
          isDemo: true,
        }));
        return {
          videos,
          banner: {
            show: true,
            type: 'waitlist',
            title: `We aren't in ${city || 'your area'} yet`,
            subtitle: `Browse ${PRIMARY_LAUNCH_CITY} heroes while you wait`,
            cta: 'Get early access',
            action: () => onAddToWaitlist?.(),
            userCity: city ?? undefined,
            nearestCity: PRIMARY_LAUNCH_CITY,
          },
        };
      } finally {
        setIsLoading(false);
      }
    },
    [userId, userLocation, userCity, onAddToWaitlist]
  );

  return { populateFeed, isLoading };
}
