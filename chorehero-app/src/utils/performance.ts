import { Dimensions } from 'react-native';
import React from 'react';

const { height: screenHeight } = Dimensions.get('window');

// Performance configuration
export const PERFORMANCE_CONFIG = {
  // List optimization
  INITIAL_NUM_TO_RENDER: 10,
  MAX_TO_RENDER_PER_BATCH: 5,
  UPDATE_CELLS_BATCH_PERIOD: 50,
  WINDOW_SIZE: 10,
  
  // Memory management
  MAX_CACHED_ITEMS: 100,
  CLEANUP_THRESHOLD: 0.8, // Clean up when memory usage hits 80%
  
  // Image optimization
  IMAGE_CACHE_SIZE: 50,
  THUMBNAIL_SIZE: { width: 150, height: 150 },
  
  // Video optimization
  MAX_CONCURRENT_VIDEOS: 2,
  VIDEO_PRELOAD_DISTANCE: 2, // Number of items ahead to preload
};

// Memory monitoring
class MemoryManager {
  private cache = new Map<string, any>();
  private accessTimes = new Map<string, number>();
  private maxSize: number;

  constructor(maxSize = PERFORMANCE_CONFIG.MAX_CACHED_ITEMS) {
    this.maxSize = maxSize;
  }

  set(key: string, value: any): void {
    // Remove oldest items if at capacity
    if (this.cache.size >= this.maxSize) {
      this.cleanup();
    }

    this.cache.set(key, value);
    this.accessTimes.set(key, Date.now());
  }

  get(key: string): any {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.accessTimes.set(key, Date.now());
    }
    return value;
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): void {
    this.cache.delete(key);
    this.accessTimes.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.accessTimes.clear();
  }

  private cleanup(): void {
    const sortedByAccess = Array.from(this.accessTimes.entries())
      .sort(([, a], [, b]) => a - b);

    // Remove 20% of least recently used items
    const itemsToRemove = Math.floor(this.cache.size * 0.2);
    
    for (let i = 0; i < itemsToRemove; i++) {
      const [key] = sortedByAccess[i];
      this.delete(key);
    }
  }

  getStats(): { size: number; maxSize: number; hitRate: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.cache.size / this.maxSize
    };
  }
}

// Global memory manager instance
export const memoryManager = new MemoryManager();

// List optimization utilities
export const getOptimalListProps = (itemHeight?: number) => {
  const estimatedItemHeight = itemHeight || 100;
  
  return {
    initialNumToRender: PERFORMANCE_CONFIG.INITIAL_NUM_TO_RENDER,
    maxToRenderPerBatch: PERFORMANCE_CONFIG.MAX_TO_RENDER_PER_BATCH,
    updateCellsBatchingPeriod: PERFORMANCE_CONFIG.UPDATE_CELLS_BATCH_PERIOD,
    windowSize: PERFORMANCE_CONFIG.WINDOW_SIZE,
    removeClippedSubviews: true,
    getItemLayout: itemHeight ? (data: any, index: number) => ({
      length: estimatedItemHeight,
      offset: estimatedItemHeight * index,
      index,
    }) : undefined,
  };
};

// Image optimization
export const optimizeImageUri = (uri: string, width?: number, height?: number): string => {
  if (!uri) return '';
  
  // For network images, add optimization parameters
  if (uri.startsWith('http')) {
    const url = new URL(uri);
    if (width) url.searchParams.set('w', width.toString());
    if (height) url.searchParams.set('h', height.toString());
    url.searchParams.set('q', '80'); // Quality
    url.searchParams.set('f', 'webp'); // Format
    return url.toString();
  }
  
  return uri;
};

// Video optimization
class VideoManager {
  private activeVideos = new Set<string>();
  private preloadedVideos = new Set<string>();
  
  canPlayVideo(videoId: string): boolean {
    return this.activeVideos.size < PERFORMANCE_CONFIG.MAX_CONCURRENT_VIDEOS;
  }
  
  registerActiveVideo(videoId: string): void {
    this.activeVideos.add(videoId);
  }
  
  unregisterActiveVideo(videoId: string): void {
    this.activeVideos.delete(videoId);
  }
  
  shouldPreload(videoId: string, currentIndex: number, videoIndex: number): boolean {
    const distance = Math.abs(videoIndex - currentIndex);
    return distance <= PERFORMANCE_CONFIG.VIDEO_PRELOAD_DISTANCE && 
           !this.preloadedVideos.has(videoId);
  }
  
  markPreloaded(videoId: string): void {
    this.preloadedVideos.add(videoId);
  }
  
  clearPreloaded(): void {
    this.preloadedVideos.clear();
  }
  
  getStats(): { active: number; preloaded: number } {
    return {
      active: this.activeVideos.size,
      preloaded: this.preloadedVideos.size
    };
  }
}

export const videoManager = new VideoManager();

// Debounce utility for performance
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false
): T {
  let timeout: NodeJS.Timeout | null = null;
  
  return ((...args: Parameters<T>) => {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    
    const callNow = immediate && !timeout;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func(...args);
  }) as T;
}

// Throttle utility for scroll events
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): T {
  let inThrottle: boolean;
  
  return ((...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }) as T;
}

// Intersection observer for virtualization
export class ViewportTracker {
  private visibleItems = new Set<string>();
  private callbacks = new Map<string, () => void>();
  
  trackItem(itemId: string, isVisible: boolean, callback?: () => void): void {
    if (isVisible) {
      this.visibleItems.add(itemId);
      if (callback) {
        this.callbacks.set(itemId, callback);
        callback();
      }
    } else {
      this.visibleItems.delete(itemId);
      this.callbacks.delete(itemId);
    }
  }
  
  isVisible(itemId: string): boolean {
    return this.visibleItems.has(itemId);
  }
  
  getVisibleItems(): string[] {
    return Array.from(this.visibleItems);
  }
  
  cleanup(): void {
    this.visibleItems.clear();
    this.callbacks.clear();
  }
}

export const viewportTracker = new ViewportTracker();

// Performance monitoring
export class PerformanceMonitor {
  private metrics = new Map<string, number[]>();
  
  startTiming(label: string): () => void {
    const start = performance.now();
    
    return () => {
      const duration = performance.now() - start;
      if (!this.metrics.has(label)) {
        this.metrics.set(label, []);
      }
      this.metrics.get(label)!.push(duration);
      
      // Keep only last 100 measurements
      if (this.metrics.get(label)!.length > 100) {
        this.metrics.get(label)!.shift();
      }
    };
  }
  
  getAverageTime(label: string): number {
    const times = this.metrics.get(label);
    if (!times || times.length === 0) return 0;
    
    return times.reduce((sum, time) => sum + time, 0) / times.length;
  }
  
  getMetrics(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const result: Record<string, any> = {};
    
    for (const [label, times] of this.metrics) {
      if (times.length > 0) {
        result[label] = {
          avg: this.getAverageTime(label),
          min: Math.min(...times),
          max: Math.max(...times),
          count: times.length
        };
      }
    }
    
    return result;
  }
  
  clear(): void {
    this.metrics.clear();
  }
}

export const performanceMonitor = new PerformanceMonitor();

// React Native specific optimizations
export const optimizeListRendering = {
  // Use these props for FlatList/SectionList
  getItemLayout: (itemHeight: number) => (data: any, index: number) => ({
    length: itemHeight,
    offset: itemHeight * index,
    index,
  }),
  
  // Key extractor that avoids re-renders
  keyExtractor: (item: any, index: number) => {
    return item.id || item.key || `item-${index}`;
  },
  
  // Optimized renderItem wrapper
  createRenderItem: <T,>(component: React.ComponentType<{ item: T; index: number }>) => {
    return React.memo(({ item, index }: { item: T; index: number }) => {
      return React.createElement(component, { item, index });
    });
  },
};

// Memory usage tracker
export const trackMemoryUsage = () => {
  if (__DEV__) {
    const used = (performance as any).memory?.usedJSHeapSize;
    const total = (performance as any).memory?.totalJSHeapSize;
    
    if (used && total) {
      const percentage = (used / total) * 100;
      console.log(`Memory usage: ${Math.round(percentage)}% (${Math.round(used / 1024 / 1024)}MB)`);
      
      if (percentage > 80) {
        console.warn('High memory usage detected!');
        return { warning: true, percentage, used, total };
      }
    }
  }
  
  return { warning: false };
};