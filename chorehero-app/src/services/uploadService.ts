import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';
import { decode } from 'base64-arraybuffer';

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

// Video limits
const VIDEO_LIMITS = {
  maxDurationSeconds: 45,
  minDurationSeconds: 5,
  maxFileSizeMB: 50, // 50MB max per video
};

class UploadService {
  private activeUploads = new Map<string, boolean>();
  private debug = __DEV__;
  
  private defaultConfig: UploadConfig = {
    maxFileSize: VIDEO_LIMITS.maxFileSizeMB * 1024 * 1024,
    allowedTypes: ['video/mp4', 'video/mov', 'video/avi', 'video/quicktime', 'image/jpeg', 'image/png', 'image/jpg'],
    compressionQuality: 0.8,
    maxRetries: 3,
    retryDelay: 2000,
  };

  // Validate file before upload
  async validateFile(fileUri: string, config?: Partial<UploadConfig>): Promise<{ isValid: boolean; error?: string; fileSize?: number }> {
    const uploadConfig = { ...this.defaultConfig, ...config };

    try {
      // Check if file exists and get info
      const fileInfo = await FileSystem.getInfoAsync(fileUri, { size: true });
      
      if (!fileInfo.exists) {
        return { isValid: false, error: 'File not found' };
      }

      // Check file size
      const fileSize = (fileInfo as any).size || 0;
      if (fileSize > uploadConfig.maxFileSize) {
        const maxSizeMB = Math.round(uploadConfig.maxFileSize / (1024 * 1024));
        return { isValid: false, error: `File size exceeds ${maxSizeMB}MB limit` };
      }

      // Check file type (basic validation based on extension)
      const fileExtension = fileUri.split('.').pop()?.toLowerCase();
      const mimeType = this.getMimeTypeFromExtension(fileExtension || '');
      
      if (!uploadConfig.allowedTypes.includes(mimeType)) {
        return { isValid: false, error: `File type .${fileExtension} not supported` };
      }

      return { isValid: true, fileSize };

    } catch (error: any) {
      console.error('File validation error:', error);
      // If getInfoAsync fails with deprecation warning, try simpler check
      if (error.message?.includes('deprecated')) {
        // Fallback: just check extension
        const fileExtension = fileUri.split('.').pop()?.toLowerCase();
        const mimeType = this.getMimeTypeFromExtension(fileExtension || '');
        if (uploadConfig.allowedTypes.includes(mimeType)) {
          return { isValid: true };
        }
        return { isValid: false, error: 'File type not supported' };
      }
      return { isValid: false, error: 'Unable to validate file' };
    }
  }

  // Upload file to Supabase Storage
  async uploadFile(
    fileUri: string,
    type: 'video' | 'image' | 'document',
    onProgress?: (progress: UploadProgress) => void,
    config?: Partial<UploadConfig>
  ): Promise<UploadResponse> {
    const uploadConfig = { ...this.defaultConfig, ...config };
    const uploadId = this.generateUploadId();

    try {
      // Initial progress
      onProgress?.({
        progress: 5,
        bytesTransferred: 0,
        totalBytes: 0,
        isCompleted: false
      });

      // Validate file first (but don't fail completely on validation errors)
      const validation = await this.validateFile(fileUri, uploadConfig);
      if (!validation.isValid) {
        console.warn('⚠️ Validation warning:', validation.error);
        // Continue anyway for now - Supabase will reject if truly invalid
      }

            onProgress?.({
        progress: 10,
        bytesTransferred: 0,
        totalBytes: validation.fileSize || 0,
              isCompleted: false
            });

      // Read file as base64
      console.log('📖 Reading file...');
      const base64Data = await FileSystem.readAsStringAsync(fileUri, {
        encoding: 'base64',
      });

      onProgress?.({
        progress: 30,
        bytesTransferred: 0,
        totalBytes: base64Data.length,
        isCompleted: false
      });

      // Generate unique filename
      const fileExtension = fileUri.split('.').pop()?.toLowerCase() || 'mp4';
      const fileName = `${type}_${uploadId}.${fileExtension}`;
      
      // Determine correct bucket based on file type
      const bucketName = type === 'video' ? 'content-videos' : 'content-images';
      const storagePath = fileName; // Just the filename, no subfolder

      console.log(`📤 Uploading to Supabase Storage bucket '${bucketName}': ${storagePath}`);
              
              onProgress?.({
        progress: 40,
                bytesTransferred: 0,
        totalBytes: base64Data.length,
        isCompleted: false
      });

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(storagePath, decode(base64Data), {
          contentType: this.getMimeTypeFromExtension(fileExtension),
          cacheControl: '3600',
          upsert: true,
        });

      if (error) {
        console.error('❌ Supabase upload error:', error);
        
        // Check for specific errors
        if (error.message?.includes('Bucket not found') || error.message?.includes('not found')) {
          console.log('📦 Bucket may not exist. Please run create_storage_buckets.sql in Supabase.');
          return {
            success: false,
            error: `Storage bucket '${bucketName}' not found. Please run the storage setup SQL.`,
            errorCode: 'STORAGE_NOT_CONFIGURED',
            uploadId
          };
        }
        
        if (error.message?.includes('row-level security') || error.message?.includes('RLS')) {
      return {
        success: false,
            error: 'Upload permission denied. Please sign in with a valid account.',
            errorCode: 'PERMISSION_DENIED',
        uploadId
      };
        }
        
        return {
          success: false,
          error: error.message || 'Upload failed',
          errorCode: 'UPLOAD_FAILED',
          uploadId
        };
      }

      onProgress?.({
        progress: 80,
        bytesTransferred: base64Data.length,
        totalBytes: base64Data.length,
        isCompleted: false
      });

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(storagePath);

      const publicUrl = urlData?.publicUrl;

      if (!publicUrl) {
        return {
          success: false,
          error: 'Failed to get public URL',
          errorCode: 'URL_FAILED',
          uploadId
        };
      }

      console.log('✅ Upload successful:', publicUrl);

      onProgress?.({
        progress: 100,
        bytesTransferred: base64Data.length,
        totalBytes: base64Data.length,
        isCompleted: true
      });

      return {
        success: true,
        url: publicUrl,
        uploadId
      };

    } catch (error: any) {
      console.error('❌ Upload error:', error);
      
      onProgress?.({
        progress: 0,
        bytesTransferred: 0,
        totalBytes: 0,
        isCompleted: false,
        error: error.message
      });

      return {
        success: false,
        error: error.message || 'Upload failed unexpectedly',
        errorCode: 'UNKNOWN_ERROR',
          uploadId
        };
    }
  }

  // Cancel active upload
  cancelUpload(uploadId: string): boolean {
    if (this.activeUploads.has(uploadId)) {
      this.activeUploads.delete(uploadId);
      return true;
    }
    return false;
  }

  // Helper methods
  private generateUploadId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getMimeTypeFromExtension(extension: string): string {
    const mimeTypes: Record<string, string> = {
      'mp4': 'video/mp4',
      'mov': 'video/quicktime',
      'avi': 'video/avi',
      'm4v': 'video/mp4',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'pdf': 'application/pdf'
    };
    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
  }

  // Get upload status for debugging
  async getUploadStatus(): Promise<{
    activeUploads: number;
  }> {
    return {
      activeUploads: this.activeUploads.size,
    };
  }
}

export const uploadService = new UploadService();
