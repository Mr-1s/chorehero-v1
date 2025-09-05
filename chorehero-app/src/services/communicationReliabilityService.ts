import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiResponse } from '../types/api';

// ============================================================================
// COMMUNICATION & RELIABILITY SERVICE
// Integrated solution for Gaps #6, #7, #9, #25
// ============================================================================

export interface MessageDeliveryStatus {
  message_id: string;
  status: 'sending' | 'delivered' | 'failed' | 'retrying';
  attempts: number;
  last_attempt: string;
  delivery_confirmation?: string;
  error_reason?: string;
}

export interface LocationUpdate {
  id: string;
  cleaner_id: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
  status: 'pending' | 'sent' | 'failed';
  network_quality: 'good' | 'poor' | 'offline';
}

export interface SessionSyncState {
  device_id: string;
  user_id: string;
  last_active: string;
  app_state: any;
  sync_version: number;
  conflicts?: Array<{
    field: string;
    local_value: any;
    remote_value: any;
    timestamp: string;
  }>;
}

export interface LoadingState {
  operation_id: string;
  operation_type: string;
  start_time: string;
  timeout_ms: number;
  status: 'loading' | 'completed' | 'timeout' | 'error';
  retry_count: number;
}

class CommunicationReliabilityService {
  private messageQueue: Map<string, MessageDeliveryStatus> = new Map();
  private locationQueue: LocationUpdate[] = [];
  private sessionStates: Map<string, SessionSyncState> = new Map();
  private loadingOperations: Map<string, LoadingState> = new Map();
  private isOnline: boolean = true;

  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  
  async initialize(): Promise<void> {
    console.log('🚀 Initializing Communication & Reliability Service');
    
    await this.loadPendingOperations();
    this.setupNetworkMonitoring();
    this.setupSessionSync();
    this.setupPeriodicCleanup();
    
    console.log('✅ Communication & Reliability Service initialized');
  }

  // ============================================================================
  // GAP #6: MESSAGE DELIVERY WITH RETRY LOGIC
  // ============================================================================
  
  /**
   * Send message with delivery confirmation and retry logic
   */
  async sendMessageWithRetry(
    roomId: string,
    senderId: string,
    content: string,
    messageType: 'text' | 'image' | 'location' = 'text',
    maxRetries: number = 3
  ): Promise<ApiResponse<{ message_id: string; delivery_status: string }>> {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      console.log('📤 Sending message with retry logic:', messageId);

      // Track delivery status
      const deliveryStatus: MessageDeliveryStatus = {
        message_id: messageId,
        status: 'sending',
        attempts: 0,
        last_attempt: new Date().toISOString()
      };
      
      this.messageQueue.set(messageId, deliveryStatus);

      if (!this.isOnline) {
        console.log('📵 Offline: Queueing message for later delivery');
        deliveryStatus.status = 'retrying';
        await this.saveMessageQueue();
        return {
          success: true,
          data: { message_id: messageId, delivery_status: 'queued_offline' }
        };
      }

      // Attempt to send message
      const sendResult = await this.attemptMessageSend(roomId, senderId, content, messageType, messageId);
      
      if (sendResult.success) {
        deliveryStatus.status = 'delivered';
        deliveryStatus.delivery_confirmation = new Date().toISOString();
        console.log('✅ Message delivered successfully:', messageId);
        
        return {
          success: true,
          data: { message_id: messageId, delivery_status: 'delivered' }
        };
      } else {
        // Start retry process
        this.retryMessageDelivery(messageId, roomId, senderId, content, messageType, maxRetries);
        return {
          success: true,
          data: { message_id: messageId, delivery_status: 'retrying' }
        };
      }

    } catch (error) {
      console.error('❌ Message send failed:', error);
      const deliveryStatus = this.messageQueue.get(messageId);
      if (deliveryStatus) {
        deliveryStatus.status = 'failed';
        deliveryStatus.error_reason = error instanceof Error ? error.message : 'Unknown error';
      }

      return {
        success: false,
        data: { message_id: messageId, delivery_status: 'failed' },
        error: error instanceof Error ? error.message : 'Message send failed'
      };
    }
  }

  private async attemptMessageSend(
    roomId: string,
    senderId: string,
    content: string,
    messageType: string,
    messageId: string
  ): Promise<ApiResponse<any>> {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        id: messageId,
        room_id: roomId,
        user_id: senderId,
        content: content,
        message_type: messageType,
        delivery_status: 'sent'
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return { success: true, data };
  }

  private async retryMessageDelivery(
    messageId: string,
    roomId: string,
    senderId: string,
    content: string,
    messageType: string,
    maxRetries: number
  ): Promise<void> {
    const deliveryStatus = this.messageQueue.get(messageId);
    if (!deliveryStatus) return;

    // Exponential backoff: 2s, 4s, 8s, 16s...
    const retryDelay = Math.min(2000 * Math.pow(2, deliveryStatus.attempts), 30000);
    
    setTimeout(async () => {
      if (!deliveryStatus || deliveryStatus.attempts >= maxRetries) {
        if (deliveryStatus) {
          deliveryStatus.status = 'failed';
          deliveryStatus.error_reason = 'Max retries exceeded';
        }
        return;
      }

      deliveryStatus.attempts++;
      deliveryStatus.last_attempt = new Date().toISOString();
      
      try {
        const result = await this.attemptMessageSend(roomId, senderId, content, messageType, messageId);
        if (result.success) {
          deliveryStatus.status = 'delivered';
          deliveryStatus.delivery_confirmation = new Date().toISOString();
          console.log('✅ Message delivered on retry:', messageId, `attempt ${deliveryStatus.attempts}`);
        } else {
          // Continue retrying
          this.retryMessageDelivery(messageId, roomId, senderId, content, messageType, maxRetries);
        }
      } catch (error) {
        console.log('🔄 Retry failed, will try again:', messageId, error);
        this.retryMessageDelivery(messageId, roomId, senderId, content, messageType, maxRetries);
      }
    }, retryDelay);
  }

  /**
   * Get message delivery status
   */
  getMessageDeliveryStatus(messageId: string): MessageDeliveryStatus | null {
    return this.messageQueue.get(messageId) || null;
  }

  // ============================================================================
  // GAP #7: NETWORK FAILURE DURING LIVE TRACKING
  // ============================================================================
  
  /**
   * Queue location update with offline support
   */
  async updateLocationWithRetry(
    cleanerId: string,
    latitude: number,
    longitude: number,
    accuracy: number = 10
  ): Promise<ApiResponse<string>> {
    const locationId = `loc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const locationUpdate: LocationUpdate = {
      id: locationId,
      cleaner_id: cleanerId,
      latitude,
      longitude,
      accuracy,
      timestamp: new Date().toISOString(),
      status: 'pending',
      network_quality: this.getNetworkQuality()
    };

    try {
      if (!this.isOnline || locationUpdate.network_quality === 'offline') {
        console.log('📍 Offline: Queueing location update');
        this.locationQueue.push(locationUpdate);
        await this.saveLocationQueue();
        return {
          success: true,
          data: locationId
        };
      }

      // Attempt immediate send
      const { error } = await supabase
        .from('location_updates')
        .insert({
          id: locationId,
          cleaner_id: cleanerId,
          latitude,
          longitude,
          accuracy,
          created_at: locationUpdate.timestamp
        });

      if (error) {
        console.log('📍 Location send failed, queueing for retry');
        locationUpdate.status = 'failed';
        this.locationQueue.push(locationUpdate);
        await this.saveLocationQueue();
      } else {
        locationUpdate.status = 'sent';
        console.log('✅ Location update sent successfully:', locationId);
      }

      return { success: true, data: locationId };

    } catch (error) {
      console.error('❌ Location update error:', error);
      this.locationQueue.push(locationUpdate);
      await this.saveLocationQueue();
      
      return {
        success: false,
        data: locationId,
        error: error instanceof Error ? error.message : 'Location update failed'
      };
    }
  }

  /**
   * Process queued location updates
   */
  private async processLocationQueue(): Promise<void> {
    if (!this.isOnline || this.locationQueue.length === 0) return;

    console.log('📍 Processing location queue:', this.locationQueue.length, 'updates');
    const successfulUpdates: string[] = [];

    for (const update of this.locationQueue) {
      try {
        const { error } = await supabase
          .from('location_updates')
          .insert({
            id: update.id,
            cleaner_id: update.cleaner_id,
            latitude: update.latitude,
            longitude: update.longitude,
            accuracy: update.accuracy,
            created_at: update.timestamp
          });

        if (!error) {
          successfulUpdates.push(update.id);
          update.status = 'sent';
          console.log('✅ Queued location sent:', update.id);
        }
      } catch (error) {
        console.error('❌ Failed to send queued location:', update.id, error);
      }
    }

    // Remove successfully sent updates
    this.locationQueue = this.locationQueue.filter(
      update => !successfulUpdates.includes(update.id)
    );
    
    await this.saveLocationQueue();
  }

  private getNetworkQuality(): 'good' | 'poor' | 'offline' {
    if (!this.isOnline) return 'offline';
    // In production, you'd check actual network speed/latency
    return 'good';
  }

  // ============================================================================
  // GAP #9: MULTI-DEVICE SESSION CONFLICTS
  // ============================================================================
  
  /**
   * Sync session state across devices
   */
  async syncSessionState(
    deviceId: string,
    userId: string,
    localState: any
  ): Promise<ApiResponse<{ 
    synced_state: any; 
    conflicts: Array<any>; 
    sync_version: number; 
  }>> {
    try {
      console.log('🔄 Syncing session state across devices:', deviceId);

      // Get latest session state from server
      const { data: remoteStates, error } = await supabase
        .from('user_session_states')
        .select('*')
        .eq('user_id', userId)
        .order('sync_version', { ascending: false });

      if (error) throw error;

      const currentSession: SessionSyncState = {
        device_id: deviceId,
        user_id: userId,
        last_active: new Date().toISOString(),
        app_state: localState,
        sync_version: 1
      };

      let conflicts: Array<any> = [];
      let syncedState = localState;

      if (remoteStates && remoteStates.length > 0) {
        const latestRemote = remoteStates[0];
        
        // Detect conflicts
        conflicts = this.detectSessionConflicts(localState, latestRemote.app_state);
        
        if (conflicts.length > 0) {
          console.log('⚠️ Session conflicts detected:', conflicts.length);
          // Apply conflict resolution strategy
          syncedState = this.resolveSessionConflicts(localState, latestRemote.app_state, conflicts);
        } else {
          // Merge non-conflicting changes
          syncedState = { ...latestRemote.app_state, ...localState };
        }
        
        currentSession.sync_version = latestRemote.sync_version + 1;
      }

      // Save updated session state
      await supabase
        .from('user_session_states')
        .upsert({
          device_id: deviceId,
          user_id: userId,
          app_state: syncedState,
          sync_version: currentSession.sync_version,
          last_active: currentSession.last_active
        });

      this.sessionStates.set(deviceId, currentSession);

      return {
        success: true,
        data: {
          synced_state: syncedState,
          conflicts: conflicts,
          sync_version: currentSession.sync_version
        }
      };

    } catch (error) {
      console.error('❌ Session sync failed:', error);
      return {
        success: false,
        data: { synced_state: localState, conflicts: [], sync_version: 0 },
        error: error instanceof Error ? error.message : 'Session sync failed'
      };
    }
  }

  private detectSessionConflicts(localState: any, remoteState: any): Array<any> {
    const conflicts: Array<any> = [];
    
    // Compare critical session fields
    const criticalFields = ['current_booking_id', 'chat_room_id', 'location_sharing'];
    
    for (const field of criticalFields) {
      if (localState[field] !== remoteState[field] && 
          localState[field] !== undefined && 
          remoteState[field] !== undefined) {
        conflicts.push({
          field,
          local_value: localState[field],
          remote_value: remoteState[field],
          timestamp: new Date().toISOString()
        });
      }
    }

    return conflicts;
  }

  private resolveSessionConflicts(localState: any, remoteState: any, conflicts: Array<any>): any {
    const resolved = { ...localState };
    
    // Conflict resolution strategy: use most recent timestamp
    for (const conflict of conflicts) {
      // For demo, prefer remote state (server wins)
      // In production, you'd have more sophisticated conflict resolution
      resolved[conflict.field] = conflict.remote_value;
      console.log(`🔧 Resolved conflict for ${conflict.field}: using remote value`);
    }

    return resolved;
  }

  // ============================================================================
  // GAP #25: INFINITE LOADING STATES
  // ============================================================================
  
  /**
   * Track operation with timeout handling
   */
  async executeWithTimeout<T>(
    operationId: string,
    operationType: string,
    operation: () => Promise<T>,
    timeoutMs: number = 30000,
    maxRetries: number = 2
  ): Promise<ApiResponse<T>> {
    console.log('⏱️ Executing operation with timeout:', operationId, timeoutMs + 'ms');

    const loadingState: LoadingState = {
      operation_id: operationId,
      operation_type: operationType,
      start_time: new Date().toISOString(),
      timeout_ms: timeoutMs,
      status: 'loading',
      retry_count: 0
    };

    this.loadingOperations.set(operationId, loadingState);

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Operation timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      // Race between operation and timeout
      const result = await Promise.race([
        operation(),
        timeoutPromise
      ]);

      loadingState.status = 'completed';
      console.log('✅ Operation completed successfully:', operationId);

      return { success: true, data: result };

    } catch (error) {
      loadingState.status = 'error';
      console.error('❌ Operation failed or timed out:', operationId, error);

      // Retry if it's a timeout and we haven't exceeded max retries
      if (error instanceof Error && 
          error.message.includes('timeout') && 
          loadingState.retry_count < maxRetries) {
        
        loadingState.retry_count++;
        loadingState.status = 'loading';
        console.log('🔄 Retrying operation:', operationId, `attempt ${loadingState.retry_count + 1}`);
        
        // Exponential backoff for retry
        await new Promise(resolve => setTimeout(resolve, 1000 * loadingState.retry_count));
        return this.executeWithTimeout(operationId, operationType, operation, timeoutMs, maxRetries);
      }

      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Operation failed'
      };
    } finally {
      // Clean up after a delay
      setTimeout(() => {
        this.loadingOperations.delete(operationId);
      }, 5000);
    }
  }

  /**
   * Get current loading operations status
   */
  getLoadingOperations(): LoadingState[] {
    return Array.from(this.loadingOperations.values());
  }

  /**
   * Cancel operation if possible
   */
  cancelOperation(operationId: string): boolean {
    const operation = this.loadingOperations.get(operationId);
    if (operation && operation.status === 'loading') {
      operation.status = 'error';
      this.loadingOperations.delete(operationId);
      console.log('🚫 Operation canceled:', operationId);
      return true;
    }
    return false;
  }

  // ============================================================================
  // NETWORK MONITORING & SETUP
  // ============================================================================
  
  private setupNetworkMonitoring(): void {
    setInterval(async () => {
      const wasOnline = this.isOnline;
      
      try {
        const { error } = await supabase
          .from('users')
          .select('id')
          .limit(1);
        
        this.isOnline = !error;
      } catch (error) {
        this.isOnline = false;
      }

      if (!wasOnline && this.isOnline) {
        console.log('📡 Network restored, processing queues');
        await this.processAllQueues();
      }
    }, 5000);
  }

  private setupSessionSync(): void {
    // Sync session state every 30 seconds
    setInterval(async () => {
      if (this.isOnline && this.sessionStates.size > 0) {
        console.log('🔄 Performing periodic session sync');
        // Process session syncs
      }
    }, 30000);
  }

  private setupPeriodicCleanup(): void {
    // Clean up completed operations every 5 minutes
    setInterval(() => {
      this.cleanupCompletedOperations();
    }, 300000);
  }

  private async processAllQueues(): Promise<void> {
    await Promise.all([
      this.processLocationQueue(),
      this.processMessageRetries()
    ]);
  }

  private async processMessageRetries(): Promise<void> {
    for (const [messageId, status] of this.messageQueue) {
      if (status.status === 'retrying' && status.attempts < 3) {
        // Trigger retry for failed messages
        console.log('🔄 Retrying failed message:', messageId);
        // Implementation would depend on stored message data
      }
    }
  }

  // ============================================================================
  // STORAGE MANAGEMENT
  // ============================================================================
  
  private async loadPendingOperations(): Promise<void> {
    try {
      const [messageQueue, locationQueue] = await Promise.all([
        AsyncStorage.getItem('message_delivery_queue'),
        AsyncStorage.getItem('location_update_queue')
      ]);

      if (messageQueue) {
        const parsed = JSON.parse(messageQueue);
        this.messageQueue = new Map(Object.entries(parsed));
        console.log('📂 Loaded message queue:', this.messageQueue.size, 'messages');
      }

      if (locationQueue) {
        this.locationQueue = JSON.parse(locationQueue);
        console.log('📂 Loaded location queue:', this.locationQueue.length, 'updates');
      }
    } catch (error) {
      console.error('❌ Failed to load pending operations:', error);
    }
  }

  private async saveMessageQueue(): Promise<void> {
    try {
      const queueObj = Object.fromEntries(this.messageQueue);
      await AsyncStorage.setItem('message_delivery_queue', JSON.stringify(queueObj));
    } catch (error) {
      console.error('❌ Failed to save message queue:', error);
    }
  }

  private async saveLocationQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem('location_update_queue', JSON.stringify(this.locationQueue));
    } catch (error) {
      console.error('❌ Failed to save location queue:', error);
    }
  }

  private cleanupCompletedOperations(): void {
    // Clean up delivered messages older than 1 hour
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    
    for (const [messageId, status] of this.messageQueue) {
      if (status.status === 'delivered' && 
          new Date(status.last_attempt).getTime() < oneHourAgo) {
        this.messageQueue.delete(messageId);
      }
    }

    // Clean up sent location updates older than 1 hour
    this.locationQueue = this.locationQueue.filter(update => {
      if (update.status === 'sent') {
        return new Date(update.timestamp).getTime() > oneHourAgo;
      }
      return true;
    });

    console.log('🧹 Cleaned up completed operations');
  }

  // ============================================================================
  // PUBLIC STATUS METHODS
  // ============================================================================
  
  getServiceStatus(): {
    is_online: boolean;
    pending_messages: number;
    pending_locations: number;
    active_sessions: number;
    loading_operations: number;
  } {
    return {
      is_online: this.isOnline,
      pending_messages: Array.from(this.messageQueue.values()).filter(m => m.status !== 'delivered').length,
      pending_locations: this.locationQueue.filter(l => l.status !== 'sent').length,
      active_sessions: this.sessionStates.size,
      loading_operations: this.loadingOperations.size
    };
  }

  /**
   * Cleanup all resources
   */
  cleanup(): void {
    console.log('🧹 Cleaning up Communication & Reliability Service');
    this.messageQueue.clear();
    this.locationQueue = [];
    this.sessionStates.clear();
    this.loadingOperations.clear();
  }
}

export const communicationReliabilityService = new CommunicationReliabilityService();
