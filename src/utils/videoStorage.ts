import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';

export interface VideoMetadata {
  uri: string;
  filename: string;
  timestamp: number;
  duration?: number;
  size?: number;
}

/**
 * Get the directory where videos are stored
 */
export const getVideoDirectory = (): string => {
  return `${FileSystem.documentDirectory}videos/`;
};

/**
 * Ensure the video directory exists
 */
export const ensureVideoDirectoryExists = async (): Promise<void> => {
  const videoDirectory = getVideoDirectory();
  const dirInfo = await FileSystem.getInfoAsync(videoDirectory);

  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(videoDirectory, { intermediates: true });
  }
};

/**
 * Save a video to the app's video directory
 * @param sourceUri - URI of the video to save
 * @returns The URI of the saved video
 */
export const saveVideoToAppStorage = async (sourceUri: string): Promise<string> => {
  await ensureVideoDirectoryExists();

  const timestamp = new Date().getTime();
  const filename = `video_${timestamp}.mp4`;
  const videoDirectory = getVideoDirectory();
  const destinationUri = `${videoDirectory}${filename}`;

  await FileSystem.copyAsync({
    from: sourceUri,
    to: destinationUri,
  });

  return destinationUri;
};

/**
 * Save a video to the device's media library
 * @param videoUri - URI of the video to save
 */
export const saveVideoToMediaLibrary = async (videoUri: string): Promise<void> => {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  
  if (status !== 'granted') {
    throw new Error('Media library permission not granted');
  }

  await MediaLibrary.saveToLibraryAsync(videoUri);
};

/**
 * Get all videos from the app's video directory
 * @returns Array of video metadata
 */
export const getAllVideos = async (): Promise<VideoMetadata[]> => {
  await ensureVideoDirectoryExists();
  
  const videoDirectory = getVideoDirectory();
  const files = await FileSystem.readDirectoryAsync(videoDirectory);
  const videoFiles = files.filter((file) => file.endsWith('.mp4'));

  const videos: VideoMetadata[] = await Promise.all(
    videoFiles.map(async (filename) => {
      const uri = `${videoDirectory}${filename}`;
      const fileInfo = await FileSystem.getInfoAsync(uri);
      
      const timestampMatch = filename.match(/video_(\d+)\.mp4/);
      const timestamp = timestampMatch ? parseInt(timestampMatch[1]) : 0;

      return {
        uri,
        filename,
        timestamp,
        size: fileInfo.exists && 'size' in fileInfo ? fileInfo.size : undefined,
      };
    })
  );

  // Sort by timestamp (newest first)
  return videos.sort((a, b) => b.timestamp - a.timestamp);
};

/**
 * Delete a video from the app's storage
 * @param videoUri - URI of the video to delete
 */
export const deleteVideo = async (videoUri: string): Promise<void> => {
  const fileInfo = await FileSystem.getInfoAsync(videoUri);
  
  if (fileInfo.exists) {
    await FileSystem.deleteAsync(videoUri);
  }
};

/**
 * Get video file size in MB
 * @param videoUri - URI of the video
 * @returns Size in MB or null if not available
 */
export const getVideoSize = async (videoUri: string): Promise<number | null> => {
  const fileInfo = await FileSystem.getInfoAsync(videoUri);
  
  if (fileInfo.exists && 'size' in fileInfo) {
    return fileInfo.size / (1024 * 1024); // Convert to MB
  }
  
  return null;
};

/**
 * Get total size of all videos in MB
 * @returns Total size in MB
 */
export const getTotalVideosSize = async (): Promise<number> => {
  const videos = await getAllVideos();
  let totalSize = 0;

  for (const video of videos) {
    if (video.size) {
      totalSize += video.size;
    }
  }

  return totalSize / (1024 * 1024); // Convert to MB
};

/**
 * Clear all videos from the app's storage
 */
export const clearAllVideos = async (): Promise<void> => {
  const videoDirectory = getVideoDirectory();
  const dirInfo = await FileSystem.getInfoAsync(videoDirectory);

  if (dirInfo.exists) {
    await FileSystem.deleteAsync(videoDirectory, { idempotent: true });
    await ensureVideoDirectoryExists();
  }
};

/**
 * Format timestamp to readable date string
 * @param timestamp - Unix timestamp
 * @returns Formatted date string
 */
export const formatVideoDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
};

/**
 * Format file size to readable string
 * @param bytes - Size in bytes
 * @returns Formatted size string
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
};

