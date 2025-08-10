import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';

export interface UploadProgress {
  progress: number; // 0-100
  bytesTransferred: number;
  totalBytes: number;
  isCompleted: boolean;
  error?: string;
}

export interface UploadResponse {
  success: boolean;
  url?: string;
  error?: string;
  errorCode?: string;
  uploadId?: string;
}

export interface UploadConfig {
  maxFileSize: number; // in bytes
  allowedTypes: string[];
  compressionQuality?: number;
  maxRetries: number;
  retryDelay: number;
}

class UploadService {
  private baseUrl = 'https://api.chorehero.com';
  private activeUploads = new Map<string, XMLHttpRequest>();
  private debug = __DEV__; // Enable debug logging in development
  
  private defaultConfig: UploadConfig = {
    maxFileSize: 100 * 1024 * 1024, // 100MB
    allowedTypes: ['video/mp4', 'video/mov', 'video/avi', 'image/jpeg', 'image/png', 'image/jpg'],
    compressionQuality: 0.8,
    maxRetries: 3,
    retryDelay: 2000,
  };

  // Validate file before upload
  async validateFile(fileUri: string, config?: Partial<UploadConfig>): Promise<{ isValid: boolean; error?: string }> {
    const uploadConfig = { ...this.defaultConfig, ...config };

    try {
      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        return { isValid: false, error: 'File not found' };
      }

      // Check file size
      if (fileInfo.size && fileInfo.size > uploadConfig.maxFileSize) {
        const maxSizeMB = Math.round(uploadConfig.maxFileSize / (1024 * 1024));
        return { isValid: false, error: `File size exceeds ${maxSizeMB}MB limit` };
      }

      // Check file type (basic validation)
      const fileExtension = fileUri.split('.').pop()?.toLowerCase();
      const mimeType = this.getMimeTypeFromExtension(fileExtension || '');
      
      if (!uploadConfig.allowedTypes.includes(mimeType)) {
        return { isValid: false, error: 'File type not supported' };
      }

      return { isValid: true };

    } catch (error) {
      console.error('File validation error:', error);
      return { isValid: false, error: 'Unable to validate file' };
    }
  }

  // Upload file with progress tracking
  async uploadFile(
    fileUri: string,
    type: 'video' | 'image' | 'document',
    onProgress?: (progress: UploadProgress) => void,
    config?: Partial<UploadConfig>
  ): Promise<UploadResponse> {
    const uploadConfig = { ...this.defaultConfig, ...config };
    const uploadId = this.generateUploadId();

    // Validate file first
    const validation = await this.validateFile(fileUri, uploadConfig);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.error,
        errorCode: 'VALIDATION_FAILED',
        uploadId
      };
    }

    // Store upload metadata for recovery
    await this.storeUploadMetadata(uploadId, {
      fileUri,
      type,
      timestamp: new Date().toISOString(),
      retryCount: 0
    });

    return this.performUpload(uploadId, fileUri, type, onProgress, uploadConfig);
  }

  private async performUpload(
    uploadId: string,
    fileUri: string,
    type: string,
    onProgress?: (progress: UploadProgress) => void,
    config: UploadConfig,
    retryCount = 0
  ): Promise<UploadResponse> {
    try {
      // Check network connectivity
      const networkInfo = await this.checkNetworkConnectivity();
      if (!networkInfo.isConnected) {
        return {
          success: false,
          error: 'No internet connection. Upload will retry when connection is restored.',
          errorCode: 'NETWORK_OFFLINE',
          uploadId
        };
      }

      const formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        type: this.getMimeTypeFromUri(fileUri),
        name: `upload_${uploadId}.${this.getFileExtension(fileUri)}`,
      } as any);
      formData.append('type', type);
      formData.append('uploadId', uploadId);

      return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        this.activeUploads.set(uploadId, xhr);

        // Track upload progress
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            onProgress?.({
              progress,
              bytesTransferred: event.loaded,
              totalBytes: event.total,
              isCompleted: false
            });
          }
        });

        xhr.addEventListener('load', async () => {
          this.activeUploads.delete(uploadId);

          if (xhr.status === 200) {
            try {
              const response = JSON.parse(xhr.responseText);
              
              // Success - clean up metadata
              await this.removeUploadMetadata(uploadId);
              
              onProgress?.({
                progress: 100,
                bytesTransferred: 0,
                totalBytes: 0,
                isCompleted: true
              });

              console.log(`✅ Upload ${uploadId} completed successfully`);
              resolve({
                success: true,
                url: response.url,
                uploadId
              });

            } catch (parseError) {
              console.error(`❌ Failed to parse server response for upload ${uploadId}:`, parseError);
              console.error(`Server response text:`, xhr.responseText);
              resolve({
                success: false,
                error: 'Invalid server response',
                errorCode: 'PARSE_ERROR',
                uploadId
              });
            }
          } else {
            // Handle HTTP errors
            console.error(`❌ Upload ${uploadId} failed with status ${xhr.status}:`, xhr.responseText);
            this.handleUploadError(xhr.status, uploadId, fileUri, type, onProgress, config, retryCount, resolve);
          }
        });

        xhr.addEventListener('error', () => {
          this.activeUploads.delete(uploadId);
          console.error(`❌ Network error for upload ${uploadId}`);
          this.handleUploadError(0, uploadId, fileUri, type, onProgress, config, retryCount, resolve);
        });

        xhr.addEventListener('timeout', () => {
          this.activeUploads.delete(uploadId);
          resolve({
            success: false,
            error: 'Upload timed out. Please try again.',
            errorCode: 'TIMEOUT',
            uploadId
          });
        });

        // Configure and send request
        const uploadUrl = `${this.baseUrl}/upload`;
        if (this.debug) {
          console.log(`🚀 Starting upload ${uploadId} to ${uploadUrl}`);
          console.log(`📁 File: ${fileUri}, Type: ${type}`);
        }
        
        xhr.open('POST', uploadUrl);
        xhr.timeout = 60000; // 60 second timeout
        xhr.setRequestHeader('Accept', 'application/json');
        
        // Add retry information to headers for server-side debugging
        if (retryCount > 0) {
          xhr.setRequestHeader('X-Retry-Count', retryCount.toString());
        }
        
        xhr.send(formData);
      });

    } catch (error) {
      console.error('Upload error:', error);
      return {
        success: false,
        error: 'Upload failed unexpectedly',
        errorCode: 'UNKNOWN_ERROR',
        uploadId
      };
    }
  }

  private async handleUploadError(
    status: number,
    uploadId: string,
    fileUri: string,
    type: string,
    onProgress: ((progress: UploadProgress) => void) | undefined,
    config: UploadConfig,
    retryCount: number,
    resolve: (value: UploadResponse) => void
  ) {
    // Check if file still exists before retrying
    try {
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        resolve({
          success: false,
          error: 'File no longer exists. Please select the file again.',
          errorCode: 'FILE_NOT_FOUND',
          uploadId
        });
        return;
      }
    } catch (error) {
      console.error('Error checking file existence:', error);
    }

    // Retry logic for certain errors
    if (retryCount < config.maxRetries && this.shouldRetry(status)) {
      console.log(`Retrying upload ${uploadId}, attempt ${retryCount + 1}`);
      
      // Check network connectivity before retry
      const networkInfo = await this.checkNetworkConnectivity();
      if (!networkInfo.isConnected) {
        console.log(`Network offline, queuing upload ${uploadId} for later retry`);
        resolve({
          success: false,
          error: 'Network connection lost. Upload will retry when connection is restored.',
          errorCode: 'NETWORK_OFFLINE',
          uploadId
        });
        return;
      }
      
      // Wait before retry with exponential backoff
      const delay = config.retryDelay * Math.pow(2, retryCount);
      console.log(`Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Update retry count in metadata
      await this.updateUploadRetryCount(uploadId, retryCount + 1);
      
      // Retry the upload
      const retryResult = await this.performUpload(uploadId, fileUri, type, onProgress, config, retryCount + 1);
      resolve(retryResult);
    } else {
      // Max retries reached or non-retryable error
      console.log(`Upload ${uploadId} failed after ${retryCount} retries. Status: ${status}`);
      const errorResponse = this.getErrorResponse(status, uploadId);
      
      onProgress?.({
        progress: 0,
        bytesTransferred: 0,
        totalBytes: 0,
        isCompleted: false,
        error: errorResponse.error
      });

      resolve(errorResponse);
    }
  }

  private shouldRetry(status: number): boolean {
    // Retry for network errors and server errors
    return status === 0 || status >= 500 || status === 408 || status === 429;
  }

  private getErrorResponse(status: number, uploadId: string): UploadResponse {
    if (status === 0) {
      return {
        success: false,
        error: 'Network connection failed. Please check your internet connection and try again.',
        errorCode: 'NETWORK_ERROR',
        uploadId
      };
    }
    switch (status) {
      case 413:
        return {
          success: false,
          error: 'File too large. Please choose a smaller file.',
          errorCode: 'FILE_TOO_LARGE',
          uploadId
        };
      case 415:
        return {
          success: false,
          error: 'File type not supported.',
          errorCode: 'UNSUPPORTED_TYPE',
          uploadId
        };
      case 429:
        return {
          success: false,
          error: 'Too many uploads. Please wait before trying again.',
          errorCode: 'RATE_LIMITED',
          uploadId
        };
      case 500:
      case 502:
      case 503:
        return {
          success: false,
          error: 'Server error. Please try again later.',
          errorCode: 'SERVER_ERROR',
          uploadId
        };
      default:
        return {
          success: false,
          error: `Upload failed (${status}). Please try again.`,
          errorCode: 'UPLOAD_FAILED',
          uploadId
        };
    }
  }

  // Cancel active upload
  cancelUpload(uploadId: string): boolean {
    const xhr = this.activeUploads.get(uploadId);
    if (xhr) {
      xhr.abort();
      this.activeUploads.delete(uploadId);
      this.removeUploadMetadata(uploadId);
      return true;
    }
    return false;
  }

  // Resume failed uploads
  async resumeFailedUploads(): Promise<void> {
    try {
      const failedUploads = await this.getFailedUploads();
      
      for (const upload of failedUploads) {
        if (upload.retryCount < this.defaultConfig.maxRetries) {
          console.log(`Resuming upload: ${upload.uploadId}`);
          // Don't await - let uploads run in parallel
          this.performUpload(
            upload.uploadId,
            upload.fileUri,
            upload.type,
            undefined,
            this.defaultConfig,
            upload.retryCount
          );
        }
      }
    } catch (error) {
      console.error('Error resuming uploads:', error);
    }
  }

  // Helper methods
  private generateUploadId(): string {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getMimeTypeFromExtension(extension: string): string {
    const mimeTypes: Record<string, string> = {
      'mp4': 'video/mp4',
      'mov': 'video/mov',
      'avi': 'video/avi',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'pdf': 'application/pdf'
    };
    return mimeTypes[extension] || 'application/octet-stream';
  }

  private getMimeTypeFromUri(uri: string): string {
    const extension = uri.split('.').pop()?.toLowerCase() || '';
    return this.getMimeTypeFromExtension(extension);
  }

  private getFileExtension(uri: string): string {
    return uri.split('.').pop()?.toLowerCase() || '';
  }

  private async checkNetworkConnectivity(): Promise<{ isConnected: boolean }> {
    try {
      // Simple network check - try to fetch a small resource
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-cache'
      });
      
      clearTimeout(timeoutId);
      return { isConnected: response.ok };
    } catch (error) {
      console.log('Network connectivity check failed:', error);
      return { isConnected: false };
    }
  }

  // Metadata management for upload recovery
  private async storeUploadMetadata(uploadId: string, metadata: any): Promise<void> {
    try {
      const uploads = await this.getStoredUploads();
      uploads[uploadId] = metadata;
      await AsyncStorage.setItem('failed_uploads', JSON.stringify(uploads));
    } catch (error) {
      console.error('Error storing upload metadata:', error);
    }
  }

  private async removeUploadMetadata(uploadId: string): Promise<void> {
    try {
      const uploads = await this.getStoredUploads();
      delete uploads[uploadId];
      await AsyncStorage.setItem('failed_uploads', JSON.stringify(uploads));
    } catch (error) {
      console.error('Error removing upload metadata:', error);
    }
  }

  private async updateUploadRetryCount(uploadId: string, retryCount: number): Promise<void> {
    try {
      const uploads = await this.getStoredUploads();
      if (uploads[uploadId]) {
        uploads[uploadId].retryCount = retryCount;
        await AsyncStorage.setItem('failed_uploads', JSON.stringify(uploads));
      }
    } catch (error) {
      console.error('Error updating retry count:', error);
    }
  }

  private async getStoredUploads(): Promise<Record<string, any>> {
    try {
      const stored = await AsyncStorage.getItem('failed_uploads');
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Error getting stored uploads:', error);
      return {};
    }
  }

  private async getFailedUploads(): Promise<any[]> {
    const uploads = await this.getStoredUploads();
    return Object.values(uploads);
  }

  // Clear all failed upload metadata (useful for testing)
  async clearFailedUploads(): Promise<void> {
    try {
      await AsyncStorage.removeItem('failed_uploads');
      console.log('✅ Cleared all failed upload metadata');
    } catch (error) {
      console.error('Error clearing failed uploads:', error);
    }
  }

  // Get upload status for debugging
  async getUploadStatus(): Promise<{
    activeUploads: number;
    failedUploads: number;
    pendingRetries: number;
  }> {
    const failedUploads = await this.getFailedUploads();
    const pendingRetries = failedUploads.filter(upload => 
      upload.retryCount < this.defaultConfig.maxRetries
    ).length;

    return {
      activeUploads: this.activeUploads.size,
      failedUploads: failedUploads.length,
      pendingRetries
    };
  }
}

export const uploadService = new UploadService();