import { supabase } from './supabase';
import { supabaseUploadService } from './supabaseUploadService';
import {
  ContentPost,
  ContentComment,
  ContentInteraction,
  UserFollow,
  ContentNotification,
  CreateContentRequest,
  UpdateContentRequest,
  ContentFeedResponse,
  ContentCommentsResponse,
  UserProfileResponse,
  ContentAnalytics,
  ContentUploadResponse,
  ContentSearchRequest,
  FeedFilter,
  InteractionType,
  ContentUploadProgress
} from '../types/content';
import { ApiResponse } from '../types/api';
import * as FileSystem from 'expo-file-system';

class ContentService {
  
  // ============================================================================
  // STORAGE BUCKET MANAGEMENT
  // ============================================================================
  
  /**
   * Ensure the content storage buckets exist
   */
  async ensureContentBuckets(): Promise<void> {
    try {
      // Check if buckets exist
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      
      if (listError) {
        console.warn('⚠️ Could not list buckets:', listError);
        return;
      }
      
      const requiredBuckets = [
        { name: 'content', allowedMimeTypes: ['image/*', 'video/*'] }
      ];
      
      for (const bucketConfig of requiredBuckets) {
        const existingBucket = buckets?.find(bucket => bucket.name === bucketConfig.name);
        
        if (!existingBucket) {
          console.log(`📦 Creating ${bucketConfig.name} storage bucket...`);
          
          const { data, error } = await supabase.storage.createBucket(bucketConfig.name, {
            public: true,
            allowedMimeTypes: bucketConfig.allowedMimeTypes,
            fileSizeLimit: '100MB'
          });
          
          if (error) {
            console.error(`❌ Failed to create ${bucketConfig.name} bucket:`, error);
            // Don't throw - continue with other buckets
          } else {
            console.log(`✅ ${bucketConfig.name} bucket created successfully`);
          }
        } else {
          console.log(`✅ ${bucketConfig.name} bucket already exists`);
        }
      }
    } catch (error) {
      console.error('❌ Error ensuring content buckets:', error);
      // Don't throw - allow uploads to continue and fail gracefully
    }
  }
  
  // ============================================================================
  // CONTENT MANAGEMENT
  // ============================================================================
  
  /**
   * Create a new content post
   */
  async createPost(userId: string, postData: CreateContentRequest): Promise<ApiResponse<ContentPost>> {
    try {
      console.log('📝 Creating post with data:', {
        user_id: userId,
        title: postData.title,
        content_type: postData.content_type,
        media_url: postData.media_url,
        status: postData.status || 'published'
      });

      const { data, error } = await supabase
        .from('content_posts')
        .insert({
          user_id: userId,
          title: postData.title,
          description: postData.description,
          content_type: postData.content_type,
          media_url: postData.media_url,
          thumbnail_url: postData.thumbnail_url,
          secondary_media_url: postData.secondary_media_url,
          duration_seconds: postData.duration_seconds,
          location_name: postData.location_name,
          tags: postData.tags,
          status: postData.status || 'published',
          published_at: postData.status !== 'draft' ? new Date().toISOString() : null
        })
        .select(`
          *,
          user:users(id, name, avatar_url, role)
        `)
        .single();

      if (error) {
        console.error('❌ Database error creating post:', error);
        throw error;
      }

      console.log('✅ Post created successfully:', data.id);
      return {
        success: true,
        data: data as ContentPost
      };
    } catch (error) {
      console.error('❌ Content service error:', error);
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Failed to create post'
      };
    }
  }

  /**
   * Update an existing content post
   */
  async updatePost(userId: string, postId: string, updates: UpdateContentRequest): Promise<ApiResponse<ContentPost>> {
    try {
      const { data, error } = await supabase
        .from('content_posts')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
          published_at: updates.status === 'published' ? new Date().toISOString() : undefined
        })
        .eq('id', postId)
        .eq('user_id', userId) // Ensure user owns the post
        .select(`
          *,
          user:users(id, name, avatar_url, role)
        `)
        .single();

      if (error) throw error;

      return {
        success: true,
        data: data as ContentPost
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Failed to update post'
      };
    }
  }

  /**
   * Delete a content post and its associated media
   */
  async deletePost(userId: string, postId: string): Promise<ApiResponse<boolean>> {
    try {
      console.log('🗑️ Deleting post:', postId, 'for user:', userId);
      
      // First, get the post to get the media URL for deletion
      const { data: post, error: fetchError } = await supabase
        .from('content_posts')
        .select('media_url, user_id')
        .eq('id', postId)
        .eq('user_id', userId) // Ensure user owns the post
        .single();

      if (fetchError) throw fetchError;
      
      if (!post) {
        throw new Error('Post not found or you do not have permission to delete it');
      }

      // Delete the media file from storage if it exists
      if (post.media_url) {
        try {
          const urlParts = post.media_url.split('/');
          const fileName = urlParts[urlParts.length - 1];
          const filePath = post.media_url.includes('/videos/') ? `videos/${fileName}` : `images/${fileName}`;
          
          console.log('🗑️ Deleting media file:', filePath);
          
          const { error: storageError } = await supabase.storage
            .from('content')
            .remove([filePath]);
          
          if (storageError) {
            console.warn('⚠️ Failed to delete media file:', storageError);
            // Continue with post deletion even if file deletion fails
          } else {
            console.log('✅ Media file deleted successfully');
          }
        } catch (error) {
          console.warn('⚠️ Error deleting media file:', error);
          // Continue with post deletion
        }
      }

      // Delete the post from the database
      const { error: deleteError } = await supabase
        .from('content_posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      console.log('✅ Post deleted successfully:', postId);
      
      return {
        success: true,
        data: true
      };
    } catch (error) {
      console.error('❌ Error deleting post:', error);
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error.message : 'Failed to delete post'
      };
    }
  }

  /**
   * Get a single content post with user interaction data
   */
  async getPost(postId: string, viewerId?: string): Promise<ApiResponse<ContentPost>> {
    try {
      let query = supabase
        .from('content_posts')
        .select(`
          *,
          user:users(id, name, avatar_url, role)
        `)
        .eq('id', postId)
        .eq('status', 'published')
        .single();

      const { data: post, error } = await query;
      
      if (error) throw error;

      // Get user interaction data if viewer is provided
      let userInteractionData = {};
      if (viewerId) {
        const [interactionResult, followResult] = await Promise.all([
          this.getUserInteraction(postId, viewerId),
          this.checkFollowStatus(viewerId, post.user_id)
        ]);

        userInteractionData = {
          user_has_liked: interactionResult.success && !!interactionResult.data,
          user_interaction_type: interactionResult.data?.interaction_type,
          is_following_user: followResult.data
        };
      }

      return {
        success: true,
        data: { ...post, ...userInteractionData } as ContentPost
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Failed to get post'
      };
    }
  }

  // ============================================================================
  // CONTENT FEED & DISCOVERY
  // ============================================================================

  /**
   * Clean up orphaned content posts (where files have been deleted)
   */
  async cleanupOrphanedPosts(): Promise<{ success: boolean; cleaned: number }> {
    try {
      console.log('🧹 Starting cleanup of orphaned posts...');
      
      // Get all video posts
      const { data: videoPosts, error } = await supabase
        .from('content_posts')
        .select('id, media_url')
        .eq('content_type', 'video')
        .eq('status', 'published');
      
      if (error) throw error;
      
      let cleanedCount = 0;
      
      for (const post of videoPosts || []) {
        if (post.media_url) {
          const urlParts = post.media_url.split('/');
          const fileName = urlParts[urlParts.length - 1];
          
          const { data, error: listError } = await supabase.storage
            .from('content')
            .list('videos', { search: fileName });
          
          if (!listError && data) {
            const fileExists = data.some(file => file.name === fileName);
            
            if (!fileExists) {
              console.log('🗑️ Archiving orphaned post:', post.id);
              await supabase
                .from('content_posts')
                .update({ status: 'archived' })
                .eq('id', post.id);
              cleanedCount++;
            }
          }
        }
      }
      
      console.log(`✅ Cleanup complete: ${cleanedCount} posts archived`);
      return { success: true, cleaned: cleanedCount };
      
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      return { success: false, cleaned: 0 };
    }
  }

  /**
   * Validate that video files still exist in Supabase Storage
   */
  async validateVideoUrls(posts: any[]): Promise<any[]> {
    const validPosts = [];
    
    for (const post of posts) {
      try {
        if (post.content_type === 'video' && post.media_url) {
          // Extract file path from URL
          const urlParts = post.media_url.split('/');
          const fileName = urlParts[urlParts.length - 1];
          const filePath = `videos/${fileName}`;
          
          // Check if file exists in storage
          const { data, error } = await supabase.storage
            .from('content')
            .list('videos', {
              search: fileName
            });
          
          if (error) {
            console.warn('⚠️ Error checking file existence:', error);
            // If we can't check, include the post (better safe than sorry)
            validPosts.push(post);
            continue;
          }
          
          // Check if file exists in the list
          const fileExists = data && data.some(file => file.name === fileName);
          
          if (fileExists) {
            console.log('✅ Video file exists:', fileName);
            validPosts.push(post);
          } else {
            console.log('❌ Video file deleted, removing from feed:', fileName);
            // Optionally, update the database to mark post as archived
            await supabase
              .from('content_posts')
              .update({ status: 'archived' })
              .eq('id', post.id);
          }
        } else {
          // Non-video posts or posts without media_url
          validPosts.push(post);
        }
      } catch (error) {
        console.warn('⚠️ Error validating post:', post.id, error);
        // Include the post if validation fails
        validPosts.push(post);
      }
    }
    
    return validPosts;
  }

  /**
   * Get content feed with filters and pagination
   */
  async getFeed(params: ContentSearchRequest = {}, viewerId?: string): Promise<ApiResponse<ContentFeedResponse>> {
    try {
      const {
        filters = {},
        sort_by = 'recent',
        limit = 20,
        cursor
      } = params;

      let query = supabase
        .from('content_posts')
        .select(`
          *,
          user:users(id, name, avatar_url, role)
        `)
        .eq('status', 'published');

      // Apply filters
      if (filters.content_type) {
        query = query.eq('content_type', filters.content_type);
      }

      if (filters.user_id) {
        query = query.eq('user_id', filters.user_id);
      }

      if (filters.tags && filters.tags.length > 0) {
        query = query.overlaps('tags', filters.tags);
      }

      if (filters.featured_only) {
        query = query.eq('is_featured', true);
      }

      if (filters.following_only && viewerId) {
        // Get users that the viewer follows
        const { data: following } = await supabase
          .from('user_follows')
          .select('following_id')
          .eq('follower_id', viewerId);

        if (following && following.length > 0) {
          const followingIds = following.map(f => f.following_id);
          query = query.in('user_id', followingIds);
        } else {
          // No following users, return empty
          return {
            success: true,
            data: {
              posts: [],
              has_more: false,
              total_count: 0
            }
          };
        }
      }

      // Apply sorting
      switch (sort_by) {
        case 'popular':
          query = query.order('like_count', { ascending: false });
          break;
        case 'views':
          query = query.order('view_count', { ascending: false });
          break;
        case 'likes':
          query = query.order('like_count', { ascending: false });
          break;
        case 'recent':
        default:
          query = query.order('created_at', { ascending: false });
          break;
      }

      // Apply pagination
      if (cursor) {
        query = query.lt('created_at', cursor);
      }

      query = query.limit(limit + 1); // Get one extra to check if there are more

      const { data: posts, error } = await query;
      
      if (error) throw error;

      const hasMore = posts.length > limit;
      const resultPosts = hasMore ? posts.slice(0, limit) : posts;
      const nextCursor = hasMore ? resultPosts[resultPosts.length - 1].created_at : undefined;

      // Validate that video files still exist in storage
      console.log('🔍 Validating video URLs for', resultPosts.length, 'posts...');
      const validatedPosts = await this.validateVideoUrls(resultPosts);
      console.log('✅ After validation:', validatedPosts.length, 'valid posts');

      // Get user interaction data for each post if viewer is provided
      let enrichedPosts = validatedPosts;
      if (viewerId) {
        enrichedPosts = await this.enrichPostsWithUserData(validatedPosts, viewerId);
      }

      return {
        success: true,
        data: {
          posts: enrichedPosts as ContentPost[],
          has_more: hasMore,
          next_cursor: nextCursor
        }
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Failed to get feed'
      };
    }
  }

  /**
   * Search content posts
   */
  async searchContent(query: string, filters: FeedFilter = {}, viewerId?: string): Promise<ApiResponse<ContentFeedResponse>> {
    try {
      // For now, implement basic text search
      // In production, you'd use full-text search or external search service
      let supabaseQuery = supabase
        .from('content_posts')
        .select(`
          *,
          user:users(id, name, avatar_url, role)
        `)
        .eq('status', 'published')
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .limit(20);

      // Apply additional filters
      if (filters.content_type) {
        supabaseQuery = supabaseQuery.eq('content_type', filters.content_type);
      }

      if (filters.tags && filters.tags.length > 0) {
        supabaseQuery = supabaseQuery.overlaps('tags', filters.tags);
      }

      const { data: posts, error } = await supabaseQuery;
      
      if (error) throw error;

      // Enrich with user data if viewer provided
      let enrichedPosts = posts;
      if (viewerId) {
        enrichedPosts = await this.enrichPostsWithUserData(posts, viewerId);
      }

      return {
        success: true,
        data: {
          posts: enrichedPosts as ContentPost[],
          has_more: false // Simplified for now
        }
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Failed to search content'
      };
    }
  }

  // ============================================================================
  // CONTENT INTERACTIONS
  // ============================================================================

  /**
   * Like or unlike a content post
   */
  async toggleLike(contentId: string, userId: string, interactionType: InteractionType = 'like'): Promise<ApiResponse<boolean>> {
    try {
      // Check if user already liked the content
      const { data: existing } = await supabase
        .from('content_interactions')
        .select('id')
        .eq('content_post_id', contentId)
        .eq('user_id', userId)
        .single();

      if (existing) {
        // Unlike - remove interaction
        const { error } = await supabase
          .from('content_interactions')
          .delete()
          .eq('id', existing.id);

        if (error) throw error;

        return {
          success: true,
          data: false // false = unliked
        };
      } else {
        // Like - add interaction
        const { error } = await supabase
          .from('content_interactions')
          .insert({
            content_post_id: contentId,
            user_id: userId,
            interaction_type: interactionType
          });

        if (error) throw error;

        // Create notification for content owner
        await this.createNotification(contentId, userId, 'like');

        return {
          success: true,
          data: true // true = liked
        };
      }
    } catch (error) {
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error.message : 'Failed to toggle like'
      };
    }
  }

  /**
   * Record a content view
   */
  async recordView(contentId: string, userId?: string, durationSeconds?: number): Promise<ApiResponse<boolean>> {
    try {
      const viewData: any = {
        content_post_id: contentId,
        duration_seconds: durationSeconds,
        completed_view: durationSeconds ? durationSeconds >= 30 : false // Consider 30+ seconds a completed view
      };

      if (userId) {
        viewData.user_id = userId;
      }

      const { error } = await supabase
        .from('content_views')
        .upsert(viewData, {
          onConflict: userId ? 'content_post_id,user_id,created_at' : undefined,
          ignoreDuplicates: true
        });

      if (error && !error.message.includes('duplicate')) {
        throw error;
      }

      return {
        success: true,
        data: true
      };
    } catch (error) {
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error.message : 'Failed to record view'
      };
    }
  }

  // ============================================================================
  // COMMENTS
  // ============================================================================

  /**
   * Get comments for a content post
   */
  async getComments(contentId: string, viewerId?: string): Promise<ApiResponse<ContentCommentsResponse>> {
    try {
      const { data: comments, error } = await supabase
        .from('content_comments')
        .select(`
          *,
          user:users(id, name, avatar_url, role)
        `)
        .eq('content_post_id', contentId)
        .is('parent_comment_id', null) // Only top-level comments
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get replies for each comment
      const enrichedComments = await Promise.all(
        comments.map(async (comment) => {
          const { data: replies } = await supabase
            .from('content_comments')
            .select(`
              *,
              user:users(id, name, avatar_url, role)
            `)
            .eq('parent_comment_id', comment.id)
            .order('created_at', { ascending: true });

          // Check if viewer liked each comment and reply
          let userLikedComment = false;
          let userLikedReplies: Record<string, boolean> = {};

          if (viewerId) {
            const { data: commentLike } = await supabase
              .from('comment_likes')
              .select('id')
              .eq('comment_id', comment.id)
              .eq('user_id', viewerId)
              .single();

            userLikedComment = !!commentLike;

            if (replies && replies.length > 0) {
              const replyIds = replies.map(r => r.id);
              const { data: replyLikes } = await supabase
                .from('comment_likes')
                .select('comment_id')
                .in('comment_id', replyIds)
                .eq('user_id', viewerId);

              replyLikes?.forEach(like => {
                userLikedReplies[like.comment_id] = true;
              });
            }
          }

          return {
            ...comment,
            user_has_liked: userLikedComment,
            replies: replies?.map(reply => ({
              ...reply,
              user_has_liked: userLikedReplies[reply.id] || false
            })) || []
          };
        })
      );

      return {
        success: true,
        data: {
          comments: enrichedComments as ContentComment[],
          has_more: false,
          total_count: enrichedComments.length
        }
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Failed to get comments'
      };
    }
  }

  /**
   * Add a comment to a content post
   */
  async addComment(contentId: string, userId: string, text: string, parentCommentId?: string): Promise<ApiResponse<ContentComment>> {
    try {
      const { data, error } = await supabase
        .from('content_comments')
        .insert({
          content_post_id: contentId,
          user_id: userId,
          content: text,
          parent_comment_id: parentCommentId
        })
        .select(`
          *,
          user:users(id, name, avatar_url, role)
        `)
        .single();

      if (error) throw error;

      // Create notification for content owner
      await this.createNotification(contentId, userId, 'comment');

      return {
        success: true,
        data: data as ContentComment
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Failed to add comment'
      };
    }
  }

  /**
   * Toggle like on a comment
   */
  async toggleCommentLike(commentId: string, userId: string): Promise<ApiResponse<boolean>> {
    try {
      const { data: existing } = await supabase
        .from('comment_likes')
        .select('id')
        .eq('comment_id', commentId)
        .eq('user_id', userId)
        .single();

      if (existing) {
        // Unlike
        const { error } = await supabase
          .from('comment_likes')
          .delete()
          .eq('id', existing.id);

        if (error) throw error;
        return { success: true, data: false };
      } else {
        // Like
        const { error } = await supabase
          .from('comment_likes')
          .insert({
            comment_id: commentId,
            user_id: userId
          });

        if (error) throw error;
        return { success: true, data: true };
      }
    } catch (error) {
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error.message : 'Failed to toggle comment like'
      };
    }
  }

  // ============================================================================
  // USER FOLLOWS
  // ============================================================================

  /**
   * Follow or unfollow a user
   */
  async toggleFollow(followerId: string, followingId: string): Promise<ApiResponse<boolean>> {
    try {
      if (followerId === followingId) {
        return {
          success: false,
          data: false,
          error: 'Cannot follow yourself'
        };
      }

      const { data: existing } = await supabase
        .from('user_follows')
        .select('id')
        .eq('follower_id', followerId)
        .eq('following_id', followingId)
        .single();

      if (existing) {
        // Unfollow
        const { error } = await supabase
          .from('user_follows')
          .delete()
          .eq('id', existing.id);

        if (error) throw error;
        return { success: true, data: false };
      } else {
        // Follow
        const { error } = await supabase
          .from('user_follows')
          .insert({
            follower_id: followerId,
            following_id: followingId
          });

        if (error) throw error;

        // Create notification
        await this.createFollowNotification(followingId, followerId);

        return { success: true, data: true };
      }
    } catch (error) {
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error.message : 'Failed to toggle follow'
      };
    }
  }

  /**
   * Check if user is following another user
   */
  async checkFollowStatus(followerId: string, followingId: string): Promise<ApiResponse<boolean>> {
    try {
      const { data, error } = await supabase
        .from('user_follows')
        .select('id')
        .eq('follower_id', followerId)
        .eq('following_id', followingId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return {
        success: true,
        data: !!data
      };
    } catch (error) {
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error.message : 'Failed to check follow status'
      };
    }
  }

  // ============================================================================
  // CONTENT UPLOAD
  // ============================================================================

  /**
   * Upload content media (video/image) with progress tracking using Supabase Storage
   */
  async uploadContentMedia(
    file: string, // File URI  
    contentType: 'video' | 'image',
    userId: string, // Add userId parameter
    onProgress?: (progress: ContentUploadProgress) => void
  ): Promise<ContentUploadResponse> {
    try {
      console.log(`🚀 Starting ${contentType} upload for user ${userId}:`, file);
      
      // Ensure storage buckets exist before uploading
      await this.ensureContentBuckets();
      
      // Use the simplified Supabase upload service
      const uploadResult = await supabaseUploadService.uploadFile(
        file,
        contentType,
        userId,
        (progress) => {
          onProgress?.({
            uploadId: `upload_${Date.now()}`,
            progress: progress.progress,
            stage: 'uploading',
            bytesTransferred: progress.bytesTransferred,
            totalBytes: progress.totalBytes
          });
        }
      );

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Upload failed');
      }

      console.log('✅ Upload successful:', uploadResult.url);

      onProgress?.({
        uploadId: uploadResult.uploadId || `upload_${Date.now()}`,
        progress: 100,
        stage: 'completed',
        bytesTransferred: 100,
        totalBytes: 100
      });

      // For videos, use the same URL as thumbnail for now
      let thumbnailUrl = uploadResult.url;
      if (contentType === 'video') {
        thumbnailUrl = uploadResult.url; // In production, generate proper thumbnail
      }

      return {
        success: true,
        upload_id: uploadResult.uploadId || `upload_${Date.now()}`,
        media_url: uploadResult.url!,
        thumbnail_url: thumbnailUrl!,
        duration_seconds: contentType === 'video' ? 30 : undefined,
        file_size_bytes: 0 // Will be calculated by the upload service
      };
    } catch (error) {
      console.error('❌ Content upload error:', error);
      
      onProgress?.({
        uploadId: 'unknown',
        progress: 0,
        stage: 'error',
        bytesTransferred: 0,
        totalBytes: 0,
        error: error instanceof Error ? error.message : 'Upload failed'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Enrich posts with user interaction data
   */
  private async enrichPostsWithUserData(posts: any[], viewerId: string): Promise<ContentPost[]> {
    if (!posts || posts.length === 0) return [];

    const postIds = posts.map(p => p.id);
    const userIds = posts.map(p => p.user_id);

    // Get user interactions
    const { data: interactions } = await supabase
      .from('content_interactions')
      .select('content_post_id, interaction_type')
      .in('content_post_id', postIds)
      .eq('user_id', viewerId);

    // Get follow status
    const { data: follows } = await supabase
      .from('user_follows')
      .select('following_id')
      .in('following_id', userIds)
      .eq('follower_id', viewerId);

    const interactionMap = new Map(interactions?.map(i => [i.content_post_id, i]) || []);
    const followSet = new Set(follows?.map(f => f.following_id) || []);

    return posts.map(post => ({
      ...post,
      user_has_liked: interactionMap.has(post.id),
      user_interaction_type: interactionMap.get(post.id)?.interaction_type,
      is_following_user: followSet.has(post.user_id)
    }));
  }

  /**
   * Get user interaction for a specific post
   */
  private async getUserInteraction(contentId: string, userId: string): Promise<ApiResponse<ContentInteraction | null>> {
    try {
      const { data, error } = await supabase
        .from('content_interactions')
        .select('*')
        .eq('content_post_id', contentId)
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return {
        success: true,
        data: data as ContentInteraction | null
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Failed to get user interaction'
      };
    }
  }

  /**
   * Create notification for content interaction
   */
  private async createNotification(contentId: string, actorId: string, type: 'like' | 'comment'): Promise<void> {
    try {
      // Get the content and its owner
      const { data: content } = await supabase
        .from('content_posts')
        .select('user_id, title')
        .eq('id', contentId)
        .single();

      if (!content || content.user_id === actorId) return; // Don't notify yourself

      // Get actor info
      const { data: actor } = await supabase
        .from('users')
        .select('name')
        .eq('id', actorId)
        .single();

      if (!actor) return;

      const message = type === 'like' 
        ? `${actor.name} liked your post "${content.title}"`
        : `${actor.name} commented on your post "${content.title}"`;

      await supabase
        .from('content_notifications')
        .insert({
          user_id: content.user_id,
          actor_id: actorId,
          content_post_id: contentId,
          notification_type: type,
          content: message
        });
    } catch (error) {
      console.error('Failed to create notification:', error);
    }
  }

  /**
   * Create notification for new follow
   */
  private async createFollowNotification(recipientId: string, actorId: string): Promise<void> {
    try {
      const { data: actor } = await supabase
        .from('users')
        .select('name')
        .eq('id', actorId)
        .single();

      if (!actor) return;

      await supabase
        .from('content_notifications')
        .insert({
          user_id: recipientId,
          actor_id: actorId,
          notification_type: 'follow',
          content: `${actor.name} started following you`
        });
    } catch (error) {
      console.error('Failed to create follow notification:', error);
    }
  }
}

export const contentService = new ContentService(); 