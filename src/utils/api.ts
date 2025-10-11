/**
 * API Service for Social Media Backend
 * Handles all HTTP requests to the Python backend
 */

import { Platform } from 'react-native';
import { getApiBaseUrl } from './apiConfig';

// API Configuration is now in apiConfig.ts
// You can modify apiConfig.ts locally without git tracking changes
export const API_BASE_URL = getApiBaseUrl();

console.log('🌐 API Base URL:', API_BASE_URL);  // Debug log

export interface EmojiOverlay {
  id: string;
  emoji: string;
  x: number;
  y: number;
  scale: number;
}

export interface MediaPost {
  id: number;
  filename: string;
  media_type: 'photo' | 'video';
  caption: string | null;
  emojis: string; // JSON string
  timestamp: number;
  published: boolean;
  url: string;
  likes_count: number;
}

export interface UploadMediaParams {
  fileUri: string;
  mediaType: 'photo' | 'video';
  caption?: string;
  emojis?: EmojiOverlay[];
  published?: boolean;
}

// Comment-related types
export interface CommentLike {
  id: number;
  user_name: string;
  created_at: string;
}

export interface Comment {
  id: number;
  content: string;
  author_name: string;
  created_at: string;
  updated_at: string;
  media_post_id: number;
  parent_comment_id: number | null;
  likes_count: number;
  replies_count: number;
  likes: CommentLike[];
  replies?: Comment[];
}

export interface CommentWithReplies extends Comment {
  replies: Comment[];
}

export interface CreateCommentParams {
  content: string;
  author_name?: string;
  parent_comment_id?: number | null;
}

export interface UpdateCommentParams {
  content: string;
}

export interface LikeCommentParams {
  user_name?: string;
}

// Media Like types
export interface MediaLike {
  id: number;
  user_name: string;
  created_at: string;
}

export interface LikeMediaParams {
  user_name?: string;
}

/**
 * Upload media file to the backend
 */
export const uploadMedia = async (params: UploadMediaParams): Promise<MediaPost> => {
  try {
    const formData = new FormData();
    
    // Determine the file extension and mime type
    const fileExtension = params.fileUri.split('.').pop()?.toLowerCase() || 'mp4';
    const mimeType = params.mediaType === 'photo' 
      ? `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`
      : `video/${fileExtension}`;

    // Create file object
    const file = {
      uri: params.fileUri,
      type: mimeType,
      name: `${params.mediaType}_${Date.now()}.${fileExtension}`,
    } as any;

    formData.append('file', file);
    formData.append('media_type', params.mediaType);
    formData.append('caption', params.caption || '');
    formData.append('emojis', JSON.stringify(params.emojis || []));
    formData.append('published', params.published !== undefined ? String(params.published) : 'true');

    console.log('📤 Uploading to:', `${API_BASE_URL}/api/media`);

    const response = await fetch(`${API_BASE_URL}/api/media`, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
        // Don't set Content-Type for FormData - browser will set it with boundary
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Upload failed: ${error}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error uploading media:', error);
    throw error;
  }
};

/**
 * Get all published media posts from the backend
 */
export const getAllMedia = async (skip: number = 0, limit: number = 100): Promise<MediaPost[]> => {
  try {
    const url = `${API_BASE_URL}/api/media?skip=${skip}&limit=${limit}`;
    console.log('📥 Fetching from:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch media: ${error}`);
    }

    const data = await response.json();
    console.log('✅ Received media count:', data.length);
    return data;
  } catch (error) {
    console.error('Error fetching media:', error);
    throw error;
  }
};

/**
 * Get a specific media post by ID
 */
export const getMediaById = async (mediaId: number): Promise<MediaPost> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/media/${mediaId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch media: ${error}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching media by ID:', error);
    throw error;
  }
};

/**
 * Delete a media post
 */
export const deleteMedia = async (mediaId: number): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/media/${mediaId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to delete media: ${error}`);
    }
  } catch (error) {
    console.error('Error deleting media:', error);
    throw error;
  }
};

/**
 * Get the full media URL
 */
export const getMediaUrl = (filename: string): string => {
  return `${API_BASE_URL}/media/${filename}`;
};

/**
 * Check if the backend is reachable
 */
export const checkBackendHealth = async (): Promise<boolean> => {
  try {
    console.log('🏥 Checking backend health at:', API_BASE_URL);
    const response = await fetch(`${API_BASE_URL}/`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    const isHealthy = response.ok;
    console.log('🏥 Backend health:', isHealthy ? '✅ Healthy' : '❌ Unhealthy');
    return isHealthy;
  } catch (error) {
    console.error('Backend health check failed:', error);
    return false;
  }
};

// =============================================================================
// COMMENT API FUNCTIONS
// =============================================================================

/**
 * Create a new comment on a media post
 */
export const createComment = async (
  mediaId: number, 
  params: CreateCommentParams
): Promise<Comment> => {
  try {
    console.log('💬 Creating comment for media:', mediaId);
    const response = await fetch(`${API_BASE_URL}/api/media/${mediaId}/comments`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: params.content,
        author_name: params.author_name || 'Anonymous',
        parent_comment_id: params.parent_comment_id || null,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create comment: ${error}`);
    }

    const data = await response.json();
    console.log('✅ Comment created:', data.id);
    return data;
  } catch (error) {
    console.error('Error creating comment:', error);
    throw error;
  }
};

/**
 * Get all comments for a media post
 */
export const getMediaComments = async (
  mediaId: number, 
  skip: number = 0, 
  limit: number = 50
): Promise<CommentWithReplies[]> => {
  try {
    console.log('💬 Fetching comments for media:', mediaId);
    const response = await fetch(
      `${API_BASE_URL}/api/media/${mediaId}/comments?skip=${skip}&limit=${limit}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch comments: ${error}`);
    }

    const data = await response.json();
    console.log('✅ Received comments count:', data.length);
    return data;
  } catch (error) {
    console.error('Error fetching comments:', error);
    throw error;
  }
};

/**
 * Get a specific comment by ID
 */
export const getComment = async (commentId: number): Promise<Comment> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/comments/${commentId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch comment: ${error}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching comment:', error);
    throw error;
  }
};

/**
 * Update a comment's content
 */
export const updateComment = async (
  commentId: number, 
  params: UpdateCommentParams
): Promise<Comment> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/comments/${commentId}`, {
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update comment: ${error}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating comment:', error);
    throw error;
  }
};

/**
 * Delete a comment
 */
export const deleteComment = async (commentId: number): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/comments/${commentId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to delete comment: ${error}`);
    }
  } catch (error) {
    console.error('Error deleting comment:', error);
    throw error;
  }
};

/**
 * Like a comment
 */
export const likeComment = async (
  commentId: number, 
  params: LikeCommentParams = {}
): Promise<{ message: string; like_id: number }> => {
  try {
    console.log('❤️ Liking comment:', commentId);
    const response = await fetch(`${API_BASE_URL}/api/comments/${commentId}/like`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_name: params.user_name || 'Anonymous',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to like comment: ${error}`);
    }

    const data = await response.json();
    console.log('✅ Comment liked');
    return data;
  } catch (error) {
    console.error('Error liking comment:', error);
    throw error;
  }
};

/**
 * Unlike a comment
 */
export const unlikeComment = async (
  commentId: number, 
  userName: string = 'Anonymous'
): Promise<{ message: string }> => {
  try {
    console.log('💔 Unliking comment:', commentId);
    const response = await fetch(
      `${API_BASE_URL}/api/comments/${commentId}/like?user_name=${encodeURIComponent(userName)}`,
      {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to unlike comment: ${error}`);
    }

    const data = await response.json();
    console.log('✅ Comment unliked');
    return data;
  } catch (error) {
    console.error('Error unliking comment:', error);
    throw error;
  }
};

/**
 * Get all likes for a comment
 */
export const getCommentLikes = async (commentId: number): Promise<CommentLike[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/comments/${commentId}/likes`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch comment likes: ${error}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching comment likes:', error);
    throw error;
  }
};

// =============================================================================
// MEDIA LIKES API FUNCTIONS
// =============================================================================

/**
 * Like a media post
 */
export const likeMedia = async (
  mediaId: number, 
  params: LikeMediaParams = {}
): Promise<{ message: string; like_id: number }> => {
  try {
    console.log('❤️ Liking media:', mediaId);
    const response = await fetch(`${API_BASE_URL}/api/media/${mediaId}/like`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_name: params.user_name || 'Anonymous',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to like media: ${error}`);
    }

    const data = await response.json();
    console.log('✅ Media liked');
    return data;
  } catch (error) {
    console.error('Error liking media:', error);
    throw error;
  }
};

/**
 * Unlike a media post
 */
export const unlikeMedia = async (
  mediaId: number, 
  userName: string = 'Anonymous'
): Promise<{ message: string }> => {
  try {
    console.log('💔 Unliking media:', mediaId);
    const response = await fetch(
      `${API_BASE_URL}/api/media/${mediaId}/like?user_name=${encodeURIComponent(userName)}`,
      {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to unlike media: ${error}`);
    }

    const data = await response.json();
    console.log('✅ Media unliked');
    return data;
  } catch (error) {
    console.error('Error unliking media:', error);
    throw error;
  }
};

/**
 * Get all likes for a media post
 */
export const getMediaLikes = async (mediaId: number): Promise<MediaLike[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/media/${mediaId}/likes`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch media likes: ${error}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching media likes:', error);
    throw error;
  }
};
