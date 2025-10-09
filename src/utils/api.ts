/**
 * API Service for Social Media Backend
 * Handles all HTTP requests to the Python backend
 */

import { Platform } from 'react-native';

// API Configuration
// For iOS Simulator: localhost works
// For Android Emulator: use 10.0.2.2
// For physical devices: use your computer's local IP (e.g., 192.168.1.100)
const getBaseUrl = (): string => {
  // Using IP address for all platforms to ensure connectivity
  // This works for iOS Simulator, Android Emulator, and Physical Devices
  const API_URL = '<your-ip-address>:8000';
  
  console.log(`📱 Platform: ${Platform.OS}`);
  
  if (Platform.OS === 'android') {
    // Android can also use 'http://10.0.2.2:8000' if on same machine
    return API_URL;
  }
  if (Platform.OS === 'ios') {
    // iOS Simulator - using IP address instead of localhost
    return API_URL;
  }
  // Web - you may want to use 'http://localhost:8000' for web
  return API_URL;
};

export const API_BASE_URL = getBaseUrl();

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
}

export interface UploadMediaParams {
  fileUri: string;
  mediaType: 'photo' | 'video';
  caption?: string;
  emojis?: EmojiOverlay[];
  published?: boolean;
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
