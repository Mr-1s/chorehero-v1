/**
 * Comprehensive Error Handling Service
 * Centralized error management for all database operations
 */

import { PostgrestError } from '@supabase/supabase-js';

// Error Types
export interface DatabaseError {
  code: string;
  message: string;
  details?: string;
  hint?: string;
  originalError?: any;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  errorCode?: string;
  retryable?: boolean;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
}

// Error Categories
export enum ErrorCategory {
  NETWORK = 'NETWORK',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  VALIDATION = 'VALIDATION',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT = 'RATE_LIMIT',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN = 'UNKNOWN'
}

// Common Supabase Error Codes
export const SUPABASE_ERROR_CODES = {
  // Authentication errors
  INVALID_CREDENTIALS: '42501',
  EXPIRED_TOKEN: '42501',
  
  // Authorization errors
  INSUFFICIENT_PRIVILEGE: '42501',
  RLS_VIOLATION: '42501',
  
  // Data errors
  NOT_NULL_VIOLATION: '23502',
  FOREIGN_KEY_VIOLATION: '23503',
  UNIQUE_VIOLATION: '23505',
  CHECK_VIOLATION: '23514',
  
  // Query errors
  NO_ROWS_FOUND: 'PGRST116',
  MULTIPLE_ROWS_FOUND: 'PGRST117',
  INVALID_RANGE: 'PGRST103',
  
  // Connection errors
  CONNECTION_FAILURE: '08000',
  CONNECTION_TIMEOUT: '08001',
  
  // Server errors
  INTERNAL_ERROR: 'XX000',
  OUT_OF_MEMORY: '53200',
  DISK_FULL: '53100'
} as const;

class ErrorHandlingService {
  private defaultRetryConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2
  };

  // ============================================================================
  // ERROR CLASSIFICATION & HANDLING
  // ============================================================================

  /**
   * Classify and handle Supabase errors
   */
  handleSupabaseError(error: any): DatabaseError {
    console.error('🚨 Supabase error occurred:', error);

    // Handle PostgrestError (most common)
    if (this.isPostgrestError(error)) {
      return this.handlePostgrestError(error);
    }

    // Handle network errors
    if (this.isNetworkError(error)) {
      return this.handleNetworkError(error);
    }

    // Handle authentication errors
    if (this.isAuthError(error)) {
      return this.handleAuthError(error);
    }

    // Handle unknown errors
    return this.handleUnknownError(error);
  }

  /**
   * Get error category for better handling
   */
  categorizeError(error: DatabaseError): ErrorCategory {
    const code = error.code;

    // Network errors
    if (['08000', '08001', 'NETWORK_ERROR'].includes(code)) {
      return ErrorCategory.NETWORK;
    }

    // Authentication errors
    if (['42501', 'INVALID_CREDENTIALS', 'EXPIRED_TOKEN'].includes(code)) {
      return ErrorCategory.AUTHENTICATION;
    }

    // Authorization errors
    if (['INSUFFICIENT_PRIVILEGE', 'RLS_VIOLATION'].includes(code)) {
      return ErrorCategory.AUTHORIZATION;
    }

    // Validation errors
    if (['23502', '23514', 'VALIDATION_ERROR'].includes(code)) {
      return ErrorCategory.VALIDATION;
    }

    // Not found errors
    if (['PGRST116', 'NOT_FOUND'].includes(code)) {
      return ErrorCategory.NOT_FOUND;
    }

    // Conflict errors
    if (['23505', '23503', 'PGRST117'].includes(code)) {
      return ErrorCategory.CONFLICT;
    }

    // Rate limit errors
    if (['429', 'RATE_LIMIT'].includes(code)) {
      return ErrorCategory.RATE_LIMIT;
    }

    // Server errors
    if (['XX000', '53200', '53100', '500'].includes(code)) {
      return ErrorCategory.SERVER_ERROR;
    }

    return ErrorCategory.UNKNOWN;
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error: DatabaseError): boolean {
    const category = this.categorizeError(error);
    
    // Retryable error categories
    const retryableCategories = [
      ErrorCategory.NETWORK,
      ErrorCategory.RATE_LIMIT,
      ErrorCategory.SERVER_ERROR
    ];

    return retryableCategories.includes(category);
  }

  /**
   * Get user-friendly error message
   */
  getUserFriendlyMessage(error: DatabaseError): string {
    const category = this.categorizeError(error);

    switch (category) {
      case ErrorCategory.NETWORK:
        return 'Network connection failed. Please check your internet connection and try again.';
      
      case ErrorCategory.AUTHENTICATION:
        return 'Authentication failed. Please log in again.';
      
      case ErrorCategory.AUTHORIZATION:
        return 'You don\'t have permission to perform this action.';
      
      case ErrorCategory.VALIDATION:
        return 'Invalid data provided. Please check your input and try again.';
      
      case ErrorCategory.NOT_FOUND:
        return 'The requested resource was not found.';
      
      case ErrorCategory.CONFLICT:
        return 'This action conflicts with existing data. Please refresh and try again.';
      
      case ErrorCategory.RATE_LIMIT:
        return 'Too many requests. Please wait a moment and try again.';
      
      case ErrorCategory.SERVER_ERROR:
        return 'Server error occurred. Please try again later.';
      
      default:
        return error.message || 'An unexpected error occurred. Please try again.';
    }
  }

  // ============================================================================
  // RETRY MECHANISM
  // ============================================================================

  /**
   * Execute operation with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    config?: Partial<RetryConfig>
  ): Promise<T> {
    const retryConfig = { ...this.defaultRetryConfig, ...config };
    let lastError: any;

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        console.log(`🔄 Executing operation (attempt ${attempt}/${retryConfig.maxAttempts})`);
        return await operation();
      } catch (error) {
        lastError = error;
        const dbError = this.handleSupabaseError(error);
        
        console.warn(`❌ Operation failed (attempt ${attempt}):`, dbError.message);

        // Don't retry if error is not retryable or if this is the last attempt
        if (!this.isRetryableError(dbError) || attempt === retryConfig.maxAttempts) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
          retryConfig.maxDelay
        );

        console.log(`⏳ Retrying in ${delay}ms...`);
        await this.delay(delay);
      }
    }

    throw lastError;
  }

  /**
   * Safe database operation wrapper
   */
  async safeExecute<T>(
    operation: () => Promise<{ data: T | null; error: PostgrestError | null }>,
    fallbackData: T,
    operationName: string = 'database operation'
  ): Promise<ApiResponse<T>> {
    try {
      console.log(`🛡️ Executing safe ${operationName}`);

      const result = await this.executeWithRetry(operation);
      
      if (result.error) {
        const dbError = this.handleSupabaseError(result.error);
        const category = this.categorizeError(dbError);
        
        // For NOT_FOUND errors, return fallback data instead of error
        if (category === ErrorCategory.NOT_FOUND) {
          console.log(`ℹ️ ${operationName} - no data found, returning fallback`);
          return {
            success: true,
            data: fallbackData
          };
        }

        return {
          success: false,
          data: fallbackData,
          error: this.getUserFriendlyMessage(dbError),
          errorCode: dbError.code,
          retryable: this.isRetryableError(dbError)
        };
      }

      return {
        success: true,
        data: result.data || fallbackData
      };

    } catch (error) {
      const dbError = this.handleSupabaseError(error);
      
      console.error(`❌ Safe ${operationName} failed:`, dbError);

      return {
        success: false,
        data: fallbackData,
        error: this.getUserFriendlyMessage(dbError),
        errorCode: dbError.code,
        retryable: this.isRetryableError(dbError)
      };
    }
  }

  // ============================================================================
  // SPECIFIC ERROR HANDLERS
  // ============================================================================

  private handlePostgrestError(error: PostgrestError): DatabaseError {
    return {
      code: error.code || 'POSTGREST_ERROR',
      message: error.message,
      details: error.details,
      hint: error.hint,
      originalError: error
    };
  }

  private handleNetworkError(error: any): DatabaseError {
    return {
      code: 'NETWORK_ERROR',
      message: 'Network connection failed',
      details: error.message || 'Unable to connect to the server',
      originalError: error
    };
  }

  private handleAuthError(error: any): DatabaseError {
    return {
      code: 'AUTH_ERROR',
      message: 'Authentication failed',
      details: error.message || 'Invalid credentials or expired session',
      originalError: error
    };
  }

  private handleUnknownError(error: any): DatabaseError {
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message || 'An unexpected error occurred',
      details: error.toString(),
      originalError: error
    };
  }

  // ============================================================================
  // ERROR TYPE DETECTION
  // ============================================================================

  private isPostgrestError(error: any): error is PostgrestError {
    return error && typeof error.code === 'string' && typeof error.message === 'string';
  }

  private isNetworkError(error: any): boolean {
    if (!error) return false;
    
    // Check for common network error indicators
    const networkIndicators = [
      'Network Error',
      'fetch',
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ERR_NETWORK',
      'ERR_INTERNET_DISCONNECTED'
    ];

    const errorString = error.toString().toLowerCase();
    return networkIndicators.some(indicator => 
      errorString.includes(indicator.toLowerCase())
    );
  }

  private isAuthError(error: any): boolean {
    if (!error) return false;
    
    const authIndicators = [
      'auth',
      'unauthorized',
      'forbidden',
      'invalid_token',
      'expired_token',
      'access_denied'
    ];

    const errorString = error.toString().toLowerCase();
    return authIndicators.some(indicator => 
      errorString.includes(indicator)
    );
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log error with context
   */
  logError(
    error: DatabaseError,
    context: {
      operation: string;
      userId?: string;
      additionalData?: any;
    }
  ): void {
    const logData = {
      timestamp: new Date().toISOString(),
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        category: this.categorizeError(error)
      },
      context,
      retryable: this.isRetryableError(error)
    };

    console.error('🚨 Database Error Log:', JSON.stringify(logData, null, 2));

    // In production, you might want to send this to an error tracking service
    // like Sentry, LogRocket, or Bugsnag
  }

  /**
   * Create standardized error response
   */
  createErrorResponse<T>(
    error: any,
    fallbackData: T,
    operation: string = 'operation'
  ): ApiResponse<T> {
    const dbError = this.handleSupabaseError(error);
    
    this.logError(dbError, { operation });

    return {
      success: false,
      data: fallbackData,
      error: this.getUserFriendlyMessage(dbError),
      errorCode: dbError.code,
      retryable: this.isRetryableError(dbError)
    };
  }

  /**
   * Create success response
   */
  createSuccessResponse<T>(data: T): ApiResponse<T> {
    return {
      success: true,
      data
    };
  }

  // ============================================================================
  // TRANSACTION ERROR HANDLING
  // ============================================================================

  /**
   * Execute multiple operations in a transaction with error handling
   */
  async executeTransaction<T>(
    operations: (() => Promise<any>)[],
    rollbackData: T,
    transactionName: string = 'transaction'
  ): Promise<ApiResponse<T>> {
    try {
      console.log(`🔄 Executing transaction: ${transactionName}`);

      const results: any[] = [];
      
      // Execute all operations
      for (let i = 0; i < operations.length; i++) {
        try {
          const result = await this.executeWithRetry(operations[i]);
          results.push(result);
        } catch (error) {
          console.error(`❌ Transaction ${transactionName} failed at operation ${i + 1}:`, error);
          
          // Attempt to rollback previous operations if needed
          await this.attemptRollback(results, transactionName);
          
          return this.createErrorResponse(error, rollbackData, transactionName);
        }
      }

      console.log(`✅ Transaction ${transactionName} completed successfully`);
      return this.createSuccessResponse(results as T);

    } catch (error) {
      console.error(`❌ Transaction ${transactionName} failed:`, error);
      return this.createErrorResponse(error, rollbackData, transactionName);
    }
  }

  private async attemptRollback(results: any[], transactionName: string): Promise<void> {
    console.log(`🔄 Attempting rollback for transaction: ${transactionName}`);
    
    // In a full implementation, you would implement specific rollback logic
    // For now, just log the attempt
    console.warn(`⚠️ Rollback attempted for ${results.length} operations`);
  }

  // ============================================================================
  // HEALTH CHECK & MONITORING
  // ============================================================================

  /**
   * Check database connection health
   */
  async checkDatabaseHealth(): Promise<{
    healthy: boolean;
    latency?: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      // Simple query to test connection
      const { error } = await this.executeWithRetry(async () => {
        const { data, error } = await import('./supabase').then(module => 
          module.supabase.from('users').select('id').limit(1)
        );
        return { data, error };
      });

      const latency = Date.now() - startTime;

      if (error) {
        return {
          healthy: false,
          latency,
          error: this.handleSupabaseError(error).message
        };
      }

      return {
        healthy: true,
        latency
      };

    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - startTime,
        error: this.handleSupabaseError(error).message
      };
    }
  }
}

// Export singleton instance
export const errorHandlingService = new ErrorHandlingService();
export default errorHandlingService;

// Export utility functions for easy use
export const safeExecute = errorHandlingService.safeExecute.bind(errorHandlingService);
export const executeWithRetry = errorHandlingService.executeWithRetry.bind(errorHandlingService);
export const handleError = errorHandlingService.handleSupabaseError.bind(errorHandlingService);
export const createErrorResponse = errorHandlingService.createErrorResponse.bind(errorHandlingService);
export const createSuccessResponse = errorHandlingService.createSuccessResponse.bind(errorHandlingService);