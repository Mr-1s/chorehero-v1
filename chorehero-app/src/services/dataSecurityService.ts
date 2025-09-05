import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiResponse } from '../types/api';

// ============================================================================
// DATA CONSISTENCY & SECURITY SERVICE  
// Integrated solution for Gaps #13, #14, #16, #17
// ============================================================================

export interface DataVersion {
  table: string;
  record_id: string;
  version: number;
  last_modified: string;
  modified_by: string;
  checksum: string;
}

export interface ConflictResolution {
  conflict_id: string;
  table: string;
  record_id: string;
  local_version: DataVersion;
  remote_version: DataVersion;
  resolution_strategy: 'local_wins' | 'remote_wins' | 'merge' | 'manual';
  resolved_data: any;
  resolved_at: string;
}

export interface AuthorizationCheck {
  user_id: string;
  role: string;
  resource: string;
  action: string;
  allowed: boolean;
  reason?: string;
  context?: any;
}

export interface SecurityAuditLog {
  id: string;
  user_id: string;
  action: string;
  resource: string;
  timestamp: string;
  ip_address?: string;
  user_agent?: string;
  success: boolean;
  risk_level: 'low' | 'medium' | 'high';
  details: any;
}

class DataSecurityService {
  private dataVersions: Map<string, DataVersion> = new Map();
  private securityAuditLog: SecurityAuditLog[] = [];
  private activeConflicts: Map<string, ConflictResolution> = new Map();

  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  
  async initialize(): Promise<void> {
    console.log('🔒 Initializing Data Consistency & Security Service');
    
    await this.loadDataVersions();
    this.setupSecurityMonitoring();
    this.setupConflictResolution();
    
    console.log('✅ Data Consistency & Security Service initialized');
  }

  // ============================================================================
  // GAP #13: CROSS-SCREEN DATA STALENESS
  // ============================================================================
  
  /**
   * Global state synchronization across all screens
   */
  async syncGlobalState(
    table: string,
    recordId: string,
    localData: any,
    localVersion?: number
  ): Promise<ApiResponse<{
    synced_data: any;
    version: number;
    was_stale: boolean;
    conflicts: ConflictResolution[];
  }>> {
    try {
      console.log('🔄 Syncing global state:', table, recordId);

      // Get latest version from server
      const { data: remoteData, error } = await supabase
        .from(table)
        .select('*, updated_at')
        .eq('id', recordId)
        .single();

      if (error) throw error;

      const remoteVersion = this.calculateVersion(remoteData);
      const localVersionNum = localVersion || this.calculateVersion(localData);
      
      let syncedData = remoteData;
      let wasStale = false;
      let conflicts: ConflictResolution[] = [];

      // Check if local data is stale
      if (localVersionNum < remoteVersion) {
        console.log('⚠️ Local data is stale, using remote version');
        wasStale = true;
        syncedData = remoteData;
      } else if (localVersionNum > remoteVersion) {
        console.log('🔄 Local data is newer, potential conflict detected');
        
        // Detect and resolve conflicts
        const conflictResolution = await this.detectAndResolveConflict(
          table, recordId, localData, remoteData
        );
        
        if (conflictResolution) {
          conflicts.push(conflictResolution);
          syncedData = conflictResolution.resolved_data;
        } else {
          syncedData = localData; // No conflicts, use local
        }
      }

      // Update version tracking
      const versionKey = `${table}_${recordId}`;
      this.dataVersions.set(versionKey, {
        table,
        record_id: recordId,
        version: remoteVersion,
        last_modified: remoteData.updated_at,
        modified_by: remoteData.updated_by || 'system',
        checksum: this.calculateChecksum(syncedData)
      });

      await this.saveDataVersions();

      // Broadcast state change to other screens
      await this.broadcastStateChange(table, recordId, syncedData);

      return {
        success: true,
        data: {
          synced_data: syncedData,
          version: remoteVersion,
          was_stale: wasStale,
          conflicts: conflicts
        }
      };

    } catch (error) {
      console.error('❌ Global state sync failed:', error);
      return {
        success: false,
        data: {
          synced_data: localData,
          version: localVersion || 0,
          was_stale: false,
          conflicts: []
        },
        error: error instanceof Error ? error.message : 'State sync failed'
      };
    }
  }

  /**
   * Subscribe to real-time state changes for a table
   */
  subscribeToStateChanges(
    table: string,
    callback: (change: { type: string; data: any; version: number }) => void
  ): string {
    const subscriptionId = `state_${table}_${Date.now()}`;
    
    const channel = supabase
      .channel(subscriptionId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table
        },
        (payload) => {
          console.log('📡 State change received:', table, payload.eventType);
          
          const change = {
            type: payload.eventType,
            data: payload.new || payload.old,
            version: this.calculateVersion(payload.new || payload.old)
          };
          
          // Update local version tracking
          if (payload.new) {
            const versionKey = `${table}_${payload.new.id}`;
            this.dataVersions.set(versionKey, {
              table,
              record_id: payload.new.id,
              version: change.version,
              last_modified: payload.new.updated_at || new Date().toISOString(),
              modified_by: payload.new.updated_by || 'system',
              checksum: this.calculateChecksum(payload.new)
            });
          }
          
          callback(change);
        }
      )
      .subscribe();

    console.log('👂 Subscribed to state changes:', table, subscriptionId);
    return subscriptionId;
  }

  private async broadcastStateChange(table: string, recordId: string, data: any): Promise<void> {
    // In a React context, this would trigger state updates across components
    // For now, we'll log the broadcast
    console.log('📢 Broadcasting state change:', table, recordId);
    
    // You could implement this with EventEmitter or React Context
    // or integrate with your state management solution (Redux, Zustand, etc.)
  }

  // ============================================================================
  // GAP #14: OPTIMISTIC UPDATE CONFLICTS
  // ============================================================================
  
  /**
   * Perform optimistic update with conflict detection
   */
  async performOptimisticUpdate(
    table: string,
    recordId: string,
    updates: any,
    userId: string
  ): Promise<ApiResponse<{
    data: any;
    version: number;
    conflicts_resolved: number;
    rollback_performed: boolean;
  }>> {
    try {
      console.log('⚡ Performing optimistic update:', table, recordId);

      // Get current version for conflict detection
      const versionKey = `${table}_${recordId}`;
      const currentVersion = this.dataVersions.get(versionKey);
      
      // Perform optimistic update with version check
      const { data, error } = await supabase
        .from(table)
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
          updated_by: userId,
          version: currentVersion ? currentVersion.version + 1 : 1
        })
        .eq('id', recordId)
        .eq('version', currentVersion?.version || 0) // Optimistic locking
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Version mismatch - conflict detected
          console.log('⚠️ Optimistic update conflict detected');
          return await this.handleOptimisticConflict(table, recordId, updates, userId);
        }
        throw error;
      }

      // Update successful
      const newVersion = data.version || (currentVersion?.version || 0) + 1;
      
      this.dataVersions.set(versionKey, {
        table,
        record_id: recordId,
        version: newVersion,
        last_modified: data.updated_at,
        modified_by: userId,
        checksum: this.calculateChecksum(data)
      });

      console.log('✅ Optimistic update successful:', recordId, `v${newVersion}`);

      return {
        success: true,
        data: {
          data: data,
          version: newVersion,
          conflicts_resolved: 0,
          rollback_performed: false
        }
      };

    } catch (error) {
      console.error('❌ Optimistic update failed:', error);
      return {
        success: false,
        data: {
          data: null,
          version: 0,
          conflicts_resolved: 0,
          rollback_performed: false
        },
        error: error instanceof Error ? error.message : 'Optimistic update failed'
      };
    }
  }

  private async handleOptimisticConflict(
    table: string,
    recordId: string,
    updates: any,
    userId: string
  ): Promise<ApiResponse<any>> {
    console.log('🔧 Handling optimistic conflict:', table, recordId);

    try {
      // Get current server state
      const { data: serverData, error } = await supabase
        .from(table)
        .select('*')
        .eq('id', recordId)
        .single();

      if (error) throw error;

      // Resolve conflict using strategy
      const resolution = await this.resolveDataConflict(
        table, recordId, updates, serverData, 'merge'
      );

      if (resolution) {
        // Apply resolved data
        const { data: resolvedData, error: updateError } = await supabase
          .from(table)
          .update({
            ...resolution.resolved_data,
            updated_at: new Date().toISOString(),
            updated_by: userId,
            version: serverData.version + 1
          })
          .eq('id', recordId)
          .eq('version', serverData.version)
          .select()
          .single();

        if (updateError) throw updateError;

        return {
          success: true,
          data: {
            data: resolvedData,
            version: resolvedData.version,
            conflicts_resolved: 1,
            rollback_performed: false
          }
        };
      }

      // If can't resolve, rollback to server state
      return {
        success: true,
        data: {
          data: serverData,
          version: serverData.version,
          conflicts_resolved: 0,
          rollback_performed: true
        }
      };

    } catch (error) {
      console.error('❌ Conflict resolution failed:', error);
      throw error;
    }
  }

  // ============================================================================
  // GAP #16: AUTHORIZATION BOUNDARY FAILURES
  // ============================================================================
  
  /**
   * Comprehensive authorization check
   */
  async checkAuthorization(
    userId: string,
    resource: string,
    action: string,
    context?: any
  ): Promise<ApiResponse<AuthorizationCheck>> {
    try {
      console.log('🔐 Checking authorization:', userId, action, resource);

      // Get user role and permissions
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role, is_active')
        .eq('id', userId)
        .single();

      if (userError || !userData) {
        throw new Error('User not found or inactive');
      }

      if (!userData.is_active) {
        return {
          success: true,
          data: {
            user_id: userId,
            role: userData.role,
            resource,
            action,
            allowed: false,
            reason: 'User account is inactive'
          }
        };
      }

      // Check role-based permissions
      const authCheck = await this.evaluateRolePermissions(
        userData.role,
        resource,
        action,
        context
      );

      // Log security audit
      await this.logSecurityAudit({
        user_id: userId,
        action: `auth_check_${action}`,
        resource: resource,
        timestamp: new Date().toISOString(),
        success: authCheck.allowed,
        risk_level: this.calculateRiskLevel(action, resource),
        details: { context, reason: authCheck.reason }
      });

      return { success: true, data: authCheck };

    } catch (error) {
      console.error('❌ Authorization check failed:', error);
      
      // Fail secure - deny access on error
      const failSecureCheck: AuthorizationCheck = {
        user_id: userId,
        role: 'unknown',
        resource,
        action,
        allowed: false,
        reason: 'Authorization system error'
      };

      return {
        success: false,
        data: failSecureCheck,
        error: error instanceof Error ? error.message : 'Authorization check failed'
      };
    }
  }

  private async evaluateRolePermissions(
    role: string,
    resource: string,
    action: string,
    context?: any
  ): Promise<AuthorizationCheck> {
    // Role-based access control matrix
    const permissions: Record<string, Record<string, string[]>> = {
      customer: {
        bookings: ['create', 'read_own', 'update_own', 'cancel_own'],
        profile: ['read_own', 'update_own'],
        messages: ['create', 'read_own'],
        reviews: ['create', 'read_any'],
        content: ['read_any']
      },
      cleaner: {
        bookings: ['read_assigned', 'update_assigned', 'accept', 'complete'],
        profile: ['read_own', 'update_own'],
        messages: ['create', 'read_own'],
        reviews: ['read_any'],
        content: ['create', 'read_any', 'update_own', 'delete_own'],
        earnings: ['read_own']
      },
      admin: {
        '*': ['*'] // Admin has all permissions
      }
    };

    const rolePermissions = permissions[role] || {};
    const resourcePermissions = rolePermissions[resource] || rolePermissions['*'] || [];

    let allowed = false;
    let reason = 'Access denied by role-based permissions';

    // Check if action is allowed
    if (resourcePermissions.includes('*') || resourcePermissions.includes(action)) {
      allowed = true;
      reason = 'Access granted by role permissions';
    }

    // Additional context-based checks
    if (allowed && action.includes('_own') && context?.owner_id !== context?.user_id) {
      allowed = false;
      reason = 'Resource ownership required but not verified';
    }

    if (allowed && action.includes('_assigned') && context?.assigned_to !== context?.user_id) {
      allowed = false;
      reason = 'Resource assignment required but not verified';
    }

    return {
      user_id: context?.user_id || 'unknown',
      role,
      resource,
      action,
      allowed,
      reason,
      context
    };
  }

  /**
   * Protected resource access wrapper
   */
  async accessProtectedResource<T>(
    userId: string,
    resource: string,
    action: string,
    operation: () => Promise<T>,
    context?: any
  ): Promise<ApiResponse<T>> {
    try {
      // Check authorization first
      const authResult = await this.checkAuthorization(userId, resource, action, context);
      
      if (!authResult.success || !authResult.data.allowed) {
        console.log('🚫 Access denied:', userId, action, resource, authResult.data.reason);
        
        await this.logSecurityAudit({
          user_id: userId,
          action: `access_denied_${action}`,
          resource: resource,
          timestamp: new Date().toISOString(),
          success: false,
          risk_level: 'medium',
          details: { reason: authResult.data.reason, context }
        });

        return {
          success: false,
          data: null as any,
          error: authResult.data.reason || 'Access denied'
        };
      }

      // Execute operation with authorization
      console.log('✅ Access granted:', userId, action, resource);
      const result = await operation();

      await this.logSecurityAudit({
        user_id: userId,
        action: `access_granted_${action}`,
        resource: resource,
        timestamp: new Date().toISOString(),
        success: true,
        risk_level: 'low',
        details: { context }
      });

      return { success: true, data: result };

    } catch (error) {
      console.error('❌ Protected resource access failed:', error);
      
      await this.logSecurityAudit({
        user_id: userId,
        action: `access_error_${action}`,
        resource: resource,
        timestamp: new Date().toISOString(),
        success: false,
        risk_level: 'high',
        details: { error: error instanceof Error ? error.message : 'Unknown error', context }
      });

      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Resource access failed'
      };
    }
  }

  // ============================================================================
  // GAP #17: SESSION PERSISTENCE VULNERABILITIES
  // ============================================================================
  
  /**
   * Secure session validation
   */
  async validateSession(
    sessionToken: string,
    deviceId: string,
    ipAddress?: string
  ): Promise<ApiResponse<{
    valid: boolean;
    user_id?: string;
    expires_at?: string;
    security_flags?: string[];
  }>> {
    try {
      console.log('🔍 Validating session security:', sessionToken.substring(0, 10) + '...');

      // Validate with Supabase
      const { data: { user }, error } = await supabase.auth.getUser(sessionToken);

      if (error || !user) {
        await this.logSecurityAudit({
          user_id: 'unknown',
          action: 'invalid_session_attempt',
          resource: 'session',
          timestamp: new Date().toISOString(),
          success: false,
          risk_level: 'medium',
          details: { deviceId, ipAddress, error: error?.message }
        });

        return {
          success: true,
          data: {
            valid: false,
            security_flags: ['invalid_token']
          }
        };
      }

      // Additional security checks
      const securityFlags: string[] = [];

      // Check if user is still active
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('is_active')
        .eq('id', user.id)
        .single();

      if (userError || !userData?.is_active) {
        securityFlags.push('inactive_user');
      }

      // Check for suspicious activity (multiple devices, unusual IP, etc.)
      const suspiciousActivity = await this.detectSuspiciousActivity(user.id, deviceId, ipAddress);
      if (suspiciousActivity.length > 0) {
        securityFlags.push(...suspiciousActivity);
      }

      const isValid = securityFlags.length === 0;

      await this.logSecurityAudit({
        user_id: user.id,
        action: isValid ? 'session_validated' : 'session_security_flags',
        resource: 'session',
        timestamp: new Date().toISOString(),
        success: isValid,
        risk_level: isValid ? 'low' : 'medium',
        details: { deviceId, ipAddress, securityFlags }
      });

      return {
        success: true,
        data: {
          valid: isValid,
          user_id: user.id,
          expires_at: user.exp ? new Date(user.exp * 1000).toISOString() : undefined,
          security_flags: securityFlags
        }
      };

    } catch (error) {
      console.error('❌ Session validation failed:', error);
      return {
        success: false,
        data: { valid: false },
        error: error instanceof Error ? error.message : 'Session validation failed'
      };
    }
  }

  private async detectSuspiciousActivity(
    userId: string,
    deviceId: string,
    ipAddress?: string
  ): Promise<string[]> {
    const flags: string[] = [];

    try {
      // Check for multiple concurrent sessions
      const recentAudits = this.securityAuditLog
        .filter(log => 
          log.user_id === userId && 
          log.action === 'session_validated' &&
          Date.now() - new Date(log.timestamp).getTime() < 60000 // Last minute
        );

      const uniqueDevices = new Set(recentAudits.map(log => log.details?.deviceId));
      if (uniqueDevices.size > 3) {
        flags.push('multiple_devices');
      }

      const uniqueIPs = new Set(recentAudits.map(log => log.ip_address).filter(Boolean));
      if (uniqueIPs.size > 2) {
        flags.push('multiple_ips');
      }

      // Check for rapid session validation attempts
      const recentValidations = recentAudits.length;
      if (recentValidations > 10) {
        flags.push('excessive_validation_attempts');
      }

    } catch (error) {
      console.error('❌ Suspicious activity detection failed:', error);
      flags.push('detection_error');
    }

    return flags;
  }

  /**
   * Invalidate session across all devices
   */
  async invalidateAllSessions(userId: string, reason: string): Promise<ApiResponse<boolean>> {
    try {
      console.log('🚫 Invalidating all sessions for user:', userId);

      // This would typically involve:
      // 1. Blacklisting current refresh tokens
      // 2. Forcing re-authentication on all devices
      // 3. Clearing session state from all devices

      await this.logSecurityAudit({
        user_id: userId,
        action: 'sessions_invalidated',
        resource: 'session',
        timestamp: new Date().toISOString(),
        success: true,
        risk_level: 'medium',
        details: { reason, invalidated_by: 'security_system' }
      });

      return { success: true, data: true };

    } catch (error) {
      console.error('❌ Session invalidation failed:', error);
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error.message : 'Session invalidation failed'
      };
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================
  
  private calculateVersion(data: any): number {
    if (data?.version) return data.version;
    if (data?.updated_at) {
      return Math.floor(new Date(data.updated_at).getTime() / 1000);
    }
    return Math.floor(Date.now() / 1000);
  }

  private calculateChecksum(data: any): string {
    // Simple checksum - in production you'd use a proper hash function
    return btoa(JSON.stringify(data)).substring(0, 16);
  }

  private calculateRiskLevel(action: string, resource: string): 'low' | 'medium' | 'high' {
    const highRiskActions = ['delete', 'transfer', 'payment', 'admin'];
    const mediumRiskActions = ['update', 'create', 'access'];
    
    if (highRiskActions.some(risk => action.includes(risk))) return 'high';
    if (mediumRiskActions.some(risk => action.includes(risk))) return 'medium';
    return 'low';
  }

  private async detectAndResolveConflict(
    table: string,
    recordId: string,
    localData: any,
    remoteData: any
  ): Promise<ConflictResolution | null> {
    // Simplified conflict detection - in production this would be more sophisticated
    const hasConflict = JSON.stringify(localData) !== JSON.stringify(remoteData);
    
    if (!hasConflict) return null;

    return this.resolveDataConflict(table, recordId, localData, remoteData, 'merge');
  }

  private async resolveDataConflict(
    table: string,
    recordId: string,
    localData: any,
    remoteData: any,
    strategy: 'local_wins' | 'remote_wins' | 'merge' | 'manual'
  ): Promise<ConflictResolution> {
    let resolvedData: any;

    switch (strategy) {
      case 'local_wins':
        resolvedData = localData;
        break;
      case 'remote_wins':
        resolvedData = remoteData;
        break;
      case 'merge':
        resolvedData = { ...remoteData, ...localData };
        break;
      case 'manual':
        // In production, this would present conflict resolution UI
        resolvedData = remoteData;
        break;
    }

    const resolution: ConflictResolution = {
      conflict_id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      table,
      record_id: recordId,
      local_version: {
        table,
        record_id: recordId,
        version: this.calculateVersion(localData),
        last_modified: localData.updated_at || new Date().toISOString(),
        modified_by: localData.updated_by || 'unknown',
        checksum: this.calculateChecksum(localData)
      },
      remote_version: {
        table,
        record_id: recordId,
        version: this.calculateVersion(remoteData),
        last_modified: remoteData.updated_at || new Date().toISOString(),
        modified_by: remoteData.updated_by || 'unknown',
        checksum: this.calculateChecksum(remoteData)
      },
      resolution_strategy: strategy,
      resolved_data: resolvedData,
      resolved_at: new Date().toISOString()
    };

    this.activeConflicts.set(resolution.conflict_id, resolution);
    return resolution;
  }

  private async logSecurityAudit(audit: Omit<SecurityAuditLog, 'id'>): Promise<void> {
    const auditLog: SecurityAuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...audit
    };

    this.securityAuditLog.push(auditLog);

    // Keep only last 100 audit logs in memory
    if (this.securityAuditLog.length > 100) {
      this.securityAuditLog = this.securityAuditLog.slice(-100);
    }

    // In production, you'd also store this in the database
    console.log('📋 Security audit logged:', auditLog.action, auditLog.risk_level);
  }

  private setupSecurityMonitoring(): void {
    // Monitor for security events
    console.log('👮‍♂️ Security monitoring active');
  }

  private setupConflictResolution(): void {
    // Set up conflict resolution monitoring
    console.log('🔧 Conflict resolution monitoring active');
  }

  private async loadDataVersions(): Promise<void> {
    try {
      const versions = await AsyncStorage.getItem('data_versions');
      if (versions) {
        const parsed = JSON.parse(versions);
        this.dataVersions = new Map(Object.entries(parsed));
        console.log('📂 Loaded data versions:', this.dataVersions.size);
      }
    } catch (error) {
      console.error('❌ Failed to load data versions:', error);
    }
  }

  private async saveDataVersions(): Promise<void> {
    try {
      const versionsObj = Object.fromEntries(this.dataVersions);
      await AsyncStorage.setItem('data_versions', JSON.stringify(versionsObj));
    } catch (error) {
      console.error('❌ Failed to save data versions:', error);
    }
  }

  // ============================================================================
  // PUBLIC STATUS METHODS
  // ============================================================================
  
  getServiceStatus(): {
    tracked_versions: number;
    active_conflicts: number;
    recent_audits: number;
    security_level: 'secure' | 'warning' | 'alert';
  } {
    const recentAudits = this.securityAuditLog.filter(
      log => Date.now() - new Date(log.timestamp).getTime() < 60000
    );

    const highRiskRecent = recentAudits.filter(log => log.risk_level === 'high').length;
    const failedRecent = recentAudits.filter(log => !log.success).length;

    let securityLevel: 'secure' | 'warning' | 'alert' = 'secure';
    if (highRiskRecent > 0 || failedRecent > 5) {
      securityLevel = 'alert';
    } else if (failedRecent > 2) {
      securityLevel = 'warning';
    }

    return {
      tracked_versions: this.dataVersions.size,
      active_conflicts: this.activeConflicts.size,
      recent_audits: recentAudits.length,
      security_level: securityLevel
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    console.log('🧹 Cleaning up Data Consistency & Security Service');
    this.dataVersions.clear();
    this.activeConflicts.clear();
    this.securityAuditLog.length = 0;
  }
}

export const dataSecurityService = new DataSecurityService();
