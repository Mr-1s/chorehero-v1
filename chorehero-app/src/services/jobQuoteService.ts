/**
 * Video Quote System: Jobs and Quotes service.
 * Customer posts jobs; pros respond with video quotes.
 */
import { supabase } from './supabase';

/** Extract error message from Edge Function non-2xx response. */
async function parseEdgeFunctionError(err: unknown): Promise<string> {
  type EdgeContext = {
    json?: () => Promise<unknown>;
    text?: () => Promise<string>;
  };
  const e = err as { context?: EdgeContext; message?: string };
  const ctx: EdgeContext | undefined = e?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = (await ctx.json()) as { error?: string };
      if (body?.error) return body.error;
    } catch {
      try {
        if (typeof ctx.text === 'function') {
          const text = await ctx.text();
          if (text) return text;
        }
      } catch {
        /* ignore */
      }
    }
  }
  const msg = e?.message ?? 'Edge Function error';
  if (msg.includes('non-2xx')) {
    return 'Sign in and try again. Payment requires an active session.';
  }
  return msg;
}

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
import { ApiResponse } from '../types/api';

export type JobCategory =
  | 'cleaning'
  | 'mounting'
  | 'repairs'
  | 'yard_work'
  | 'moving_help'
  | 'organizing'
  | 'handyman'
  | 'delivery'
  | 'pet_care'
  | 'tech_support'
  | 'laundry'
  | 'junk_removal'
  | 'other';

export type JobUrgency =
  | 'today'
  | 'tomorrow'
  | 'this_week'
  | 'flexible'
  | 'next_week'
  | 'this_weekend'
  | 'next_month'
  | 'morning'
  | 'afternoon'
  | 'evening';

export interface JobMedia {
  id: string;
  job_id: string;
  media_url: string;
  media_type: 'photo' | 'video';
  sort_order: number;
}

export interface Job {
  id: string;
  customer_id: string;
  headline: string;
  description: string | null;
  category: JobCategory;
  urgency: JobUrgency;
  status: string;
  budget_min_cents: number | null;
  budget_max_cents: number | null;
  address_id?: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  latitude: number | null;
  longitude: number | null;
  expires_at: string;
  created_at: string;
  /** Joined */
  customer?: { name: string; avatar_url: string | null };
  media?: JobMedia[];
  quote_count?: number;
  /** Computed client-side */
  distance_miles?: number;
  /** Optional app-defined payload (if present on `jobs` or merged from client). */
  metadata?: Record<string, unknown> | null;
}

export interface Quote {
  id: string;
  job_id: string;
  pro_id: string;
  video_url: string;
  price_cents: number;
  availability_text: string | null;
  status: string;
  expires_at: string;
  created_at: string;
  customer_viewed_at?: string | null;
  /** Joined */
  pro?: { name: string; avatar_url: string | null; cleaner_profiles?: { rating_average: number }[] };
  job?: Job;
}

export interface CreateJobInput {
  headline: string;
  description?: string;
  category: JobCategory;
  urgency: JobUrgency;
  budget_min_cents?: number;
  budget_max_cents?: number;
  address_id?: string;
  street?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  latitude?: number;
  longitude?: number;
  media_urls: { url: string; type: 'photo' | 'video' }[];
}

export interface CreateQuoteInput {
  job_id: string;
  video_url: string;
  price_cents: number;
  availability_text?: string;
  availability_slots?: Record<string, unknown>[];
}

/** Editable fields when job is open and has no quotes. */
export interface UpdateJobInput {
  headline?: string;
  description?: string;
  urgency?: JobUrgency;
  budget_min_cents?: number | null;
  budget_max_cents?: number | null;
  media_urls?: { url: string; type: 'photo' | 'video' }[];
}

const JOB_CATEGORIES: { value: JobCategory; label: string }[] = [
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'mounting', label: 'Mounting & TV' },
  { value: 'repairs', label: 'Repairs' },
  { value: 'yard_work', label: 'Yard & outdoor' },
  { value: 'moving_help', label: 'Moving help' },
  { value: 'organizing', label: 'Organizing' },
  { value: 'handyman', label: 'Handyman' },
  { value: 'delivery', label: 'Delivery & errands' },
  { value: 'pet_care', label: 'Pet care' },
  { value: 'tech_support', label: 'Tech & setup' },
  { value: 'laundry', label: 'Laundry' },
  { value: 'junk_removal', label: 'Junk removal' },
  { value: 'other', label: 'Other' },
];

const JOB_URGENCIES: { value: JobUrgency; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'this_week', label: 'This week' },
  { value: 'next_week', label: 'Next week' },
  { value: 'this_weekend', label: 'This weekend' },
  { value: 'next_month', label: 'Next month' },
  { value: 'morning', label: 'Morning preferred' },
  { value: 'afternoon', label: 'Afternoon preferred' },
  { value: 'evening', label: 'Evening preferred' },
  { value: 'flexible', label: 'Flexible' },
];

class JobQuoteService {
  /**
   * In-flight job creates per customer. Prevents duplicate jobs when the
   * customer double-taps "Post Job" before the first request resolves.
   */
  private inFlightJobs = new Set<string>();

  getCategories() {
    return JOB_CATEGORIES;
  }

  getUrgencies() {
    return JOB_URGENCIES;
  }

  getCategoryLabel(cat: JobCategory): string {
    return JOB_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
  }

  getUrgencyLabel(u: JobUrgency): string {
    return JOB_URGENCIES.find((u2) => u2.value === u)?.label ?? u;
  }

  /**
   * Title for list/detail: prefer `headline`, then `metadata.title` / `metadata.headline`,
   * then category + city, then first line of description, then a generic request label.
   */
  getJobDisplayTitle(
    job: (Partial<Job> & { metadata?: unknown }) | null | undefined
  ): string {
    if (job == null) return 'Service request';
    const j = job as Record<string, unknown>;
    const meta = j.metadata;
    let fromMeta = '';
    if (meta && typeof meta === 'object' && meta !== null) {
      const m = meta as Record<string, unknown>;
      if (typeof m.title === 'string' && m.title.trim()) {
        fromMeta = m.title.trim();
      } else if (typeof m.headline === 'string' && m.headline.trim()) {
        fromMeta = m.headline.trim();
      }
    }
    const head = typeof j.headline === 'string' ? j.headline.trim() : '';
    if (head) return head;
    if (fromMeta) return fromMeta;
    const category = j.category as JobCategory | undefined;
    const catLabel = category ? this.getCategoryLabel(category) : 'Service';
    const city = typeof j.city === 'string' && j.city.trim() ? j.city.trim() : '';
    if (city) return `${catLabel} · ${city}`;
    const desc = typeof j.description === 'string' && j.description.trim() ? j.description.trim() : '';
    if (desc) {
      const one = (desc.split(/\n/)[0] ?? '').trim();
      return one.length > 72 ? `${one.slice(0, 69)}...` : one;
    }
    return `${catLabel} request`;
  }

  private normalizeEmbeddedJob<T extends { job?: unknown }>(row: T): T {
    const raw = (row as { job?: unknown }).job;
    const job = raw == null ? undefined : Array.isArray(raw) ? (raw[0] as Job) : (raw as Job);
    return { ...row, job };
  }

  /** Map pro specialty (e.g. "Cleaning") to job_category enum (e.g. "cleaning"). */
  specialtyToCategory(specialty: string): JobCategory | null {
    const s = specialty?.toLowerCase().trim();
    if (!s) return null;
    const match = JOB_CATEGORIES.find((c) => c.label.toLowerCase() === s || c.value === s);
    return match?.value ?? null;
  }

  /** 24 hours from now */
  expiryTime(): number {
    return Date.now() + 24 * 60 * 60 * 1000;
  }

  /** Quote expires in 24 hours */
  quoteExpiryTime(): number {
    return Date.now() + 24 * 60 * 60 * 1000;
  }

  async createJob(customerId: string, input: CreateJobInput): Promise<ApiResponse<Job>> {
    if (customerId && this.inFlightJobs.has(customerId)) {
      return {
        success: false,
        data: null as any,
        error: 'A job post is already being submitted. Please wait a moment.',
      };
    }
    if (customerId) this.inFlightJobs.add(customerId);
    try {
      const expiresAt = new Date(this.expiryTime()).toISOString();
      const { data: job, error: jobErr } = await supabase
        .from('jobs')
        .insert({
          customer_id: customerId,
          headline: input.headline,
          description: input.description ?? null,
          category: input.category,
          urgency: input.urgency,
          budget_min_cents: input.budget_min_cents ?? null,
          budget_max_cents: input.budget_max_cents ?? null,
          address_id: input.address_id ?? null,
          street: input.street ?? null,
          city: input.city ?? null,
          state: input.state ?? null,
          zip_code: input.zip_code ?? null,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (jobErr) throw jobErr;
      if (!job) throw new Error('Job not created');

      if (input.media_urls?.length) {
        const mediaRows = input.media_urls.map((m, i) => ({
          job_id: job.id,
          media_url: m.url,
          media_type: m.type,
          sort_order: i,
        }));
        const { error: mediaErr } = await supabase.from('job_media').insert(mediaRows);
        if (mediaErr) {
          // Surface so the UI can warn the user instead of silently dropping media.
          console.warn('createJob: job_media insert failed:', mediaErr.message);
          return {
            success: true,
            data: job as Job,
            error: `Job posted, but we could not attach your media: ${mediaErr.message}`,
          };
        }
      }

      return { success: true, data: job as Job };
    } catch (e) {
      console.error('createJob error:', e);
      return { success: false, error: e instanceof Error ? e.message : 'Failed to create job' };
    } finally {
      if (customerId) this.inFlightJobs.delete(customerId);
    }
  }

  async getJob(jobId: string): Promise<ApiResponse<Job>> {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          customer:users!customer_id(name, avatar_url),
          media:job_media(*)
        `)
        .eq('id', jobId)
        .single();

      if (error) throw error;
      return { success: true, data: data as Job };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed to load job' };
    }
  }

  async getCustomerJobs(customerId: string): Promise<ApiResponse<Job[]>> {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          media:job_media(*)
        `)
        .eq('customer_id', customerId)
        .eq('hidden_by_customer', false)
        .eq('archived', false)
        .eq('deleted', false)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return { success: true, data: (data || []) as Job[] };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed to load jobs' };
    }
  }

  async getCustomerJobsArchived(customerId: string): Promise<ApiResponse<Job[]>> {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          media:job_media(*)
        `)
        .eq('customer_id', customerId)
        .eq('archived', true)
        .eq('deleted', false)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return { success: true, data: (data || []) as Job[] };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed to load archived jobs' };
    }
  }

  async hideJob(jobId: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ hidden_by_customer: true })
        .eq('id', jobId);

      if (error) throw error;
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed to hide job' };
    }
  }

  async getJobQuotes(jobId: string): Promise<ApiResponse<Quote[]>> {
    try {
      const { data, error } = await supabase
        .from('quotes')
        // Avoid embedding cleaner_profiles: some projects expose a view that references missing
        // `cities.app_area` and breaks PostgREST. Rating can use a follow-up if needed.
        .select(`
          *,
          pro:users!pro_id(name, avatar_url)
        `)
        .eq('job_id', jobId)
        .in('status', ['pending', 'viewed'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data: (data || []) as Quote[] };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed to load quotes' };
    }
  }

  /**
   * A single pro’s quote on a job, any status (pending…withdrawn). Used so cleaners see their
   * own sent quote even after it becomes accepted — `getJobQuotes` only returns pending/viewed.
   */
  async getProQuoteOnJob(proId: string, jobId: string): Promise<ApiResponse<Quote | null>> {
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          pro:users!pro_id(name, avatar_url)
        `)
        .eq('job_id', jobId)
        .eq('pro_id', proId)
        .maybeSingle();

      if (error) throw error;
      return { success: true, data: (data as Quote) ?? null };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed to load quote', data: null };
    }
  }

  /**
   * Get open jobs for pro to send video quotes.
   * - Excludes jobs pro already quoted
   * - Filters by category if proCategory provided (matches job_category enum)
   * - Filters by radius when proLat/proLng/radiusMiles provided (default 50 if no profile)
   */
  async getAvailableJobsForPro(
    proId: string,
    proLat?: number,
    proLng?: number,
    proCategory?: JobCategory,
    radiusMiles: number = 50
  ): Promise<ApiResponse<Job[]>> {
    try {
      const { data: quotedJobIds } = await supabase
        .from('quotes')
        .select('job_id')
        .eq('pro_id', proId);
      const excludeIds = new Set((quotedJobIds || []).map((r) => r.job_id).filter(Boolean));

      let query = supabase
        .from('jobs')
        .select(`
          *,
          customer:users!customer_id(name, avatar_url),
          media:job_media(*)
        `)
        .eq('status', 'open')
        .eq('deleted', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });
      if (proCategory) {
        query = query.eq('category', proCategory);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('[getAvailableJobsForPro] query error:', error);
        throw error;
      }

      let jobs = ((data || []) as Job[]).filter((j) => !excludeIds.has(j.id));

      if (proLat != null && proLng != null) {
        jobs = jobs
          .map((j) => {
            if (j.latitude != null && j.longitude != null) {
              const d = haversineMiles(proLat, proLng, Number(j.latitude), Number(j.longitude));
              return { ...j, distance_miles: Math.round(d * 10) / 10 };
            }
            return { ...j, distance_miles: undefined };
          })
          .filter((j) => j.distance_miles == null || j.distance_miles <= radiusMiles)
          .sort((a, b) => (a.distance_miles ?? 999) - (b.distance_miles ?? 999));
      }

      if (__DEV__) {
        console.log('[getAvailableJobsForPro] proCategory:', proCategory, 'radiusMiles:', radiusMiles, 'found:', jobs.length);
      }
      return { success: true, data: jobs };
    } catch (e) {
      console.error('[getAvailableJobsForPro] error:', e);
      return { success: false, error: e instanceof Error ? e.message : 'Failed to load jobs' };
    }
  }

  /**
   * Check if pro can accept another quote (under capacity limit).
   * Same-customer exception: if pro already has bookings with this job's customer, allow up to 5.
   */
  async canAcceptQuote(proId: string, jobId: string): Promise<ApiResponse<{ canAccept: boolean; activeCount: number; limit: number }>> {
    try {
      const { data: profile } = await supabase
        .from('cleaner_profiles')
        .select('max_concurrent_bookings')
        .eq('user_id', proId)
        .single();

      const limit = profile?.max_concurrent_bookings ?? 3;

      const { data: job } = await supabase
        .from('jobs')
        .select('customer_id')
        .eq('id', jobId)
        .single();

      const { count: activeCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('cleaner_id', proId)
        .in('status', ['confirmed', 'cleaner_assigned', 'cleaner_en_route', 'cleaner_arrived', 'in_progress']);

      const sameCustomerLimit = job?.customer_id
        ? (await supabase
            .from('bookings')
            .select('id')
            .eq('cleaner_id', proId)
            .eq('customer_id', job.customer_id)
            .in('status', ['confirmed', 'cleaner_assigned', 'cleaner_en_route', 'cleaner_arrived', 'in_progress']))
            .data?.length ?? 0
        : 0;

      const effectiveLimit = sameCustomerLimit > 0 ? 5 : limit;
      const canAccept = (activeCount ?? 0) < effectiveLimit;

      return {
        success: true,
        data: { canAccept, activeCount: activeCount ?? 0, limit: effectiveLimit },
      };
    } catch (e) {
      return {
        success: false,
        data: { canAccept: false, activeCount: 0, limit: 3 },
        error: e instanceof Error ? e.message : 'Capacity check failed',
      };
    }
  }

  async createQuote(proId: string, input: CreateQuoteInput): Promise<ApiResponse<Quote>> {
    try {
      const capacityCheck = await this.canAcceptQuote(proId, input.job_id);
      if (!capacityCheck.success || !capacityCheck.data?.canAccept) {
        return {
          success: false,
          error: 'Complete current jobs to accept more. You are at capacity.',
        };
      }

      const expiresAt = new Date(this.quoteExpiryTime()).toISOString();
      const { data, error } = await supabase
        .from('quotes')
        .insert({
          job_id: input.job_id,
          pro_id: proId,
          video_url: input.video_url,
          price_cents: input.price_cents,
          availability_text: input.availability_text ?? null,
          availability_slots: input.availability_slots ?? null,
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data: data as Quote };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed to send quote' };
    }
  }

  /** Get all quotes for customer's jobs (for Quotes tab). */
  async getCustomerQuotes(customerId: string): Promise<ApiResponse<(Quote & { job?: Job })[]>> {
    try {
      const { data: jobs, error: jobsErr } = await supabase
        .from('jobs')
        .select('id, headline, description, category, status, city')
        .eq('customer_id', customerId)
        .in('status', ['open', 'quotes_received', 'booked']);

      if (jobsErr || !jobs?.length) return { success: true, data: [] };

      const { data: quotes, error: quotesErr } = await supabase
        .from('quotes')
        .select(`
          *,
          pro:users!pro_id(name, avatar_url)
        `)
        .in('job_id', jobs.map((j) => j.id))
        .in('status', ['pending', 'viewed'])
        .order('created_at', { ascending: false });

      if (quotesErr) throw quotesErr;
      const jobMap = new Map((jobs || []).map((j) => [j.id, j]));
      const withJob = (quotes || []).map((q) => ({ ...q, job: jobMap.get(q.job_id) }));
      return { success: true, data: withJob as (Quote & { job?: Job })[] };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed to load quotes', data: [] };
    }
  }

  async getJobWithQuotes(
    jobId: string,
    options?: { mergeProQuoteId?: string }
  ): Promise<ApiResponse<{ job: Job; quotes: Quote[] }>> {
    const mergeProId = options?.mergeProQuoteId;
    const [jobRes, quotesRes, ownRes] = await Promise.all([
      this.getJob(jobId),
      this.getJobQuotes(jobId),
      mergeProId ? this.getProQuoteOnJob(mergeProId, jobId) : Promise.resolve({ success: true, data: null } as const),
    ]);
    if (!jobRes.success || !jobRes.data) return { success: false, error: jobRes.error };

    const base = quotesRes.success && quotesRes.data ? quotesRes.data : [];
    if (mergeProId && ownRes.success && ownRes.data) {
      const byId = new Map(base.map((q) => [q.id, q]));
      byId.set(ownRes.data.id, ownRes.data);
      const merged = Array.from(byId.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      return { success: true, data: { job: jobRes.data, quotes: merged } };
    }
    if (!mergeProId && !quotesRes.success) {
      return { success: false, error: quotesRes.error || 'Failed to load quotes' };
    }
    const sorted = [...base].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return { success: true, data: { job: jobRes.data, quotes: sorted } };
  }

  /** Fetch a single quote with job and pro for payment flow. */
  async getQuote(quoteId: string): Promise<ApiResponse<Quote & { job?: Job }>> {
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          pro:users!pro_id(name, avatar_url),
          job:jobs(id, headline, customer_id, address_id, street, city, state, zip_code)
        `)
        .eq('id', quoteId)
        .single();

      if (error) throw error;
      return { success: true, data: data as Quote & { job?: Job } };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed to load quote' };
    }
  }

  async declineQuote(quoteId: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('quotes')
        .update({ status: 'declined' })
        .eq('id', quoteId);

      if (error) throw error;
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed to decline quote' };
    }
  }

  /** Get all quotes sent by pro (for My Quotes tab). */
  async getProQuotes(proId: string): Promise<ApiResponse<(Quote & { job?: Job })[]>> {
    try {
      const { data: quotes, error } = await supabase
        .from('quotes')
        .select(`
          *,
          job:jobs(
            id,
            headline,
            description,
            category,
            status,
            customer_id,
            expires_at,
            city,
            street,
            state
          )
        `)
        .eq('pro_id', proId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const rows = (quotes || []).map((row) => this.normalizeEmbeddedJob(row as { job?: unknown }));
      return { success: true, data: rows as (Quote & { job?: Job })[] };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed to load quotes', data: [] };
    }
  }

  /** Withdraw quote (remove bid from consideration). Sets status to withdrawn, notifies customer. */
  async withdrawQuote(quoteId: string, proId: string): Promise<ApiResponse<void>> {
    try {
      const { data: quote, error: fetchErr } = await supabase
        .from('quotes')
        .select('id, job_id, status')
        .eq('id', quoteId)
        .eq('pro_id', proId)
        .single();

      if (fetchErr || !quote) return { success: false, error: 'Quote not found or not yours' };
      if (quote.status !== 'pending' && quote.status !== 'viewed') {
        return { success: false, error: 'Quote can no longer be withdrawn' };
      }

      const withdrawnAt = new Date().toISOString();
      const { data, error } = await supabase
        .from('quotes')
        .update({ status: 'withdrawn', withdrawn_at: withdrawnAt })
        .eq('id', quoteId)
        .eq('pro_id', proId)
        .select('id')
        .single();

      if (error) throw error;
      if (!data) return { success: false, error: 'Quote not found or not yours' };

      // Notify customer (push)
      try {
        const { data: job } = await supabase.from('jobs').select('customer_id').eq('id', quote.job_id).single();
        if (job?.customer_id) {
          await supabase.functions.invoke('send-push', {
            body: {
              user_id: job.customer_id,
              title: 'Quote withdrawn',
              body: 'A pro has withdrawn their quote from your job.',
              data: { job_id: quote.job_id, quote_id: quoteId, type: 'quote_withdrawn' },
            },
          });
        }
      } catch {
        // Non-blocking
      }

      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed to withdraw quote' };
    }
  }

  /** Mark quote as viewed by customer (when customer opens job details with video). */
  async markQuoteViewed(quoteId: string, customerId: string): Promise<ApiResponse<void>> {
    try {
      const { data: quote } = await supabase
        .from('quotes')
        .select('id, job_id')
        .eq('id', quoteId)
        .single();
      if (!quote) return { success: false, error: 'Quote not found' };

      const { data: job } = await supabase
        .from('jobs')
        .select('customer_id')
        .eq('id', quote.job_id)
        .single();
      if (!job || job.customer_id !== customerId) return { success: false, error: 'Unauthorized' };

      const { error } = await supabase
        .from('quotes')
        .update({
          customer_viewed_at: new Date().toISOString(),
          status: 'viewed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', quoteId)
        .is('customer_viewed_at', null);

      if (error) throw error;
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed to mark viewed' };
    }
  }

  /** Update quote (only when status=pending and customer hasn't viewed). */
  async updateQuote(
    quoteId: string,
    proId: string,
    input: { video_url?: string; price_cents?: number; availability_text?: string }
  ): Promise<ApiResponse<Quote>> {
    try {
      const { data: existing } = await supabase
        .from('quotes')
        .select('id, status, customer_viewed_at')
        .eq('id', quoteId)
        .eq('pro_id', proId)
        .single();
      if (!existing) return { success: false, error: 'Quote not found' };
      if (existing.status !== 'pending') return { success: false, error: 'Quote can no longer be edited' };
      if (existing.customer_viewed_at) return { success: false, error: 'Customer has already viewed this quote' };

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (input.video_url != null) updates.video_url = input.video_url;
      if (input.price_cents != null) updates.price_cents = input.price_cents;
      if (input.availability_text !== undefined) updates.availability_text = input.availability_text;

      const { data, error } = await supabase
        .from('quotes')
        .update(updates)
        .eq('id', quoteId)
        .eq('pro_id', proId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data: data as Quote };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed to update quote' };
    }
  }

  async acceptQuote(quoteId: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('quotes')
        .update({ status: 'accepted' })
        .eq('id', quoteId);

      if (error) throw error;

      // DB trigger inserts into notifications; send push so pros see it immediately.
      const { data: row } = await supabase
        .from('quotes')
        .select('pro_id, job_id')
        .eq('id', quoteId)
        .single();

      const proId = row?.pro_id as string | undefined;
      let headline = 'Your job';
      if (row?.job_id) {
        const { data: j } = await supabase
          .from('jobs')
          .select('headline')
          .eq('id', row.job_id)
          .maybeSingle();
        if (j?.headline?.trim()) headline = j.headline.trim();
      }
      if (proId) {
        try {
          await supabase.functions.invoke('send-push', {
            body: {
              userId: proId,
              title: 'Quote accepted!',
              body: `Your video quote for "${headline}" was accepted.`,
              data: { type: 'quote_accepted', quote_id: quoteId, job_id: row?.job_id },
            },
          });
        } catch {
          /* non-blocking */
        }
      }

      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed to accept quote' };
    }
  }

  async setJobBooked(jobId: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ status: 'booked' })
        .eq('id', jobId);

      if (error) throw error;
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed to update job' };
    }
  }

  /** Update job (only when status='open' and no quotes). Editable: headline, description, urgency, budget, media. */
  async updateJob(jobId: string, input: UpdateJobInput): Promise<ApiResponse<Job>> {
    try {
      const updates: Record<string, unknown> = {};
      if (input.headline != null) updates.headline = input.headline;
      if (input.description != null) updates.description = input.description;
      if (input.urgency != null) updates.urgency = input.urgency;
      if (input.budget_min_cents !== undefined) updates.budget_min_cents = input.budget_min_cents;
      if (input.budget_max_cents !== undefined) updates.budget_max_cents = input.budget_max_cents;

      if (Object.keys(updates).length > 0) {
        const { data, error } = await supabase
          .from('jobs')
          .update(updates)
          .eq('id', jobId)
          .select()
          .single();
        if (error) throw error;
      }

      if (input.media_urls != null) {
        const { error: delErr } = await supabase
          .from('job_media')
          .delete()
          .eq('job_id', jobId);
        if (delErr) throw delErr;
        if (input.media_urls.length > 0) {
          const rows = input.media_urls.map((m, i) => ({
            job_id: jobId,
            media_url: m.url,
            media_type: m.type,
            sort_order: i,
          }));
          const { error: insErr } = await supabase.from('job_media').insert(rows);
          if (insErr) throw insErr;
        }
      }

      const res = await this.getJob(jobId);
      return res;
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed to update job' };
    }
  }

  /** Soft delete job (deleted=true, deleted_at, status=cancelled). */
  async deleteJob(jobId: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({
          deleted: true,
          deleted_at: new Date().toISOString(),
          status: 'cancelled',
        })
        .eq('id', jobId);

      if (error) throw error;
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed to delete job' };
    }
  }

  /**
   * Permanently delete job: mark deleted, remove media from storage.
   * Call only for booked/expired/cancelled jobs.
   */
  async permanentlyDeleteJob(jobId: string): Promise<ApiResponse<void>> {
    try {
      const { data: mediaRows, error: mediaErr } = await supabase
        .from('job_media')
        .select('media_url')
        .eq('job_id', jobId);

      if (!mediaErr && mediaRows?.length) {
        for (const row of mediaRows) {
          const url = row.media_url;
          if (!url || typeof url !== 'string') continue;
          const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
          if (match) {
            const [, bucket, path] = match;
            await supabase.storage.from(bucket).remove([path]);
          }
        }
      }

      const { error } = await supabase
        .from('jobs')
        .update({
          deleted: true,
          deleted_at: new Date().toISOString(),
          permanently_deleted: true,
        })
        .eq('id', jobId);

      if (error) throw error;
      const { error: mediaCleanupErr } = await supabase
        .from('job_media')
        .delete()
        .eq('job_id', jobId);
      if (mediaCleanupErr) {
        // Job is already marked deleted; orphaned rows can be cleaned up later.
        console.warn('permanentlyDeleteJob: media cleanup failed:', mediaCleanupErr.message);
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed to permanently delete job' };
    }
  }

  /** Cancel job (set status to cancelled). Notifies pros who quoted. */
  async cancelJob(jobId: string): Promise<ApiResponse<void>> {
    try {
      const { data: quotes } = await supabase
        .from('quotes')
        .select('pro_id')
        .eq('job_id', jobId)
        .in('status', ['pending', 'viewed', 'withdrawn', 'declined', 'expired']);
      const proIds = [...new Set((quotes || []).map((q) => q.pro_id).filter(Boolean))];

      const { error } = await supabase
        .from('jobs')
        .update({ status: 'cancelled' })
        .eq('id', jobId);

      if (error) throw error;

      for (const proId of proIds) {
        try {
          await supabase.functions.invoke('send-push', {
            body: {
              user_id: proId,
              title: 'Job cancelled',
              body: 'A customer has cancelled their job.',
              data: { job_id: jobId, type: 'job_cancelled' },
            },
          });
        } catch {
          // Non-blocking
        }
      }

      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed to cancel job' };
    }
  }

}

export const jobQuoteService = new JobQuoteService();
