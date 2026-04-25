/**
 * Customer-side cache.
 *
 * Mirrors `cleanerStore` (Zustand) so the customer surfaces stop refetching
 * the same data on every screen mount. This is the lightweight alternative to
 * pulling in @tanstack/react-query — same caching benefits, same focus-based
 * refresh patterns we already rely on, no architectural shift.
 *
 * Today this caches:
 *   - jobs   (customer's posted video-quote jobs)
 *   - quotes (quotes received against the customer's jobs)
 *
 * Future slices (bookings, paymentMethods, addresses) can follow the same
 * pattern — see the BookingScreen TODO at the end of this file.
 */

import { create } from 'zustand';
import { jobQuoteService, type Job, type Quote } from '../services/jobQuoteService';
import { useCleanerStore } from './cleanerStore';

interface CustomerState {
  // Data
  jobs: Job[];
  jobsArchived: Job[];
  quotesByJob: Record<string, Quote[]>;

  // Loading flags (per resource so screens can show targeted spinners)
  isLoadingJobs: boolean;
  isLoadingQuotes: boolean;

  // Last fetch timestamps so callers can implement stale-while-revalidate.
  lastJobsFetchAt: number | null;

  // Actions
  fetchJobs: (userId: string) => Promise<void>;
  fetchArchivedJobs: (userId: string) => Promise<void>;
  fetchQuotesForJob: (jobId: string) => Promise<void>;
  removeJob: (jobId: string) => void;
  resetStore: () => void;
}

const initialState: Pick<
  CustomerState,
  'jobs' | 'jobsArchived' | 'quotesByJob' | 'isLoadingJobs' | 'isLoadingQuotes' | 'lastJobsFetchAt'
> = {
  jobs: [],
  jobsArchived: [],
  quotesByJob: {},
  isLoadingJobs: false,
  isLoadingQuotes: false,
  lastJobsFetchAt: null,
};

export const useCustomerStore = create<CustomerState>((set, get) => ({
  ...initialState,

  fetchJobs: async (userId: string) => {
    if (!userId) return;
    set({ isLoadingJobs: true });
    try {
      const res = await jobQuoteService.getCustomerJobs(userId);
      if (res.success && res.data) {
        set({ jobs: res.data, lastJobsFetchAt: Date.now() });
      }
    } catch (e) {
      console.warn('customerStore.fetchJobs failed:', e);
    } finally {
      set({ isLoadingJobs: false });
    }
  },

  fetchArchivedJobs: async (userId: string) => {
    if (!userId) return;
    set({ isLoadingJobs: true });
    try {
      const res = await jobQuoteService.getCustomerJobsArchived(userId);
      if (res.success && res.data) {
        set({ jobsArchived: res.data });
      }
    } catch (e) {
      console.warn('customerStore.fetchArchivedJobs failed:', e);
    } finally {
      set({ isLoadingJobs: false });
    }
  },

  fetchQuotesForJob: async (jobId: string) => {
    if (!jobId) return;
    set({ isLoadingQuotes: true });
    try {
      const res = await jobQuoteService.getJobWithQuotes(jobId);
      if (res.success && res.data) {
        const next = { ...get().quotesByJob, [jobId]: res.data.quotes ?? [] };
        set({ quotesByJob: next });
      }
    } catch (e) {
      console.warn('customerStore.fetchQuotesForJob failed:', e);
    } finally {
      set({ isLoadingQuotes: false });
    }
  },

  removeJob: (jobId: string) => {
    set({
      jobs: get().jobs.filter((j) => j.id !== jobId),
      jobsArchived: get().jobsArchived.filter((j) => j.id !== jobId),
    });
  },

  resetStore: () => {
    set({ ...initialState });
  },
}));

/**
 * Reset the customer cache when the user signs out. Wired up here so we don't
 * have to remember to call it from every signOut path. Pair with cleanerStore
 * which already has its own resetStore.
 */
export function resetCustomerStoreOnSignOut(): void {
  try {
    useCustomerStore.getState().resetStore();
  } catch {
    // no-op
  }
  try {
    useCleanerStore.getState().resetStore();
  } catch {
    // no-op
  }
}

// TODO(phase-3): Add a `bookings` slice and migrate the inline supabase
// query in BookingScreen.loadBookings into a normalized service method
// (e.g. bookingService.getCustomerBookings) once we have time to rework the
// `Booking` UI shape transform.
