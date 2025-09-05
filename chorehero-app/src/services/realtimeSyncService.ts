import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiResponse } from '../types/api';

// ============================================================================
// REAL-TIME SYNCHRONIZATION SERVICE
// Handles offline/online data sync and real-time updates
// ============================================================================

export interface SyncQueueItem {
  id: string;
  operation: 'insert' | 'update' | 'delete';
  table: string;
  data: any;
  timestamp: number;
  attempts: number;
  max_attempts: number;
}

export interface SyncStatus {
  is_online: boolean;
  last_sync: string;
  pending_operations: number;
  failed_operations: number;
  sync_in_progress: boolean;
}

type SubscriptionCallback = (payload: any) => void;

class RealtimeSyncService {
  private syncQueue: SyncQueueItem[] = [];
  private isOnline: boolean = true;
  private syncInProgress: boolean = false;
  private subscriptions: Map<string, any> = new Map();
  private callbacks: Map<string, Set<SubscriptionCallback>> = new Map();
  
  // ============================================================================
  // INITIALIZATION & CONNECTION MANAGEMENT
  // ============================================================================
  
  async initialize(): Promise<void> {
    console.log('🔄 Initializing real-time sync service');
    
    // Load pending operations from storage
    await this.loadSyncQueue();
    
    // Set up connection monitoring
    this.setupConnectionMonitoring();
    
    // Set up periodic sync
    this.setupPeriodicSync();
    
    console.log('✅ Real-time sync service initialized');
  }

  private setupConnectionMonitoring(): void {
    // Monitor network connectivity
    // In React Native, you'd use @react-native-community/netinfo
    // For now, we'll simulate connection monitoring
    
    setInterval(() => {
      this.checkConnectionStatus();
    }, 5000); // Check every 5 seconds
  }

  private async checkConnectionStatus(): Promise<void> {
    try {
      // Test connection with lightweight query
      const { error } = await supabase
        .from('users')
        .select('id')
        .limit(1);

      const wasOnline = this.isOnline;
      this.isOnline = !error;

      if (!wasOnline && this.isOnline) {
        console.log('📡 Connection restored, syncing pending operations');
        await this.processSyncQueue();
      } else if (wasOnline && !this.isOnline) {
        console.log('📵 Connection lost, entering offline mode');
      }

    } catch (error) {
      this.isOnline = false;
    }
  }

  // ============================================================================
  // OFFLINE OPERATION QUEUEING
  // ============================================================================
  
  /**
   * Queue operation for later sync when offline
   */
  async queueOperation(
    operation: SyncQueueItem['operation'],
    table: string,
    data: any,
    maxAttempts: number = 3
  ): Promise<string> {
    const queueItem: SyncQueueItem = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      operation,
      table,
      data,
      timestamp: Date.now(),
      attempts: 0,
      max_attempts: maxAttempts
    };

    this.syncQueue.push(queueItem);
    await this.saveSyncQueue();

    console.log('📝 Operation queued for sync:', queueItem.id, operation, table);

    // Try to sync immediately if online
    if (this.isOnline) {
      this.processSyncQueue();
    }

    return queueItem.id;
  }

  /**
   * Process all queued operations
   */
  private async processSyncQueue(): Promise<void> {
    if (this.syncInProgress || !this.isOnline || this.syncQueue.length === 0) {
      return;
    }

    this.syncInProgress = true;
    console.log('🔄 Processing sync queue:', this.syncQueue.length, 'operations');

    const processedItems: string[] = [];
    const failedItems: string[] = [];

    for (const item of this.syncQueue) {
      try {
        await this.executeQueuedOperation(item);
        processedItems.push(item.id);
        console.log('✅ Synced operation:', item.id);

      } catch (error) {
        item.attempts++;
        console.error(`❌ Sync failed (attempt ${item.attempts}/${item.max_attempts}):`, item.id, error);

        if (item.attempts >= item.max_attempts) {
          failedItems.push(item.id);
          console.error('💀 Operation permanently failed:', item.id);
        }
      }
    }

    // Remove processed and permanently failed items
    this.syncQueue = this.syncQueue.filter(
      item => !processedItems.includes(item.id) && !failedItems.includes(item.id)
    );

    await this.saveSyncQueue();
    this.syncInProgress = false;

    console.log(`✅ Sync complete: ${processedItems.length} synced, ${failedItems.length} failed`);
  }

  private async executeQueuedOperation(item: SyncQueueItem): Promise<void> {
    switch (item.operation) {
      case 'insert':
        const { error: insertError } = await supabase
          .from(item.table)
          .insert(item.data);
        if (insertError) throw insertError;
        break;

      case 'update':
        const { error: updateError } = await supabase
          .from(item.table)
          .update(item.data.updates)
          .eq('id', item.data.id);
        if (updateError) throw updateError;
        break;

      case 'delete':
        const { error: deleteError } = await supabase
          .from(item.table)
          .delete()
          .eq('id', item.data.id);
        if (deleteError) throw deleteError;
        break;

      default:
        throw new Error(`Unknown operation: ${item.operation}`);
    }
  }

  // ============================================================================
  // REAL-TIME SUBSCRIPTIONS
  // ============================================================================
  
  /**
   * Subscribe to real-time changes for a table
   */
  subscribeToTable(
    table: string,
    filter?: string,
    callback?: SubscriptionCallback
  ): string {
    const subscriptionId = `${table}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('👂 Setting up real-time subscription:', table, subscriptionId);

    const channel = supabase
      .channel(subscriptionId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          filter: filter
        },
        (payload) => {
          console.log('📡 Real-time update received:', table, payload.eventType);
          this.handleRealtimeUpdate(table, payload);
          
          if (callback) {
            callback(payload);
          }

          // Notify all registered callbacks
          const tableCallbacks = this.callbacks.get(table);
          if (tableCallbacks) {
            tableCallbacks.forEach(cb => cb(payload));
          }
        }
      )
      .subscribe();

    this.subscriptions.set(subscriptionId, channel);
    
    return subscriptionId;
  }

  /**
   * Subscribe to booking status changes
   */
  subscribeToBookingUpdates(bookingId: string, callback: SubscriptionCallback): string {
    return this.subscribeToTable(
      'bookings',
      `id=eq.${bookingId}`,
      (payload) => {
        console.log('📅 Booking update:', bookingId, payload.new?.status);
        callback(payload);
      }
    );
  }

  /**
   * Subscribe to chat messages
   */
  subscribeToChatMessages(roomId: string, callback: SubscriptionCallback): string {
    return this.subscribeToTable(
      'chat_messages',
      `room_id=eq.${roomId}`,
      (payload) => {
        console.log('💬 Chat message:', roomId, payload.eventType);
        callback(payload);
      }
    );
  }

  /**
   * Subscribe to location updates
   */
  subscribeToLocationUpdates(cleanerId: string, callback: SubscriptionCallback): string {
    return this.subscribeToTable(
      'location_updates',
      `cleaner_id=eq.${cleanerId}`,
      (payload) => {
        console.log('📍 Location update:', cleanerId);
        callback(payload);
      }
    );
  }

  private handleRealtimeUpdate(table: string, payload: any): void {
    // Update local cache based on real-time changes
    // This helps maintain data consistency across screens
    
    switch (payload.eventType) {
      case 'INSERT':
        console.log('➕ Real-time INSERT:', table, payload.new.id);
        break;
      case 'UPDATE':
        console.log('🔄 Real-time UPDATE:', table, payload.new.id);
        break;
      case 'DELETE':
        console.log('🗑️ Real-time DELETE:', table, payload.old.id);
        break;
    }
  }

  /**
   * Unsubscribe from real-time updates
   */
  unsubscribe(subscriptionId: string): void {
    const channel = this.subscriptions.get(subscriptionId);
    if (channel) {
      supabase.removeChannel(channel);
      this.subscriptions.delete(subscriptionId);
      console.log('🔇 Unsubscribed from real-time updates:', subscriptionId);
    }
  }

  // ============================================================================
  // DATA CONSISTENCY HELPERS
  // ============================================================================
  
  /**
   * Force sync specific data to ensure consistency
   */
  async forceSyncData(
    table: string,
    id: string,
    localData: any
  ): Promise<ApiResponse<any>> {
    try {
      console.log('🔄 Force syncing data:', table, id);

      // Get latest data from server
      const { data: serverData, error } = await supabase
        .from(table)
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      // Compare local vs server data
      const dataMatch = JSON.stringify(localData) === JSON.stringify(serverData);
      
      if (!dataMatch) {
        console.log('⚠️ Data mismatch detected, using server data');
        return {
          success: true,
          data: serverData,
          error: 'Data was out of sync, updated with server version'
        };
      }

      console.log('✅ Data in sync');
      return { success: true, data: serverData };

    } catch (error) {
      console.error('❌ Force sync failed:', error);
      return {
        success: false,
        data: localData, // Return local data as fallback
        error: error instanceof Error ? error.message : 'Force sync failed'
      };
    }
  }

  /**
   * Batch sync multiple items
   */
  async batchSync(
    operations: Array<{
      operation: SyncQueueItem['operation'];
      table: string;
      data: any;
    }>
  ): Promise<ApiResponse<number>> {
    try {
      console.log('📦 Batch syncing operations:', operations.length);

      if (!this.isOnline) {
        // Queue all operations for later sync
        for (const op of operations) {
          await this.queueOperation(op.operation, op.table, op.data);
        }
        return { success: true, data: operations.length };
      }

      let syncedCount = 0;
      for (const op of operations) {
        try {
          await this.executeQueuedOperation({
            id: `batch_${Date.now()}`,
            operation: op.operation,
            table: op.table,
            data: op.data,
            timestamp: Date.now(),
            attempts: 0,
            max_attempts: 1
          });
          syncedCount++;
        } catch (error) {
          console.error('❌ Batch operation failed:', op, error);
        }
      }

      console.log(`✅ Batch sync complete: ${syncedCount}/${operations.length}`);
      return { success: true, data: syncedCount };

    } catch (error) {
      return {
        success: false,
        data: 0,
        error: error instanceof Error ? error.message : 'Batch sync failed'
      };
    }
  }

  // ============================================================================
  // SYNC STATUS & MONITORING
  // ============================================================================
  
  getSyncStatus(): SyncStatus {
    return {
      is_online: this.isOnline,
      last_sync: new Date().toISOString(), // TODO: Track actual last sync
      pending_operations: this.syncQueue.length,
      failed_operations: this.syncQueue.filter(item => item.attempts >= item.max_attempts).length,
      sync_in_progress: this.syncInProgress
    };
  }

  // ============================================================================
  // STORAGE MANAGEMENT
  // ============================================================================
  
  private async saveSyncQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem('sync_queue', JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('❌ Failed to save sync queue:', error);
    }
  }

  private async loadSyncQueue(): Promise<void> {
    try {
      const queueData = await AsyncStorage.getItem('sync_queue');
      if (queueData) {
        this.syncQueue = JSON.parse(queueData);
        console.log('📂 Loaded sync queue:', this.syncQueue.length, 'operations');
      }
    } catch (error) {
      console.error('❌ Failed to load sync queue:', error);
      this.syncQueue = [];
    }
  }

  private setupPeriodicSync(): void {
    // Sync every 30 seconds when online
    setInterval(async () => {
      if (this.isOnline && this.syncQueue.length > 0) {
        await this.processSyncQueue();
      }
    }, 30000);
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================
  
  /**
   * Clean up all subscriptions and resources
   */
  cleanup(): void {
    console.log('🧹 Cleaning up real-time sync service');
    
    // Unsubscribe from all channels
    for (const [id, channel] of this.subscriptions) {
      supabase.removeChannel(channel);
    }
    
    this.subscriptions.clear();
    this.callbacks.clear();
    
    console.log('✅ Real-time sync service cleaned up');
  }
}

export const realtimeSyncService = new RealtimeSyncService();
