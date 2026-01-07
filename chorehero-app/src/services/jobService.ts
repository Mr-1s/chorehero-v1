import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

export interface JobServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  retryAfter?: number;
}

export interface Job {
  id: string;
  customer_name: string;
  customer_avatar: string;
  service_type: string;
  address: string;
  distance: number;
  estimated_duration: number;
  payment: number;
  scheduled_time: string;
  priority: 'high' | 'medium' | 'low';
  status: 'available' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  special_requests?: string;
  customer_id: string;
  created_at: string;
  expires_at: string;
}

class JobService {
  private baseUrl = 'https://api.chorehero.com';
  private maxRetries = 3;
  private retryDelay = 1000;
  private pendingRequests = new Map<string, Promise<any>>();

  // Network status monitoring
  private isOnline = true;
  private networkListener: any;

  constructor() {
    this.initNetworkMonitoring();
  }

  private initNetworkMonitoring() {
    this.networkListener = NetInfo.addEventListener(state => {
      this.isOnline = state.isConnected ?? false;
      if (this.isOnline) {
        this.processPendingOperations();
      }
    });
  }

  // Robust HTTP request with retry logic
  private async makeRequest<T>(
    url: string, 
    options: RequestInit, 
    retryCount = 0
  ): Promise<JobServiceResponse<T>> {
    try {
      // Check network connectivity
      if (!this.isOnline) {
        return {
          success: false,
          error: 'No internet connection',
          errorCode: 'NETWORK_OFFLINE'
        };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(`${this.baseUrl}${url}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Handle specific HTTP status codes
        switch (response.status) {
          case 409:
            return {
              success: false,
              error: 'Job has already been accepted by another cleaner',
              errorCode: 'JOB_ALREADY_TAKEN'
            };
          case 410:
            return {
              success: false,
              error: 'Job is no longer available',
              errorCode: 'JOB_EXPIRED'
            };
          case 429:
            const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
            return {
              success: false,
              error: 'Too many requests. Please wait before trying again.',
              errorCode: 'RATE_LIMITED',
              retryAfter
            };
          case 500:
          case 502:
          case 503:
            // Server errors - retry
            if (retryCount < this.maxRetries) {
              await this.delay(this.retryDelay * Math.pow(2, retryCount));
              return this.makeRequest(url, options, retryCount + 1);
            }
            return {
              success: false,
              error: 'Server error. Please try again later.',
              errorCode: 'SERVER_ERROR'
            };
          default:
            return {
              success: false,
              error: `Request failed with status ${response.status}`,
              errorCode: 'REQUEST_FAILED'
            };
        }
      }

      const data = await response.json();
      return {
        success: true,
        data
      };

    } catch (error: any) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timed out',
          errorCode: 'TIMEOUT'
        };
      }

      // Network errors - retry
      if (retryCount < this.maxRetries && this.isNetworkError(error)) {
        await this.delay(this.retryDelay * Math.pow(2, retryCount));
        return this.makeRequest(url, options, retryCount + 1);
      }

      return {
        success: false,
        error: error.message || 'Network error occurred',
        errorCode: 'NETWORK_ERROR'
      };
    }
  }

  private isNetworkError(error: any): boolean {
    return error.code === 'NETWORK_REQUEST_FAILED' || 
           error.message?.includes('Network request failed') ||
           error.message?.includes('fetch');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Job acceptance with competition handling
  async acceptJob(jobId: string, cleanerId: string): Promise<JobServiceResponse<Job>> {
    // Prevent duplicate requests for the same job
    const requestKey = `accept-${jobId}`;
    if (this.pendingRequests.has(requestKey)) {
      return this.pendingRequests.get(requestKey);
    }

    const requestPromise = this.performJobAcceptance(jobId, cleanerId);
    this.pendingRequests.set(requestKey, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      this.pendingRequests.delete(requestKey);
    }
  }

  private async performJobAcceptance(jobId: string, cleanerId: string): Promise<JobServiceResponse<Job>> {
    // Store request for offline retry
    await this.storeOfflineAction('acceptJob', { jobId, cleanerId });

    const response = await this.makeRequest<Job>('/jobs/accept', {
      method: 'POST',
      body: JSON.stringify({
        jobId,
        cleanerId,
        timestamp: new Date().toISOString()
      })
    });

    if (response.success) {
      // Remove from offline queue if successful
      await this.removeOfflineAction('acceptJob', jobId);
      
      // Update local cache
      await this.updateLocalJobStatus(jobId, 'accepted');
    }

    return response;
  }

  // Reject job
  async rejectJob(jobId: string, cleanerId: string): Promise<JobServiceResponse> {
    await this.storeOfflineAction('rejectJob', { jobId, cleanerId });

    const response = await this.makeRequest('/jobs/reject', {
      method: 'POST',
      body: JSON.stringify({
        jobId,
        cleanerId,
        timestamp: new Date().toISOString()
      })
    });

    if (response.success) {
      await this.removeOfflineAction('rejectJob', jobId);
      await this.removeLocalJob(jobId);
    }

    return response;
  }

  // Get available jobs
  async getAvailableJobs(location: { lat: number; lng: number }, radius = 25): Promise<JobServiceResponse<Job[]>> {
    const response = await this.makeRequest<Job[]>('/jobs/available', {
      method: 'GET',
      headers: {
        'X-Location': `${location.lat},${location.lng}`,
        'X-Radius': radius.toString()
      }
    });

    if (response.success && response.data) {
      // Cache jobs locally
      await this.cacheJobs(response.data);
    }

    return response;
  }

  // Update job status
  async updateJobStatus(jobId: string, status: Job['status'], metadata?: any): Promise<JobServiceResponse<Job>> {
    await this.storeOfflineAction('updateJobStatus', { jobId, status, metadata });

    const response = await this.makeRequest<Job>(`/jobs/${jobId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        metadata,
        timestamp: new Date().toISOString()
      })
    });

    if (response.success) {
      await this.removeOfflineAction('updateJobStatus', jobId);
      await this.updateLocalJobStatus(jobId, status);
    }

    return response;
  }

  // Offline operations management
  private async storeOfflineAction(action: string, data: any) {
    try {
      const offlineActions = await this.getOfflineActions();
      const actionId = `${action}-${data.jobId || Date.now()}`;
      
      offlineActions[actionId] = {
        action,
        data,
        timestamp: new Date().toISOString(),
        retryCount: 0
      };

      await AsyncStorage.setItem('offline_actions', JSON.stringify(offlineActions));
    } catch (error) {
      console.error('Error storing offline action:', error);
    }
  }

  private async removeOfflineAction(action: string, jobId: string) {
    try {
      const offlineActions = await this.getOfflineActions();
      const actionId = `${action}-${jobId}`;
      delete offlineActions[actionId];
      await AsyncStorage.setItem('offline_actions', JSON.stringify(offlineActions));
    } catch (error) {
      console.error('Error removing offline action:', error);
    }
  }

  private async getOfflineActions(): Promise<Record<string, any>> {
    try {
      const stored = await AsyncStorage.getItem('offline_actions');
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Error getting offline actions:', error);
      return {};
    }
  }

  // Process pending operations when back online
  private async processPendingOperations() {
    const offlineActions = await this.getOfflineActions();
    
    for (const [actionId, actionData] of Object.entries(offlineActions)) {
      try {
        const { action, data } = actionData as any;
        
        switch (action) {
          case 'acceptJob':
            await this.performJobAcceptance(data.jobId, data.cleanerId);
            break;
          case 'rejectJob':
            await this.rejectJob(data.jobId, data.cleanerId);
            break;
          case 'updateJobStatus':
            await this.updateJobStatus(data.jobId, data.status, data.metadata);
            break;
        }
      } catch (error) {
        console.error(`Error processing offline action ${actionId}:`, error);
      }
    }
  }

  // Local caching
  private async cacheJobs(jobs: Job[]) {
    try {
      await AsyncStorage.setItem('cached_jobs', JSON.stringify(jobs));
    } catch (error) {
      console.error('Error caching jobs:', error);
    }
  }

  private async getCachedJobs(): Promise<Job[]> {
    try {
      const cached = await AsyncStorage.getItem('cached_jobs');
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.error('Error getting cached jobs:', error);
      return [];
    }
  }

  private async updateLocalJobStatus(jobId: string, status: Job['status']) {
    try {
      const jobs = await this.getCachedJobs();
      const updatedJobs = jobs.map(job => 
        job.id === jobId ? { ...job, status } : job
      );
      await this.cacheJobs(updatedJobs);
    } catch (error) {
      console.error('Error updating local job status:', error);
    }
  }

  private async removeLocalJob(jobId: string) {
    try {
      const jobs = await this.getCachedJobs();
      const filteredJobs = jobs.filter(job => job.id !== jobId);
      await this.cacheJobs(filteredJobs);
    } catch (error) {
      console.error('Error removing local job:', error);
    }
  }

  // Get jobs for offline mode
  async getJobsOffline(): Promise<Job[]> {
    return this.getCachedJobs();
  }

  // Cleanup
  destroy() {
    if (this.networkListener) {
      this.networkListener();
    }
  }
}

export const jobService = new JobService();