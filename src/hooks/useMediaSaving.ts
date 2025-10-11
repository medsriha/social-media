import { useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { saveMediaMetadata } from '../utils/mediaStorage';
import { uploadMedia } from '../utils/api';

interface MediaData {
  uri: string;
  caption: string;
  type: 'photo' | 'video';
  segments?: string[];
}

interface UseMediaSavingProps {
  mediaPermission: MediaLibrary.PermissionResponse | null;
  requestMediaPermission: () => Promise<MediaLibrary.PermissionResponse>;
  originalVideoUri: string | null;
  onVideoSaved?: (uri: string) => void;
  onResetState: () => void;
}

interface UseMediaSavingReturn {
  isUploading: boolean;
  handleMakePublic: (data: MediaData) => Promise<void>;
  handleSaveToGallery: (data: MediaData) => Promise<void>;
}

export const useMediaSaving = ({
  mediaPermission,
  requestMediaPermission,
  originalVideoUri,
  onVideoSaved,
  onResetState,
}: UseMediaSavingProps): UseMediaSavingReturn => {
  const [isUploading, setIsUploading] = useState(false);

  const handleMakePublic = async (data: MediaData) => {
    setIsUploading(true);
    try {
      // Request media library permission if not granted
      if (!mediaPermission?.granted) {
        const { status } = await requestMediaPermission();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Media library permission is needed to make this public');
          setIsUploading(false);
          return;
        }
      }

      // Upload media to backend API (PUBLIC)
      console.log('Uploading PUBLIC media to backend...', { uri: data.uri, type: data.type });
      
      const uploadResponse = await uploadMedia({
        fileUri: data.uri,
        mediaType: data.type,
        caption: data.caption,
        emojis: [],
        published: true,
      });

      console.log('Upload successful - media is now public:', uploadResponse);
      console.log('Backend ID received:', uploadResponse.id);

      // Save to device's LOCAL gallery with metadata (published: true)
      const directory = data.type === 'photo' 
        ? `${FileSystem.documentDirectory}photos/`
        : `${FileSystem.documentDirectory}videos/`;
      
      const dirInfo = await FileSystem.getInfoAsync(directory);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      }

      // Generate unique filename for local copy
      const timestamp = new Date().getTime();
      const extension = data.type === 'photo' ? 'jpg' : 'mp4';
      const filename = `${data.type}_${timestamp}.${extension}`;
      const localUri = `${directory}${filename}`;

      // Copy media to local gallery
      await FileSystem.copyAsync({
        from: data.uri,
        to: localUri,
      });

      console.log('💾 Saving metadata with ID:', uploadResponse.id, 'to:', localUri);
      
      // Save metadata with published: true and backend ID
      await saveMediaMetadata(localUri, {
        id: uploadResponse.id,
        type: data.type,
        caption: data.caption,
        emojis: [],
        published: true,
        segments: data.segments,
      });

      // Optionally save to device's media library (Photos app)
      if (Platform.OS !== 'web') {
        try {
          await MediaLibrary.saveToLibraryAsync(data.uri);
        } catch (err) {
          console.log('Could not save to media library:', err);
        }
      }

      // If we were editing an existing video, delete the old one from gallery
      if (originalVideoUri) {
        try {
          await FileSystem.deleteAsync(originalVideoUri);
          const metadataFileName = originalVideoUri.replace(/\.mp4$/, '.json');
          const metadataFileInfo = await FileSystem.getInfoAsync(metadataFileName);
          if (metadataFileInfo.exists) {
            await FileSystem.deleteAsync(metadataFileName);
          }
        } catch (err) {
          console.log('Could not delete original video:', err);
        }
      }

      Alert.alert('Success', `${data.type === 'photo' ? 'Photo' : 'Video'} is now public and saved to your gallery!`);
      
      if (onVideoSaved) {
        onVideoSaved(data.uri);
      }
      
      onResetState();
    } catch (error) {
      console.error('Error making public:', error);
      Alert.alert(
        'Upload Failed', 
        'Failed to upload media to server. Please make sure the backend is running and try again.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveToGallery = async (data: MediaData) => {
    try {
      // Request media library permission if not granted
      if (!mediaPermission?.granted) {
        const { status } = await requestMediaPermission();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Media library permission is needed to save');
          return;
        }
      }

      // If editing existing video, save to the same location and overwrite metadata
      if (originalVideoUri && data.type === 'video') {
        const success = await saveMediaMetadata(originalVideoUri, {
          type: data.type,
          caption: data.caption,
          emojis: [],
          published: false,
          segments: data.segments,
        });

        if (success) {
          Alert.alert('Success', 'Video saved privately to your device!');
        } else {
          throw new Error('Failed to save metadata');
        }
      } else {
        // New media - save to LOCAL gallery (device only)
        const directory = data.type === 'photo' 
          ? `${FileSystem.documentDirectory}photos/`
          : `${FileSystem.documentDirectory}videos/`;
        
        const dirInfo = await FileSystem.getInfoAsync(directory);
        
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
        }

        // Generate unique filename
        const timestamp = new Date().getTime();
        const extension = data.type === 'photo' ? 'jpg' : 'mp4';
        const filename = `${data.type}_${timestamp}.${extension}`;
        const newUri = `${directory}${filename}`;

        // Copy the media to LOCAL gallery storage
        await FileSystem.copyAsync({
          from: data.uri,
          to: newUri,
        });

        // Save metadata with published: false (PRIVATE)
        await saveMediaMetadata(newUri, {
          type: data.type,
          caption: data.caption,
          emojis: [],
          published: false,
          segments: data.segments,
        });

        // Optionally save to device's media library
        if (Platform.OS !== 'web') {
          await MediaLibrary.saveToLibraryAsync(data.uri);
        }

        Alert.alert('Success', `${data.type === 'photo' ? 'Photo' : 'Video'} saved privately to your device!`);
      }
      
      if (onVideoSaved) {
        onVideoSaved(originalVideoUri || data.uri);
      }
      
      onResetState();
    } catch (error) {
      console.error('Error saving to gallery:', error);
      Alert.alert('Error', 'Failed to save media to gallery');
    }
  };

  return {
    isUploading,
    handleMakePublic,
    handleSaveToGallery,
  };
};

