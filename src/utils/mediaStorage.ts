import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';

export interface EmojiOverlay {
  id: string;
  emoji: string;
  x: number;
  y: number;
  scale: number;
}

export interface MediaMetadata {
  uri: string;
  filename: string;
  timestamp: number;
  type: 'photo' | 'video';
  caption?: string;
  emojis?: EmojiOverlay[];
  published?: boolean;
  segments?: string[];
  duration?: number;
  size?: number;
}

/**
 * Get the directory for a specific media type
 */
export const getMediaDirectory = (type: 'photo' | 'video' | 'public'): string => {
  return `${FileSystem.documentDirectory}${type === 'photo' ? 'photos' : type === 'video' ? 'videos' : 'public'}/`;
};

/**
 * Ensure a media directory exists
 */
export const ensureMediaDirectoryExists = async (type: 'photo' | 'video' | 'public'): Promise<void> => {
  const directory = getMediaDirectory(type);
  const dirInfo = await FileSystem.getInfoAsync(directory);

  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  }
};

/**
 * Save metadata for a media item
 * @param mediaUri - URI of the media file
 * @param metadata - Metadata to save (caption, emojis, etc.)
 * @returns Success status
 */
export const saveMediaMetadata = async (
  mediaUri: string,
  metadata: Partial<MediaMetadata>
): Promise<boolean> => {
  try {
    // Determine the directory based on the media URI
    let directory: string;
    if (mediaUri.includes('/public/')) {
      directory = getMediaDirectory('public');
    } else if (mediaUri.includes('/photos/')) {
      directory = getMediaDirectory('photo');
    } else if (mediaUri.includes('/videos/')) {
      directory = getMediaDirectory('video');
    } else {
      throw new Error('Invalid media URI - cannot determine directory');
    }

    // Extract filename from URI
    const uriParts = mediaUri.split('/');
    const mediaFilename = uriParts[uriParts.length - 1];
    
    // Create metadata filename (replace media extension with .json)
    const metadataFilename = mediaFilename.replace(/\.(jpg|jpeg|png|mp4)$/, '.json');
    const metadataUri = `${directory}${metadataFilename}`;

    // Check if metadata already exists and merge with new data
    let existingMetadata: Partial<MediaMetadata> = {};
    try {
      const metadataInfo = await FileSystem.getInfoAsync(metadataUri);
      if (metadataInfo.exists) {
        const metadataContent = await FileSystem.readAsStringAsync(metadataUri);
        existingMetadata = JSON.parse(metadataContent);
      }
    } catch (error) {
      // No existing metadata, that's fine
      console.log('No existing metadata found, creating new');
    }

    // Merge existing metadata with new metadata
    const updatedMetadata: MediaMetadata = {
      uri: mediaUri,
      filename: mediaFilename,
      timestamp: existingMetadata.timestamp || Date.now(),
      type: metadata.type || existingMetadata.type || 'video',
      caption: metadata.caption !== undefined ? metadata.caption : existingMetadata.caption,
      emojis: metadata.emojis !== undefined ? metadata.emojis : existingMetadata.emojis,
      published: metadata.published !== undefined ? metadata.published : existingMetadata.published,
      segments: metadata.segments !== undefined ? metadata.segments : existingMetadata.segments,
      duration: metadata.duration !== undefined ? metadata.duration : existingMetadata.duration,
      size: metadata.size !== undefined ? metadata.size : existingMetadata.size,
    };

    // Write metadata to file
    await FileSystem.writeAsStringAsync(metadataUri, JSON.stringify(updatedMetadata, null, 2));

    return true;
  } catch (error) {
    console.error('Error saving media metadata:', error);
    return false;
  }
};

/**
 * Load metadata for a media item
 * @param mediaUri - URI of the media file
 * @returns Media metadata or null if not found
 */
export const loadMediaMetadata = async (mediaUri: string): Promise<MediaMetadata | null> => {
  try {
    // Extract directory and filename from URI
    const uriParts = mediaUri.split('/');
    const mediaFilename = uriParts[uriParts.length - 1];
    const directory = uriParts.slice(0, -1).join('/') + '/';
    
    // Create metadata filename
    const metadataFilename = mediaFilename.replace(/\.(jpg|jpeg|png|mp4)$/, '.json');
    const metadataUri = `${directory}${metadataFilename}`;

    // Check if metadata exists
    const metadataInfo = await FileSystem.getInfoAsync(metadataUri);
    if (!metadataInfo.exists) {
      return null;
    }

    // Read and parse metadata
    const metadataContent = await FileSystem.readAsStringAsync(metadataUri);
    const metadata: MediaMetadata = JSON.parse(metadataContent);

    return metadata;
  } catch (error) {
    console.error('Error loading media metadata:', error);
    return null;
  }
};

/**
 * Delete metadata for a media item
 * @param mediaUri - URI of the media file
 * @returns Success status
 */
export const deleteMediaMetadata = async (mediaUri: string): Promise<boolean> => {
  try {
    // Extract directory and filename from URI
    const uriParts = mediaUri.split('/');
    const mediaFilename = uriParts[uriParts.length - 1];
    const directory = uriParts.slice(0, -1).join('/') + '/';
    
    // Create metadata filename
    const metadataFilename = mediaFilename.replace(/\.(jpg|jpeg|png|mp4)$/, '.json');
    const metadataUri = `${directory}${metadataFilename}`;

    // Check if metadata exists
    const metadataInfo = await FileSystem.getInfoAsync(metadataUri);
    if (metadataInfo.exists) {
      await FileSystem.deleteAsync(metadataUri);
    }

    return true;
  } catch (error) {
    console.error('Error deleting media metadata:', error);
    return false;
  }
};

/**
 * Save a photo to the app's photo directory
 * @param sourceUri - URI of the photo to save
 * @param metadata - Optional metadata to save with the photo
 * @returns The URI of the saved photo
 */
export const savePhotoToAppStorage = async (
  sourceUri: string,
  metadata?: Partial<MediaMetadata>
): Promise<string> => {
  await ensureMediaDirectoryExists('photo');

  const timestamp = new Date().getTime();
  const filename = `photo_${timestamp}.jpg`;
  const photoDirectory = getMediaDirectory('photo');
  const destinationUri = `${photoDirectory}${filename}`;

  await FileSystem.copyAsync({
    from: sourceUri,
    to: destinationUri,
  });

  // Save metadata if provided
  if (metadata) {
    await saveMediaMetadata(destinationUri, {
      ...metadata,
      type: 'photo',
      timestamp,
      filename,
    });
  }

  return destinationUri;
};

/**
 * Save media to the device's media library
 * @param mediaUri - URI of the media to save
 */
export const saveToMediaLibrary = async (mediaUri: string): Promise<void> => {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  
  if (status !== 'granted') {
    throw new Error('Media library permission not granted');
  }

  await MediaLibrary.saveToLibraryAsync(mediaUri);
};

/**
 * Get all media items from a directory
 * @param type - Type of media to load
 * @returns Array of media metadata
 */
export const getAllMedia = async (type: 'photo' | 'video' | 'public'): Promise<MediaMetadata[]> => {
  await ensureMediaDirectoryExists(type);
  
  const directory = getMediaDirectory(type);
  const files = await FileSystem.readDirectoryAsync(directory);
  
  // Filter for media files
  const mediaFiles = files.filter((file) => {
    if (type === 'photo' || type === 'public') {
      return file.match(/\.(jpg|jpeg|png|mp4)$/);
    }
    return file.endsWith('.mp4');
  });

  const mediaItems: MediaMetadata[] = [];

  for (const filename of mediaFiles) {
    const uri = `${directory}${filename}`;
    
    // Try to load metadata
    const metadata = await loadMediaMetadata(uri);
    
    if (metadata) {
      mediaItems.push(metadata);
    } else {
      // No metadata, create basic item
      const timestampMatch = filename.match(/(\d+)/);
      const timestamp = timestampMatch ? parseInt(timestampMatch[1]) : 0;
      
      const fileInfo = await FileSystem.getInfoAsync(uri);
      
      mediaItems.push({
        uri,
        filename,
        timestamp,
        type: filename.match(/\.(jpg|jpeg|png)$/) ? 'photo' : 'video',
        size: fileInfo.exists && 'size' in fileInfo ? fileInfo.size : undefined,
      });
    }
  }

  // Sort by timestamp (newest first)
  return mediaItems.sort((a, b) => b.timestamp - a.timestamp);
};

/**
 * Delete a media item and its metadata
 * @param mediaUri - URI of the media to delete
 */
export const deleteMedia = async (mediaUri: string): Promise<void> => {
  const fileInfo = await FileSystem.getInfoAsync(mediaUri);
  
  if (fileInfo.exists) {
    await FileSystem.deleteAsync(mediaUri);
  }
  
  // Also delete metadata
  await deleteMediaMetadata(mediaUri);
};

/**
 * Format timestamp to readable date string
 * @param timestamp - Unix timestamp
 * @returns Formatted date string
 */
export const formatMediaDate = (timestamp: number): string => {
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
