import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system';
import { UploadProgress, UploadResponse, UploadConfig } from './uploadService';

class SupabaseUploadService {
  private defaultConfig: UploadConfig = {
    maxFileSize: 100 * 1024 * 1024, // 100MB
    allowedTypes: ['video/mp4', 'video/mov', 'video/avi', 'image/jpeg', 'image/png', 'image/jpg'],
    compressionQuality: 0.8,
    maxRetries: 3,
    retryDelay: 2000,
  };

  /**
   * Upload file to Supabase Storage
   */
  async uploadFile(
    fileUri: string,
    type: 'video' | 'image',
    userId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResponse> {
    try {
      console.log('🚀 Starting Supabase upload:', { fileUri, type, userId });
      
      // Validate file first
      const validation = await this.validateFile(fileUri);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error,
          errorCode: 'VALIDATION_FAILED'
        };
      }

      // Generate file name with user folder structure
      const timestamp = Date.now();
      const fileExtension = this.getFileExtension(fileUri);
      const fileName = `${userId}/${timestamp}.${fileExtension}`;
      const bucketName = 'content'; // Use single content bucket for all media

      // Read file as base64
      onProgress?.({
        progress: 10,
        bytesTransferred: 0,
        totalBytes: 100,
        isCompleted: false
      });

      const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      onProgress?.({
        progress: 50,
        bytesTransferred: 50,
        totalBytes: 100,
        isCompleted: false
      });

      // Convert base64 to ArrayBuffer using native methods
      const binaryString = atob(base64);
      const arrayBuffer = new ArrayBuffer(binaryString.length);
      const uint8Array = new Uint8Array(arrayBuffer);
      
      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
      }
      const mimeType = this.getMimeTypeFromExtension(fileExtension);

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, arrayBuffer, {
          contentType: mimeType,
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('❌ Supabase storage upload error:', error);
        return {
          success: false,
          error: error.message,
          errorCode: 'UPLOAD_FAILED'
        };
      }

      onProgress?.({
        progress: 90,
        bytesTransferred: 90,
        totalBytes: 100,
        isCompleted: false
      });

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);

      onProgress?.({
        progress: 100,
        bytesTransferred: 100,
        totalBytes: 100,
        isCompleted: true
      });

      console.log('✅ Upload successful:', urlData.publicUrl);

      return {
        success: true,
        url: urlData.publicUrl,
        uploadId: fileName
      };

    } catch (error) {
      console.error('❌ Supabase upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
        errorCode: 'UNKNOWN_ERROR'
      };
    }
  }

  /**
   * Upload video specifically for cleaner profiles
   */
  async uploadCleanerVideo(fileUri: string, userId: string): Promise<UploadResponse> {
    return this.uploadFile(fileUri, 'video', userId);
  }

  /**
   * Upload image for content posts
   */
  async uploadContentImage(fileUri: string, userId: string): Promise<UploadResponse> {
    return this.uploadFile(fileUri, 'image', userId);
  }

  /**
   * Delete file from Supabase Storage
   */
  async deleteFile(bucketName: string, fileName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.storage
        .from(bucketName)
        .remove([fileName]);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Delete failed' 
      };
    }
  }

  /**
   * Get signed URL for private files (if needed)
   */
  async getSignedUrl(bucketName: string, fileName: string, expiresIn = 3600): Promise<string | null> {
    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(fileName, expiresIn);

      if (error) {
        console.error('Error creating signed URL:', error);
        return null;
      }

      return data.signedUrl;
    } catch (error) {
      console.error('Error creating signed URL:', error);
      return null;
    }
  }

  // Helper methods
  private async validateFile(fileUri: string): Promise<{ isValid: boolean; error?: string }> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        return { isValid: false, error: 'File not found' };
      }

      if (fileInfo.size && fileInfo.size > this.defaultConfig.maxFileSize) {
        const maxSizeMB = Math.round(this.defaultConfig.maxFileSize / (1024 * 1024));
        return { isValid: false, error: `File size exceeds ${maxSizeMB}MB limit` };
      }

      const fileExtension = this.getFileExtension(fileUri);
      const mimeType = this.getMimeTypeFromExtension(fileExtension);
      
      if (!this.defaultConfig.allowedTypes.includes(mimeType)) {
        return { isValid: false, error: 'File type not supported' };
      }

      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: 'Unable to validate file' };
    }
  }

  private getFileExtension(fileUri: string): string {
    return fileUri.split('.').pop()?.toLowerCase() || '';
  }

  private getMimeTypeFromExtension(extension: string): string {
    const mimeTypes: Record<string, string> = {
      'mp4': 'video/mp4',
      'mov': 'video/mov',
      'avi': 'video/avi',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'webp': 'image/webp'
    };
    return mimeTypes[extension] || 'application/octet-stream';
  }
}

export const supabaseUploadService = new SupabaseUploadService();
export default supabaseUploadService;