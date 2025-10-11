import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Video, ResizeMode } from 'expo-av';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { MediaEditorScreen } from '../components/MediaEditorScreen';
import { saveMediaMetadata } from '../utils/mediaStorage';
import { uploadMedia } from '../utils/api';

interface MediaRecorderScreenProps {
  onBack?: () => void;
  onVideoSaved?: (uri: string) => void;
  existingVideoUri?: string | null;
  existingVideoSegments?: string[];
}

export const MediaRecorderScreen: React.FC<MediaRecorderScreenProps> = ({
  onBack,
  onVideoSaved,
  existingVideoUri,
  existingVideoSegments,
}) => {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();
  const [mode, setMode] = useState<'photo' | 'video'>('video');
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [videoSegments, setVideoSegments] = useState<string[]>([]);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showEditor, setShowEditor] = useState(false);
  const [editorMediaUri, setEditorMediaUri] = useState<string | null>(null);
  const [editorMediaType, setEditorMediaType] = useState<'photo' | 'video'>('photo');
  const [originalVideoUri, setOriginalVideoUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load existing video segments when editing
  useEffect(() => {
    if (existingVideoUri) {
      // If we have existing segments, use them; otherwise just use the URI
      const segments = existingVideoSegments && existingVideoSegments.length > 0 
        ? existingVideoSegments 
        : [existingVideoUri];
      setVideoSegments(segments);
      setOriginalVideoUri(existingVideoUri);
      setMode('video');
    }
  }, [existingVideoUri, existingVideoSegments]);

  useEffect(() => {
    // Request media library permission on mount
    if (!mediaPermission?.granted) {
      requestMediaPermission();
    }
  }, []);

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <MaterialIcons name="videocam-off" size={80} color="#666" />
        <Text style={styles.message}>Camera Access Required</Text>
        <Text style={styles.submessage}>
          We need camera permission to take photos and record videos
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const toggleCameraFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const toggleMode = () => {
    setMode((current) => (current === 'photo' ? 'video' : 'photo'));
  };

  const takePhoto = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 1,
        });
        
        if (photo && photo.uri) {
          setPhotoUri(photo.uri);
        }
      } catch (error) {
        console.error('Error taking photo:', error);
        Alert.alert('Error', 'Failed to take photo');
      }
    }
  };

  const startRecording = async () => {
    if (cameraRef.current && !isRecording) {
      try {
        setIsRecording(true);
        setIsPaused(false);
        
        // Resume timer from where it left off
        timerRef.current = setInterval(() => {
          setRecordingTime((prev) => prev + 1);
        }, 1000);
        
        const video = await cameraRef.current.recordAsync({
          maxDuration: 60, // 60 seconds max
        });
        
        if (video && video.uri) {
          // Add segment to list
          setVideoSegments((prev) => [...prev, video.uri]);
        }
      } catch (error) {
        console.error('Error recording video:', error);
        Alert.alert('Error', 'Failed to record video');
      } finally {
        setIsRecording(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      }
    }
  };

  const stopRecording = () => {
    if (cameraRef.current && isRecording) {
      setIsPaused(true);
      cameraRef.current.stopRecording();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const resumeRecording = () => {
    if (isPaused && !isRecording) {
      startRecording();
    }
  };

  const finishRecording = async () => {
    // Open editor for video
    if (videoSegments.length > 0) {
      // Use the most recent segment for preview
      // But we'll pass all segments to the editor for proper handling
      const latestSegment = videoSegments[videoSegments.length - 1];
      
      setEditorMediaUri(latestSegment);
      setEditorMediaType('video');
      setShowEditor(true);
      setIsPaused(false);
    }
  };

  const deleteRecording = () => {
    Alert.alert(
      'Delete Recording',
      'Are you sure you want to delete this recording? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // Clear new recordings but keep original video if editing
            const segmentsToKeep = originalVideoUri ? [originalVideoUri] : [];
            setVideoSegments(segmentsToKeep);
            setRecordingTime(0);
            setIsPaused(false);
            if (timerRef.current) {
              clearInterval(timerRef.current);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const saveVideoDirectly = async () => {
    if (videoSegments.length === 0) return;

    try {
      // Request media library permission if not granted
      if (!mediaPermission?.granted) {
        const { status } = await requestMediaPermission();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Media library permission is needed to save videos');
          return;
        }
      }

      // Create a permanent directory for app videos
      const videoDirectory = `${FileSystem.documentDirectory}videos/`;
      const dirInfo = await FileSystem.getInfoAsync(videoDirectory);
      
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(videoDirectory, { intermediates: true });
      }

      // Use the last segment
      const sourceUri = videoSegments[videoSegments.length - 1];
      
      // Generate unique filename
      const timestamp = new Date().getTime();
      const filename = `video_${timestamp}.mp4`;
      const newUri = `${videoDirectory}${filename}`;

      // Copy the video to permanent storage
      await FileSystem.copyAsync({
        from: sourceUri,
        to: newUri,
      });

      // Optionally save to device's media library
      if (Platform.OS !== 'web') {
        await MediaLibrary.saveToLibraryAsync(sourceUri);
      }

      Alert.alert('Success', 'Video saved successfully!');
      
      if (onVideoSaved) {
        onVideoSaved(newUri);
      }
      
      // Reset state
      setVideoSegments([]);
      setRecordingTime(0);
      setIsPaused(false);
    } catch (error) {
      console.error('Error saving video:', error);
      Alert.alert('Error', 'Failed to save video');
    }
  };

  const saveVideo = async () => {
    if (!videoUri && videoSegments.length === 0) return;

    try {
      // Request media library permission if not granted
      if (!mediaPermission?.granted) {
        const { status } = await requestMediaPermission();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Media library permission is needed to save videos');
          return;
        }
      }

      // Create a permanent directory for app videos
      const videoDirectory = `${FileSystem.documentDirectory}videos/`;
      const dirInfo = await FileSystem.getInfoAsync(videoDirectory);
      
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(videoDirectory, { intermediates: true });
      }

      // Use the last segment or the preview video
      const sourceUri = videoUri || videoSegments[videoSegments.length - 1];
      
      // Generate unique filename
      const timestamp = new Date().getTime();
      const filename = `video_${timestamp}.mp4`;
      const newUri = `${videoDirectory}${filename}`;

      // Copy the video to permanent storage
      await FileSystem.copyAsync({
        from: sourceUri,
        to: newUri,
      });

      // Optionally save to device's media library
      if (Platform.OS !== 'web') {
        await MediaLibrary.saveToLibraryAsync(sourceUri);
      }

      Alert.alert('Success', 'Video saved successfully!');
      
      if (onVideoSaved) {
        onVideoSaved(newUri);
      }
      
      // Reset state
      setVideoUri(null);
      setVideoSegments([]);
      setRecordingTime(0);
    } catch (error) {
      console.error('Error saving video:', error);
      Alert.alert('Error', 'Failed to save video');
    }
  };

  const discardVideo = () => {
    setVideoUri(null);
    setVideoSegments([]);
    setRecordingTime(0);
    setIsPaused(false);
  };

  const savePhoto = async () => {
    if (!photoUri) return;

    // Open editor instead of saving directly
    setEditorMediaUri(photoUri);
    setEditorMediaType('photo');
    setShowEditor(true);
  };

  const discardPhoto = () => {
    setPhotoUri(null);
  };

  const handleMakePublic = async (data: {
    uri: string;
    caption: string;
    emojis: any[];
    type: 'photo' | 'video';
    segments?: string[];
  }) => {
    setIsUploading(true);
    try {
      // ========================================
      // IMPORTANT: This UPLOADS media to BACKEND
      // Media becomes PUBLIC and stored in database
      // All users can see it in the feed
      // ========================================
      
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
        emojis: data.emojis,
        published: true, // PUBLIC - uploads to backend database
      });

      console.log('Upload successful - media is now public:', uploadResponse);
      console.log('Backend ID received:', uploadResponse.id);

      // Save to device's LOCAL gallery with metadata (published: true)
      // This ensures the user has their own copy even after publishing
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
      const metadataSaved = await saveMediaMetadata(localUri, {
        id: uploadResponse.id, // Save backend database ID
        type: data.type,
        caption: data.caption,
        emojis: data.emojis,
        published: true, // Mark as published
        segments: data.segments,
      });
      
      console.log('Metadata saved:', metadataSaved);

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
          // Try to delete metadata if it exists
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
      
      // Reset all state
      setShowEditor(false);
      setEditorMediaUri(null);
      setPhotoUri(null);
      setVideoUri(null);
      setVideoSegments([]);
      setRecordingTime(0);
      setIsPaused(false);
      setOriginalVideoUri(null);
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

  const handleEditorBack = () => {
    setShowEditor(false);
    setEditorMediaUri(null);
  };

  const handleSaveToGallery = async (data: {
    uri: string;
    caption: string;
    emojis: any[];
    type: 'photo' | 'video';
    segments?: string[];
  }) => {
    try {
      // ========================================
      // IMPORTANT: This saves media LOCALLY ONLY
      // Media is NOT uploaded to backend
      // It stays private on the user's device
      // ========================================
      
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
        // Use the new saveMediaMetadata utility
        const success = await saveMediaMetadata(originalVideoUri, {
          type: data.type,
          caption: data.caption,
          emojis: data.emojis,
          published: false, // PRIVATE - stays on device
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
          emojis: data.emojis,
          published: false, // PRIVATE - stays on device, NOT uploaded
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
      
      // Reset all state
      setShowEditor(false);
      setEditorMediaUri(null);
      setPhotoUri(null);
      setVideoUri(null);
      setVideoSegments([]);
      setRecordingTime(0);
      setIsPaused(false);
      setOriginalVideoUri(null);
    } catch (error) {
      console.error('Error saving to gallery:', error);
      Alert.alert('Error', 'Failed to save media to gallery');
    }
  };

  const handleEditorDelete = () => {
    // Simply close the editor and discard
    setShowEditor(false);
    setEditorMediaUri(null);
    setPhotoUri(null);
    setVideoUri(null);
    setVideoSegments([]);
    setRecordingTime(0);
    setIsPaused(false);
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    }
  };

  // Show uploading indicator
  if (isUploading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#ff0050" />
        <Text style={styles.message}>Uploading to server...</Text>
        <Text style={styles.submessage}>Please wait while we make your media public</Text>
      </View>
    );
  }

  // Show MediaEditor if user is editing
  if (showEditor && editorMediaUri) {
    return (
      <MediaEditorScreen
        mediaUri={editorMediaUri}
        mediaType={editorMediaType}
        videoSegments={editorMediaType === 'video' ? videoSegments : undefined}
        initialCaption=""
        initialEmojis={[]}
        onBack={handleEditorBack}
        onMakePublic={handleMakePublic}
        onSaveToGallery={handleSaveToGallery}
        onDelete={handleEditorDelete}
      />
    );
  }

  if (photoUri) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="contain" />
        <View style={styles.photoPreviewControls}>
          <TouchableOpacity style={styles.deleteButton} onPress={discardPhoto}>
            <MaterialIcons name="delete" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.doneButton} onPress={savePhoto}>
            <MaterialIcons name="check" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (videoUri) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <Video
          source={{ uri: videoUri }}
          style={styles.video}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
          isLooping
        />
        <View style={styles.previewControls}>
          <TouchableOpacity style={styles.previewButton} onPress={discardVideo}>
            <MaterialIcons name="close" size={32} color="#fff" />
            <Text style={styles.previewButtonText}>Discard</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.previewButton} onPress={saveVideo}>
            <MaterialIcons name="check" size={32} color="#fff" />
            <Text style={styles.previewButtonText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <CameraView style={styles.camera} facing={facing} ref={cameraRef} mode={mode === 'photo' ? 'picture' : 'video'}>
        <View style={styles.topControls}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <MaterialIcons name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'video' && styles.modeButtonActive]}
              onPress={() => setMode('video')}
            >
              <MaterialIcons name="videocam" size={20} color={mode === 'video' ? '#fff' : '#999'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'photo' && styles.modeButtonActive]}
              onPress={() => setMode('photo')}
            >
              <MaterialIcons name="camera-alt" size={20} color={mode === 'photo' ? '#fff' : '#999'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Editing indicator */}
        {originalVideoUri && videoSegments.length > 0 && (
          <View style={styles.editingIndicator}>
            <MaterialIcons name="edit" size={16} color="#fff" />
            <Text style={styles.editingText}>Adding segments to existing video</Text>
          </View>
        )}
        
        <View style={styles.bottomControls}>
          <View style={styles.leftControl}>
            {!isRecording && !isPaused && (
              <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing}>
                <MaterialIcons name="flip-camera-ios" size={32} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.centerControl}>
            {mode === 'video' ? (
              isPaused ? (
                <>
                  <TouchableOpacity
                    style={styles.doneButton}
                    onPress={finishRecording}
                  >
                    <MaterialIcons name="check" size={24} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.resumeButton}
                    onPress={resumeRecording}
                  >
                    <MaterialIcons name="fiber-manual-record" size={24} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={deleteRecording}
                  >
                    <MaterialIcons name="delete" size={24} color="#fff" />
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.recordButton, isRecording && styles.recordingButton]}
                  onPress={isRecording ? stopRecording : startRecording}
                >
                  {isRecording ? (
                    <View style={styles.stopIcon} />
                  ) : (
                    <View style={styles.recordIcon} />
                  )}
                </TouchableOpacity>
              )
            ) : (
              <TouchableOpacity
                style={styles.captureButton}
                onPress={takePhoto}
              >
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.rightControl} />
        </View>
        
        {(isRecording || isPaused) && (
          <View style={styles.recordingIndicator}>
            {isRecording && <View style={styles.recordingDot} />}
            <Text style={styles.recordingText}>
              {formatTime(recordingTime)}
            </Text>
            {isPaused && videoSegments.length > 0 && (
              <Text style={styles.segmentText}>• {videoSegments.length} segment{videoSegments.length > 1 ? 's' : ''}</Text>
            )}
          </View>
        )}
        
        {isPaused && (
          <View style={styles.pauseOverlay}>
            <MaterialIcons name="pause" size={80} color="rgba(255,255,255,0.9)" />
          </View>
        )}
      </CameraView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  message: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 8,
  },
  submessage: {
    textAlign: 'center',
    fontSize: 16,
    color: '#999',
    marginBottom: 32,
  },
  camera: {
    flex: 1,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 22,
    padding: 4,
    gap: 4,
  },
  modeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  editingIndicator: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 199, 89, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  editingText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  leftControl: {
    flex: 1,
    alignItems: 'flex-start',
  },
  centerControl: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  rightControl: {
    flex: 1,
  },
  flipButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  recordButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 5,
    borderColor: '#fff',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  recordingButton: {
    backgroundColor: 'rgba(255,0,0,0.3)',
  },
  recordIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ff0000',
  },
  stopIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#ff0000',
  },
  recordingIndicator: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff0000',
    marginRight: 6,
  },
  recordingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  segmentText: {
    color: '#fff',
    fontSize: 10,
    marginLeft: 6,
  },
  pauseOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -40 }, { translateY: -100 }],
    justifyContent: 'center',
    alignItems: 'center',
  },
  resumeButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff0050',
    elevation: 3,
    shadowColor: '#ff0050',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  doneButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34C759',
    elevation: 3,
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  deleteButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff3b30',
    elevation: 3,
    shadowColor: '#ff3b30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  captureButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 5,
    borderColor: '#fff',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  captureButtonInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
  },
  preview: {
    flex: 1,
  },
  video: {
    flex: 1,
  },
  photoPreviewControls: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  previewControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  previewButton: {
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 50,
    minWidth: 100,
  },
  previewButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  button: {
    backgroundColor: '#ff0050',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
    elevation: 5,
    shadowColor: '#ff0050',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});

