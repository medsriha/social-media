import React, { useState, useEffect } from 'react';
import {
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


  const handleModeSwitch = (newMode: 'photo' | 'video') => {
    // Since mode switch is only shown when not actively recording, we only need to check for paused recordings or existing segments
    const hasVideoContent = mode === 'video' && (
      recording.isPaused || 
      recording.videoSegments.length > 0
    );

    if (hasVideoContent) {
      // Show alert for paused recording or existing segments
      showModeSwitchAlert(newMode);
    } else {
      // No video content, safe to switch directly
      setMode(newMode);
    }
  };

  const showModeSwitchAlert = (newMode: 'photo' | 'video') => {
    Alert.alert(
      'Switch Mode?',
      'You have a video recording. What would you like to do?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            // If we paused the recording, resume it
            if (recording.isPaused && !recording.isRecording) {
              recording.resumeRecording();
            }
          },
        },
        {
          text: 'Save & Switch',
          onPress: async () => {
            try {
              // Ensure we have video segments to save
              if (recording.videoSegments.length > 0) {
                const latestSegment = recording.videoSegments[recording.videoSegments.length - 1];
                await saveMediaToGallery(latestSegment, 'video');
                
                // Show success message
                Alert.alert('Success', 'Video saved to gallery!');
              } else {
                Alert.alert('Info', 'No video recording to save');
              }
              
              // Clear recording state and switch mode
              recording.setVideoSegments([]);
              recording.setRecordingTime(0);
              recording.setIsPaused(false);
              if (recording.timerRef.current) {
                clearInterval(recording.timerRef.current);
              }
              setMode(newMode);
            } catch (error) {
              console.error('Error saving recording before mode switch:', error);
              const errorMessage = error instanceof Error ? error.message : 'Failed to save recording. Please try again.';
              Alert.alert('Error', errorMessage);
            }
          },
        },
        {
          text: 'Discard & Switch',
          style: 'destructive',
          onPress: () => {
            // Clear recording state and switch mode
            recording.setVideoSegments([]);
            recording.setRecordingTime(0);
            recording.setIsPaused(false);
            if (recording.timerRef.current) {
              clearInterval(recording.timerRef.current);
            }
            setMode(newMode);
          },
        },
      ],
      { cancelable: true }
    );
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
      'Retake Recording',
      'Are you sure you want to retake this recording? Your current recording will be lost.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Retake',
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


  const savePhoto = async () => {
    if (!photoUri) return;

    // Open editor instead of saving directly
    setEditorMediaUri(photoUri);
    setEditorMediaType('photo');
    setShowEditor(true);
  };

  const saveMediaToGallery = async (mediaUri: string, mediaType: 'photo' | 'video') => {
    try {
      // Request media library permission if not granted
      if (!mediaPermission?.granted) {
        const { status } = await requestMediaPermission();
        if (status !== 'granted') {
          throw new Error(`Media library permission is needed to save ${mediaType}s`);
        }
      }

      // Create a permanent directory for app media
      const mediaDirectory = `${FileSystem.documentDirectory}${mediaType}s/`;
      const dirInfo = await FileSystem.getInfoAsync(mediaDirectory);
      
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(mediaDirectory, { intermediates: true });
      }

      // Generate unique filename
      const timestamp = new Date().getTime();
      const extension = mediaType === 'photo' ? 'jpg' : 'mp4';
      const filename = `${mediaType}_${timestamp}.${extension}`;
      const newUri = `${mediaDirectory}${filename}`;

      // Copy the media to permanent storage
      await FileSystem.copyAsync({
        from: mediaUri,
        to: newUri,
      });

      // Save to device's media library
      if (Platform.OS !== 'web') {
        const asset = await MediaLibrary.saveToLibraryAsync(mediaUri);
        return asset;
      }
      
      return { uri: newUri };
    } catch (error) {
      console.error(`Error saving ${mediaType}:`, error);
      throw error;
    }
  };


  const discardMedia = (mediaType: 'photo' | 'video') => {
    const capitalizedType = mediaType.charAt(0).toUpperCase() + mediaType.slice(1);
    
    Alert.alert(
      `Retake ${capitalizedType}`,
      `Are you sure you want to retake this ${mediaType}? Your current ${mediaType} will be lost.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Retake',
          style: 'destructive',
          onPress: () => {
            if (mediaType === 'photo') {
              setPhotoUri(null);
            } else {
              setVideoUri(null);
              recording.setVideoSegments([]);
              recording.setRecordingTime(0);
              recording.setIsPaused(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const saveMedia = (mediaType: 'photo' | 'video') => {
    if (mediaType === 'photo') {
      savePhoto();
    } else {
      saveVideo();
    }
  };

  const renderMediaPreview = (mediaType: 'photo' | 'video') => {
    const mediaUri = mediaType === 'photo' ? photoUri : videoUri;
    const previewStyle = mediaType === 'photo' ? styles.preview : styles.video;
    const controlsStyle = mediaType === 'photo' ? styles.photoPreviewControls : styles.videoPreviewControls;
    
    if (!mediaUri) {
      return null;
    }
    
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.previewTopControls}>
          <TouchableOpacity style={styles.backButton} onPress={() => handleBackFromMediaPreview(mediaType)}>
            <MaterialIcons name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
        {mediaType === 'photo' ? (
          <Image source={{ uri: mediaUri }} style={previewStyle} resizeMode="contain" />
        ) : (
          <Video
            source={{ uri: mediaUri }}
            style={previewStyle}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            isLooping
          />
        )}
        <View style={controlsStyle}>
          <TouchableOpacity style={styles.retakeButton} onPress={() => discardMedia(mediaType)}>
            <MaterialIcons name="refresh" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.nextButton} onPress={() => saveMedia(mediaType)}>
            <MaterialIcons name="arrow-forward" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
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

  const handleBackFromMediaPreview = (mediaType: 'photo' | 'video') => {
    const mediaUri = mediaType === 'photo' ? photoUri : videoUri;
    const capitalizedType = mediaType.charAt(0).toUpperCase() + mediaType.slice(1);
    
    Alert.alert(
      `Save ${capitalizedType}?`,
      `Do you want to save this ${mediaType} to your gallery before going back?`,
      [
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            if (mediaType === 'photo') {
              setPhotoUri(null);
            } else {
              setVideoUri(null);
              recording.setVideoSegments([]);
              recording.setRecordingTime(0);
              recording.setIsPaused(false);
            }
            if (onBack) {
              onBack();
            }
          },
        },
        {
          text: 'Save & Back',
          onPress: async () => {
            try {
              if (mediaUri) {
                const asset = await saveMediaToGallery(mediaUri, mediaType);
                Alert.alert('Success', `${capitalizedType} saved to gallery!`, [
                  {
                    text: 'OK',
                    onPress: () => {
                      if (mediaType === 'photo') {
                        setPhotoUri(null);
                      } else {
                        setVideoUri(null);
                        recording.setVideoSegments([]);
                        recording.setRecordingTime(0);
                        recording.setIsPaused(false);
                      }
                      if (onBack) {
                        onBack();
                      }
                    },
                  },
                ]);
              } else {
                if (mediaType === 'photo') {
                  setPhotoUri(null);
                } else {
                  setVideoUri(null);
                  recording.setVideoSegments([]);
                  recording.setRecordingTime(0);
                  recording.setIsPaused(false);
                }
                if (onBack) {
                  onBack();
                }
              }
            } catch (error) {
              console.error(`Error saving ${mediaType}:`, error);
              const errorMessage = error instanceof Error ? error.message : `Failed to save ${mediaType} to gallery. Please try again.`;
              Alert.alert('Error', errorMessage);
            }
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  const handleBackFromVideoRecording = () => {
    Alert.alert(
      'Save Recording?',
      'Do you want to save your current recording before going back?',
      [
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            recording.setVideoSegments([]);
            recording.setRecordingTime(0);
            recording.setIsPaused(false);
            if (recording.timerRef.current) {
              clearInterval(recording.timerRef.current);
            }
            if (onBack) {
              onBack();
            }
          },
        },
        {
          text: 'Save & Back',
          onPress: async () => {
            try {
              if (recording.videoSegments.length > 0) {
                // Finish the recording first
                const latestSegment = recording.videoSegments[recording.videoSegments.length - 1];
                const asset = await saveMediaToGallery(latestSegment, 'video');
                Alert.alert('Success', 'Recording saved to gallery!', [
                  {
                    text: 'OK',
                    onPress: () => {
                      recording.setVideoSegments([]);
                      recording.setRecordingTime(0);
                      recording.setIsPaused(false);
                      if (recording.timerRef.current) {
                        clearInterval(recording.timerRef.current);
                      }
                      if (onBack) {
                        onBack();
                      }
                    },
                  },
                ]);
              } else {
                recording.setVideoSegments([]);
                recording.setRecordingTime(0);
                recording.setIsPaused(false);
                if (recording.timerRef.current) {
                  clearInterval(recording.timerRef.current);
                }
                if (onBack) {
                  onBack();
                }
              }
            } catch (error) {
              console.error('Error saving recording:', error);
              const errorMessage = error instanceof Error ? error.message : 'Failed to save recording to gallery. Please try again.';
              Alert.alert('Error', errorMessage);
            }
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
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
        onBack={handleEditorBack}
        onMakePublic={handleMakePublic}
        onSaveToGallery={handleSaveToGallery}
        onDelete={handleEditorDelete}
      />
    );
  }

  if (photoUri) {
    return renderMediaPreview('photo');
  }

  if (videoUri) {
    return renderMediaPreview('video');
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <CameraView style={styles.camera} facing={facing} ref={recording.cameraRef} mode={mode === 'photo' ? 'picture' : 'video'} />

      {/* Top Controls - Positioned absolutely over camera */}
      <View style={styles.topControls}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={
            mode === 'video' && (recording.isRecording || recording.isPaused || recording.videoSegments.length > 0)
              ? handleBackFromVideoRecording
              : handleBack
          }
        >
          <MaterialIcons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        {/* Show mode toggle when not actively recording, or recording indicator when recording */}
        {!recording.isRecording ? (
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'video' && styles.modeButtonActive]}
              onPress={() => handleModeSwitch('video')}
            >
              <MaterialIcons name="videocam" size={20} color={mode === 'video' ? '#fff' : '#999'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'photo' && styles.modeButtonActive]}
              onPress={() => handleModeSwitch('photo')}
            >
              <MaterialIcons name="camera-alt" size={20} color={mode === 'photo' ? '#fff' : '#999'} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.recordingModeIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingModeText}>Recording</Text>
          </View>
        )}
      </View>

      {/* Editing indicator */}
      {originalVideoUri && recording.videoSegments.length > 0 && (
        <View style={styles.editingIndicator}>
          <MaterialIcons name="edit" size={16} color="#fff" />
          <Text style={styles.editingText}>Adding segments to existing video</Text>
        </View>
      )}
      
      {/* Bottom Controls - Positioned absolutely over camera */}
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
                  style={styles.retakeButton}
                  onPress={deleteRecording}
                >
                  <MaterialIcons name="refresh" size={24} color="#fff" />
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
      
      {/* Recording indicator - Positioned absolutely over camera */}
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
      
      {/* Pause overlay - Positioned absolutely over camera */}
      {recording.isPaused && (
        <View style={styles.pauseOverlay}>
          <MaterialIcons name="pause" size={80} color="rgba(255,255,255,0.9)" />
        </View>
      )}
    </View>
  );
};
