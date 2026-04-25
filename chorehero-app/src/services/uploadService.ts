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
  /** Reuse a session id (e.g. from {@link createUploadSession}) so cancel works across optimize + upload. */
  uploadId?: string;
  onUploadId?: (id: string) => void;
}

// Video limits
const VIDEO_LIMITS = {
  maxDurationSeconds: 45,
  minDurationSeconds: 5,
  // Keep below storage payload limits for direct mobile uploads.
  maxFileSizeMB: 35,
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
  async validateFile(
    fileUri: string,
    config?: Partial<UploadConfig>,
    type?: 'video' | 'image' | 'document'
  ): Promise<{ isValid: boolean; error?: string; fileSize?: number }> {
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

      // Check file type (basic validation based on extension). Pass the upload
      // type through so unknown/missing extensions (common for ph:// or
      // extension-less iOS picker URIs) don't get misclassified as image/jpeg
      // and rejected when uploading a video.
      const fileExtension = fileUri.split('.').pop()?.toLowerCase();
      const mimeType = this.getMimeTypeFromExtension(fileExtension || '', type);

      if (!uploadConfig.allowedTypes.includes(mimeType)) {
        return { isValid: false, error: `File type .${fileExtension} not supported` };
      }

      return { isValid: true, fileSize };

    } catch (error: unknown) {
      console.error('File validation error:', error);
      const message = (error as { message?: string } | null)?.message ?? '';
      // If getInfoAsync fails with deprecation warning, try simpler check
      if (message.includes('deprecated')) {
        const fileExtension = fileUri.split('.').pop()?.toLowerCase();
        const mimeType = this.getMimeTypeFromExtension(fileExtension || '', type);
        if (uploadConfig.allowedTypes.includes(mimeType)) {
          return { isValid: true };
        }
        return { isValid: false, error: 'File type not supported' };
      }
      return { isValid: false, error: 'Unable to validate file' };
    }
  }

  /**
   * Register an upload id before heavy work (e.g. local video optimization) so
   * {@link cancelUpload} can invalidate the session before {@link uploadFile} runs.
   */
  createUploadSession(): string {
    const id = this.generateUploadId();
    this.activeUploads.set(id, true);
    return id;
  }

  isUploadActive(uploadId: string): boolean {
    return this.activeUploads.has(uploadId);
  }

  /** Clear a session (e.g. if optimization failed before {@link uploadFile} ran). */
  endUploadSession(uploadId: string): void {
    this.activeUploads.delete(uploadId);
  }

  // Upload file to Supabase Storage
  async uploadFile(
    fileUri: string,
    type: 'video' | 'image' | 'document',
    onProgress?: (progress: UploadProgress) => void,
    config?: Partial<UploadConfig>
  ): Promise<UploadResponse> {
    const uploadConfig = { ...this.defaultConfig, ...config };
    const uploadId = uploadConfig.uploadId ?? this.generateUploadId();
    if (!this.activeUploads.has(uploadId)) {
      this.activeUploads.set(uploadId, true);
    }
    uploadConfig.onUploadId?.(uploadId);

    try {
      if (!this.isUploadActive(uploadId)) {
        return {
          success: false,
          error: 'Upload cancelled',
          errorCode: 'CANCELLED',
          uploadId,
        };
      }

      // Initial progress
      onProgress?.({
        progress: 5,
        bytesTransferred: 0,
        totalBytes: 0,
        isCompleted: false,
      });

      // Validate file first
      const validation = await this.validateFile(fileUri, uploadConfig, type);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error || 'File failed validation',
          errorCode: 'VALIDATION_FAILED',
          uploadId,
        };
      }

      onProgress?.({
        progress: 10,
        bytesTransferred: 0,
        totalBytes: validation.fileSize || 0,
        isCompleted: false,
      });

      if (!this.isUploadActive(uploadId)) {
        return {
          success: false,
          error: 'Upload cancelled',
          errorCode: 'CANCELLED',
          uploadId,
        };
      }

      // Read file as base64
      console.log('📖 Reading file...');
      const base64Data = await FileSystem.readAsStringAsync(fileUri, {
        encoding: 'base64',
      });

      onProgress?.({
        progress: 30,
        bytesTransferred: 0,
        totalBytes: base64Data.length,
        isCompleted: false,
      });

      if (!this.isUploadActive(uploadId)) {
        return {
          success: false,
          error: 'Upload cancelled',
          errorCode: 'CANCELLED',
          uploadId,
        };
      }

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
        isCompleted: false,
      });

      // Upload to Supabase Storage with retry (handles transient "Network request failed")
      const contentType = this.getMimeTypeFromExtension(fileExtension, type);
      const fileBuffer = decode(base64Data);
      let lastError: unknown = null;

      for (let attempt = 1; attempt <= uploadConfig.maxRetries; attempt++) {
        if (!this.isUploadActive(uploadId)) {
          return {
            success: false,
            error: 'Upload cancelled',
            errorCode: 'CANCELLED',
            uploadId,
          };
        }
        try {
          const { error } = await supabase.storage
            .from(bucketName)
            .upload(storagePath, fileBuffer, {
              contentType,
              cacheControl: '3600',
              upsert: true,
            });

          if (error) {
            lastError = error;
            break;
          }

          lastError = null;
          break;
        } catch (err: unknown) {
          lastError = err;
          const errObj = err as { message?: string; name?: string } | null | undefined;
          const msg = String(errObj?.message || err || '');
          const isRetryable =
            msg.includes('Network request failed') ||
            msg.includes('fetch') ||
            msg.includes('timeout') ||
            errObj?.name === 'TypeError';
          if (attempt < uploadConfig.maxRetries && isRetryable) {
            console.warn(`⚠️ Upload attempt ${attempt} failed, retrying in ${uploadConfig.retryDelay}ms...`);
            if (!this.isUploadActive(uploadId)) {
              return {
                success: false,
                error: 'Upload cancelled',
                errorCode: 'CANCELLED',
                uploadId,
              };
            }
            await new Promise((r) => setTimeout(r, uploadConfig.retryDelay * attempt));
          } else {
            throw err;
          }
        }
      }

      const error = lastError;
      if (error) {
        console.error('❌ Supabase upload error:', error);
        const errObj = error as { statusCode?: string | number; message?: string } | null | undefined;
        const statusCode = String(errObj?.statusCode || '');
        const message = String(errObj?.message || '');
        const isPayloadTooLarge =
          statusCode === '413' ||
          /payload too large|max(?:imum)? allowed size|exceeded the maximum allowed size/i.test(message);
        if (isPayloadTooLarge) {
          return {
            success: false,
            error: 'File is too large to upload from mobile. Trim/compress and try again (target under 35MB).',
            errorCode: 'PAYLOAD_TOO_LARGE',
            uploadId,
          };
        }

        if (message.includes('Bucket not found') || message.includes('not found')) {
          console.log('📦 Bucket may not exist. Please run create_storage_buckets.sql in Supabase.');
          return {
            success: false,
            error: `Storage bucket '${bucketName}' not found. Please run the storage setup SQL.`,
            errorCode: 'STORAGE_NOT_CONFIGURED',
            uploadId,
          };
        }

        if (message.includes('row-level security') || message.includes('RLS')) {
          return {
            success: false,
            error: 'Upload permission denied. Please sign in with a valid account.',
            errorCode: 'PERMISSION_DENIED',
            uploadId,
          };
        }

        return {
          success: false,
          error: message || 'Upload failed',
          errorCode: 'UPLOAD_FAILED',
          uploadId,
        };
      }

      onProgress?.({
        progress: 80,
        bytesTransferred: base64Data.length,
        totalBytes: base64Data.length,
        isCompleted: false,
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
          uploadId,
        };
      }

      console.log('✅ Upload successful:', publicUrl);

      onProgress?.({
        progress: 100,
        bytesTransferred: base64Data.length,
        totalBytes: base64Data.length,
        isCompleted: true,
      });

      return {
        success: true,
        url: publicUrl,
        uploadId,
      };
    } catch (error: unknown) {
      console.error('❌ Upload error:', error);
      const message = error instanceof Error ? error.message : String(error ?? 'Unknown upload error');

      onProgress?.({
        progress: 0,
        bytesTransferred: 0,
        totalBytes: 0,
        isCompleted: false,
        error: message,
      });

      return {
        success: false,
        error: message || 'Upload failed unexpectedly',
        errorCode: 'UNKNOWN_ERROR',
        uploadId,
      };
    } finally {
      this.activeUploads.delete(uploadId);
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

  private getMimeTypeFromExtension(extension: string, type?: 'video' | 'image' | 'document'): string {
    const mimeTypes: Record<string, string> = {
      'mp4': 'video/mp4',
      'mov': 'video/quicktime',
      'avi': 'video/avi',
      'm4v': 'video/mp4',
      '3gp': 'video/mp4', // phones often use 3gp; mp4 is accepted by bucket
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'heic': 'image/jpeg', // iPhone default; bucket doesn't support image/heic
      'heif': 'image/jpeg',
      'pdf': 'application/pdf'
    };
    const ext = extension.toLowerCase();
    const known = mimeTypes[ext];
    if (known) return known;
    // Supabase rejects application/octet-stream - use type-specific fallback
    if (type === 'video') return 'video/mp4';
    if (type === 'image') return 'image/jpeg';
    return 'image/jpeg'; // safest fallback for unknown
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
