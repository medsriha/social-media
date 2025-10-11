import React, { useState, useEffect } from 'react';
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
import { useCameraRecording } from '../hooks/useCameraRecording';
import { useMediaSaving } from '../hooks/useMediaSaving';
import { styles } from '../styles/MediaRecorderScreen.styles';

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
  // Permissions
  const [permission, requestPermission] = useCameraPermissions();
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();
  
  // Camera state
  const [facing, setFacing] = useState<CameraType>('back');
  const [mode, setMode] = useState<'photo' | 'video'>('video');
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editorMediaUri, setEditorMediaUri] = useState<string | null>(null);
  const [editorMediaType, setEditorMediaType] = useState<'photo' | 'video'>('photo');
  const [originalVideoUri, setOriginalVideoUri] = useState<string | null>(null);
  
  // Custom hooks
  const recording = useCameraRecording();
  const { isUploading, handleMakePublic, handleSaveToGallery } = useMediaSaving({
    mediaPermission,
    requestMediaPermission,
    originalVideoUri,
    onVideoSaved,
    onResetState: () => {
      setShowEditor(false);
      setEditorMediaUri(null);
      setPhotoUri(null);
      setVideoUri(null);
      recording.setVideoSegments([]);
      recording.setRecordingTime(0);
      recording.setIsPaused(false);
      setOriginalVideoUri(null);
    },
  });

  // Load existing video segments when editing
  useEffect(() => {
    if (existingVideoUri) {
      const segments = existingVideoSegments && existingVideoSegments.length > 0 
        ? existingVideoSegments 
        : [existingVideoUri];
      recording.setVideoSegments(segments);
      setOriginalVideoUri(existingVideoUri);
      setMode('video');
    }
  }, [existingVideoUri, existingVideoSegments, recording.setVideoSegments]);

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

  // Camera controls
  const toggleCameraFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const toggleMode = () => {
    setMode((current) => (current === 'photo' ? 'video' : 'photo'));
  };

  const takePhoto = async () => {
    if (recording.cameraRef.current) {
      try {
        const photo = await recording.cameraRef.current.takePictureAsync({
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


  const finishRecording = async () => {
    if (recording.videoSegments.length > 0) {
      const latestSegment = recording.videoSegments[recording.videoSegments.length - 1];
      setEditorMediaUri(latestSegment);
      setEditorMediaType('video');
      setShowEditor(true);
      recording.setIsPaused(false);
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
            const segmentsToKeep = originalVideoUri ? [originalVideoUri] : [];
            recording.setVideoSegments(segmentsToKeep);
            recording.setRecordingTime(0);
            recording.setIsPaused(false);
            if (recording.timerRef.current) {
              clearInterval(recording.timerRef.current);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const saveVideoDirectly = async () => {
    if (recording.videoSegments.length === 0) return;

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
      const sourceUri = recording.videoSegments[recording.videoSegments.length - 1];
      
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
      recording.setVideoSegments([]);
      recording.setRecordingTime(0);
      recording.setIsPaused(false);
    } catch (error) {
      console.error('Error saving video:', error);
      Alert.alert('Error', 'Failed to save video');
    }
  };

  const saveVideo = async () => {
    if (!videoUri && recording.videoSegments.length === 0) return;

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
      const sourceUri = videoUri || recording.videoSegments[recording.videoSegments.length - 1];
      
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
      recording.setVideoSegments([]);
      recording.setRecordingTime(0);
    } catch (error) {
      console.error('Error saving video:', error);
      Alert.alert('Error', 'Failed to save video');
    }
  };

  const discardVideo = () => {
    setVideoUri(null);
    recording.setVideoSegments([]);
    recording.setRecordingTime(0);
    recording.setIsPaused(false);
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

  // Editor handlers
  const handleEditorBack = () => {
    setShowEditor(false);
    setEditorMediaUri(null);
  };

  const handleEditorDelete = () => {
    setShowEditor(false);
    setEditorMediaUri(null);
    setPhotoUri(null);
    setVideoUri(null);
    recording.setVideoSegments([]);
    recording.setRecordingTime(0);
    recording.setIsPaused(false);
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
        videoSegments={editorMediaType === 'video' ? recording.videoSegments : undefined}
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
      <CameraView style={styles.camera} facing={facing} ref={recording.cameraRef} mode={mode === 'photo' ? 'picture' : 'video'}>

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
        {originalVideoUri && recording.videoSegments.length > 0 && (
          <View style={styles.editingIndicator}>
            <MaterialIcons name="edit" size={16} color="#fff" />
            <Text style={styles.editingText}>Adding segments to existing video</Text>
          </View>
        )}
        
        <View style={styles.bottomControls}>
          <View style={styles.leftControl}>
            {!recording.isRecording && !recording.isPaused && (
              <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing}>
                <MaterialIcons name="flip-camera-ios" size={32} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.centerControl}>
            {mode === 'video' ? (
              recording.isPaused ? (
                <>
                  <TouchableOpacity
                    style={styles.doneButton}
                    onPress={finishRecording}
                  >
                    <MaterialIcons name="check" size={24} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.resumeButton}
                    onPress={recording.resumeRecording}
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
                  style={[styles.recordButton, recording.isRecording && styles.recordingButton]}
                  onPress={recording.isRecording ? recording.stopRecording : recording.startRecording}
                >
                  {recording.isRecording ? (
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
        
        {(recording.isRecording || recording.isPaused) && (
          <View style={styles.recordingIndicator}>
            {recording.isRecording && <View style={styles.recordingDot} />}
            <Text style={styles.recordingText}>
              {recording.formatTime(recording.recordingTime)}
            </Text>
            {recording.isPaused && recording.videoSegments.length > 0 && (
              <Text style={styles.segmentText}>• {recording.videoSegments.length} segment{recording.videoSegments.length > 1 ? 's' : ''}</Text>
            )}
          </View>
        )}
        
        {recording.isPaused && (
          <View style={styles.pauseOverlay}>
            <MaterialIcons name="pause" size={80} color="rgba(255,255,255,0.9)" />
          </View>
        )}
      </CameraView>
    </View>
  );
};
