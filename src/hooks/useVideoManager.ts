import { useState, useEffect, useCallback } from 'react';
import {
  getAllVideos,
  deleteVideo,
  saveVideoToAppStorage,
  saveVideoToMediaLibrary,
  getTotalVideosSize,
  VideoMetadata,
} from '../utils/videoStorage';

interface UseVideoManagerReturn {
  videos: VideoMetadata[];
  isLoading: boolean;
  error: string | null;
  totalSize: number;
  refreshVideos: () => Promise<void>;
  saveVideo: (sourceUri: string, saveToGallery?: boolean) => Promise<string | null>;
  removeVideo: (videoUri: string) => Promise<boolean>;
  getStorageInfo: () => Promise<number>;
}

/**
 * Custom hook for managing video storage and operations
 * 
 * @example
 * ```tsx
 * const { videos, isLoading, saveVideo, removeVideo } = useVideoManager();
 * 
 * // Save a video
 * const uri = await saveVideo(recordedVideoUri, true);
 * 
 * // Delete a video
 * await removeVideo(videoUri);
 * ```
 */
export const useVideoManager = (): UseVideoManagerReturn => {
  const [videos, setVideos] = useState<VideoMetadata[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [totalSize, setTotalSize] = useState<number>(0);

  /**
   * Load all videos from storage
   */
  const loadVideos = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const loadedVideos = await getAllVideos();
      setVideos(loadedVideos);
      
      // Update total storage size
      const size = await getTotalVideosSize();
      setTotalSize(size);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load videos';
      setError(errorMessage);
      console.error('Error loading videos:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Refresh the video list
   */
  const refreshVideos = useCallback(async () => {
    await loadVideos();
  }, [loadVideos]);

  /**
   * Save a video to storage
   * @param sourceUri - URI of the video to save
   * @param saveToGallery - Whether to also save to device gallery
   * @returns The URI of the saved video or null if failed
   */
  const saveVideo = useCallback(
    async (sourceUri: string, saveToGallery: boolean = true): Promise<string | null> => {
      try {
        setError(null);
        
        // Save to app storage
        const savedUri = await saveVideoToAppStorage(sourceUri);

        // Optionally save to device gallery
        if (saveToGallery) {
          try {
            await saveVideoToMediaLibrary(sourceUri);
          } catch (galleryError) {
            console.warn('Failed to save to gallery:', galleryError);
            // Don't throw error if only gallery save fails
          }
        }

        // Refresh the video list
        await loadVideos();

        return savedUri;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to save video';
        setError(errorMessage);
        console.error('Error saving video:', err);
        return null;
      }
    },
    [loadVideos]
  );

  /**
   * Remove a video from storage
   * @param videoUri - URI of the video to delete
   * @returns true if successful, false otherwise
   */
  const removeVideo = useCallback(
    async (videoUri: string): Promise<boolean> => {
      try {
        setError(null);
        await deleteVideo(videoUri);
        
        // Update local state immediately for better UX
        setVideos((prevVideos) => prevVideos.filter((v) => v.uri !== videoUri));
        
        // Refresh to update storage size
        const size = await getTotalVideosSize();
        setTotalSize(size);
        
        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to delete video';
        setError(errorMessage);
        console.error('Error deleting video:', err);
        return false;
      }
    },
    []
  );

  /**
   * Get current storage information
   * @returns Total storage size in MB
   */
  const getStorageInfo = useCallback(async (): Promise<number> => {
    try {
      const size = await getTotalVideosSize();
      setTotalSize(size);
      return size;
    } catch (err) {
      console.error('Error getting storage info:', err);
      return 0;
    }
  }, []);

  // Load videos on mount
  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  return {
    videos,
    isLoading,
    error,
    totalSize,
    refreshVideos,
    saveVideo,
    removeVideo,
    getStorageInfo,
  };
};

/**
 * Hook for managing camera permissions
 */
export const useCameraPermissions = () => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const requestPermission = useCallback(async () => {
    try {
      // This will be implemented when expo-camera is properly installed
      // For now, return null to indicate permission needs to be checked
      return null;
    } catch (err) {
      console.error('Error requesting camera permission:', err);
      return false;
    }
  }, []);

  return {
    hasPermission,
    requestPermission,
  };
};

