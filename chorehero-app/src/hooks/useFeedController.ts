import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type FeedState = 'PRE_FETCH' | 'ACTIVE' | 'INTERACTED' | 'DISPOSE';

export interface ProviderUI {
  name: string;
  username?: string;
  avatar_url?: string | null;
  rating_average?: number;
  hourly_rate?: number;
  verification_status?: 'verified' | 'pending' | 'rejected';
  service_title?: string;
  description?: string;
  estimated_duration?: string;
}

export interface FeedItem {
  post_id?: string;
  provider_id: string;
  video_source: string;
  provider_metadata: {
    name: string;
    rating: number;
    base_price: number;
  };
  interaction_state: {
    is_liked: boolean;
    is_viewed: boolean;
  };
}

interface UseFeedControllerOptions {
  sourceKey: string;
  interactionStorageKey?: string | null;
  onEmitAction?: (payload: { providerId: string; actionType: string }) => void;
  fetchMore?: (cursor: string) => Promise<void>;
}

export const useFeedController = ({ sourceKey, interactionStorageKey, onEmitAction, fetchMore }: UseFeedControllerOptions) => {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [providerUiMap, setProviderUiMap] = useState<Record<string, ProviderUI>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [initialIndex, setInitialIndex] = useState(0);
  const [feedState, setFeedState] = useState<FeedState>('PRE_FETCH');
  const [isPlaying, setIsPlaying] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [savedProviders, setSavedProviders] = useState<Set<string>>(new Set());
  const [followedProviders, setFollowedProviders] = useState<Set<string>>(new Set());
  const [likedProviders, setLikedProviders] = useState<Set<string>>(new Set());
  const restoredIndexRef = useRef(false);

  useEffect(() => {
    const restoreIndex = async () => {
      try {
        const stored = await AsyncStorage.getItem(`feed_index_${sourceKey}`);
        const parsed = stored ? Number(stored) : 0;
        if (!Number.isNaN(parsed) && parsed >= 0) {
          setInitialIndex(parsed);
        }
      } catch {
        // ignore
      }
    };
    restoreIndex();
  }, [sourceKey]);

  useEffect(() => {
    AsyncStorage.setItem(`feed_index_${sourceKey}`, String(currentIndex)).catch(() => {});
  }, [currentIndex, sourceKey]);

  useEffect(() => {
    const restoreInteractions = async () => {
      if (!interactionStorageKey) return;
      try {
        const raw = await AsyncStorage.getItem(`feed_interactions_${interactionStorageKey}`);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.saved)) setSavedProviders(new Set(parsed.saved));
        if (Array.isArray(parsed.followed)) setFollowedProviders(new Set(parsed.followed));
        if (Array.isArray(parsed.liked)) setLikedProviders(new Set(parsed.liked));
      } catch {
        // ignore
      }
    };
    restoreInteractions();
  }, [interactionStorageKey]);

  useEffect(() => {
    if (!interactionStorageKey) return;
    const payload = {
      saved: Array.from(savedProviders),
      followed: Array.from(followedProviders),
      liked: Array.from(likedProviders),
    };
    AsyncStorage.setItem(`feed_interactions_${interactionStorageKey}`, JSON.stringify(payload)).catch(() => {});
  }, [interactionStorageKey, savedProviders, followedProviders, likedProviders]);

  useEffect(() => {
    if (likedProviders.size === 0) return;
    setFeedItems(prev =>
      prev.map(item =>
        likedProviders.has(item.provider_id)
          ? { ...item, interaction_state: { ...item.interaction_state, is_liked: true } }
          : item
      )
    );
  }, [likedProviders]);

  const markPreFetch = () => setFeedState('PRE_FETCH');
  const markActive = () => setFeedState('ACTIVE');

  const setFeedData = (
    items: FeedItem[],
    uiMap: Record<string, ProviderUI>,
    options?: { append?: boolean; nextCursor?: string; hasMore?: boolean }
  ) => {
    const hydrated = items.map(item =>
      likedProviders.has(item.provider_id)
        ? { ...item, interaction_state: { ...item.interaction_state, is_liked: true } }
        : item
    );
    if (options?.append) {
      setFeedItems(prev => {
        const existingIds = new Set(prev.map(item => item.post_id || item.video_source));
        const deduped = hydrated.filter(item => !existingIds.has(item.post_id || item.video_source));
        return [...prev, ...deduped];
      });
    } else {
      setFeedItems(hydrated);
    }
    setProviderUiMap(prev => ({ ...prev, ...uiMap }));
    if (options?.nextCursor !== undefined) {
      setNextCursor(options.nextCursor);
    }
    if (options?.hasMore !== undefined) {
      setHasMore(options.hasMore);
    }
    markActive();
  };

  const updateInteractionState = (providerId: string, updates: Partial<FeedItem['interaction_state']>) => {
    if (typeof updates.is_liked === 'boolean') {
      setLikedProviders(prev => {
        const next = new Set(prev);
        if (updates.is_liked) next.add(providerId);
        else next.delete(providerId);
        return next;
      });
    }
    setFeedItems(prev =>
      prev.map(item =>
        item.provider_id === providerId
          ? { ...item, interaction_state: { ...item.interaction_state, ...updates } }
          : item
      )
    );
  };

  const emitAction = (providerId: string, actionType: string) => {
    onEmitAction?.({ providerId, actionType });
  };

  const enterInteractedState = (providerId: string, actionType: string) => {
    setFeedState('INTERACTED');
    setIsPlaying(false);
    emitAction(providerId, actionType);
    requestAnimationFrame(() => setFeedState('ACTIVE'));
  };

  const requestFetchMore = async () => {
    if (isFetchingMore || !hasMore || !nextCursor || !fetchMore) return;
    setIsFetchingMore(true);
    await fetchMore(nextCursor);
    setIsFetchingMore(false);
  };

  const maybeFetchMore = (index: number) => {
    if (isFetchingMore || !hasMore || !nextCursor) return;
    if (feedItems.length - index <= 3) {
      requestFetchMore();
    }
  };

  const onViewableIndexChange = (newIndex: number) => {
    if (newIndex === currentIndex) return;
    setFeedState('DISPOSE');
    setCurrentIndex(newIndex);
    const providerId = feedItems[newIndex]?.provider_id;
    if (providerId) {
      updateInteractionState(providerId, { is_viewed: true });
    }
    maybeFetchMore(newIndex);
    requestAnimationFrame(() => setFeedState('ACTIVE'));
  };

  const resetInitialIndex = (index: number) => {
    setInitialIndex(index);
    restoredIndexRef.current = false;
  };

  return {
    feedItems,
    providerUiMap,
    currentIndex,
    initialIndex,
    feedState,
    isPlaying,
    setIsPlaying,
    savedProviders,
    setSavedProviders,
    followedProviders,
    setFollowedProviders,
    likedProviders,
    setFeedData,
    setFeedItems,
    setProviderUiMap,
    setHasMore,
    setNextCursor,
    markPreFetch,
    markActive,
    enterInteractedState,
    updateInteractionState,
    onViewableIndexChange,
    resetInitialIndex,
    restoredIndexRef,
  };
};
