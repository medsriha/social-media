import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Haptics from 'expo-haptics';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { MediaEditorScreen } from '../components/MediaEditorScreen';
import { saveMediaMetadata, loadMediaMetadata } from '../utils/mediaStorage';
import { deleteMedia as deleteMediaFromBackend, uploadMedia } from '../utils/api';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 24) / 2; // 2 columns with spacing

interface EmojiOverlay {
  id: string;
  emoji: string;
  x: number;
  y: number;
  scale: number;
}

interface MediaItem {
  id?: number; // Backend database ID (only for published media)
  uri: string;
  filename: string;
  timestamp: number;
  type: 'photo' | 'video';
  caption?: string;
  emojis?: EmojiOverlay[];
  published?: boolean;
  segments?: string[];
}

interface MediaGalleryScreenProps {
  onBack?: () => void;
  onRecordMoreSegments?: (existingVideoUri: string, existingSegments?: string[]) => void;
}

export const MediaGalleryScreen: React.FC<MediaGalleryScreenProps> = ({ 
  onBack,
  onRecordMoreSegments,
}) => {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingMedia, setEditingMedia] = useState<MediaItem | null>(null);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);
  const [deleteMode, setDeleteMode] = useState<string | null>(null); // Track which item is in delete mode
  const videoRef = useRef<Video>(null);

  useEffect(() => {
    loadMedia();
  }, []);

  const loadMedia = async () => {
    try {
      const allMedia: MediaItem[] = [];

      // Load public media (with metadata)
      const publicDirectory = `${FileSystem.documentDirectory}public/`;
      const publicDirInfo = await FileSystem.getInfoAsync(publicDirectory);

      if (publicDirInfo.exists) {
        const publicFiles = await FileSystem.readDirectoryAsync(publicDirectory);
        const metadataFiles = publicFiles.filter((file) => file.endsWith('.json'));

        const publicPromises = metadataFiles.map(async (filename) => {
          try {
            const metadataUri = `${publicDirectory}${filename}`;
            const metadataContent = await FileSystem.readAsStringAsync(metadataUri);
            const metadata: MediaItem = JSON.parse(metadataContent);
            return metadata;
          } catch (error) {
            console.error('Error reading public metadata:', error);
            return null;
          }
        });

        const publicResults = await Promise.all(publicPromises);
        const validPublic = publicResults.filter((item): item is MediaItem => item !== null);
        allMedia.push(...validPublic);
      }

      // Load videos (with metadata if available)
      const videoDirectory = `${FileSystem.documentDirectory}videos/`;
      const videoDirInfo = await FileSystem.getInfoAsync(videoDirectory);

      if (!videoDirInfo.exists) {
        await FileSystem.makeDirectoryAsync(videoDirectory, { intermediates: true });
      } else {
        const videoFiles = await FileSystem.readDirectoryAsync(videoDirectory);
        const videoMediaFiles = videoFiles.filter((file) => file.endsWith('.mp4'));
        
        for (const filename of videoMediaFiles) {
          const timestampMatch = filename.match(/video_(\d+)\.mp4/);
          const timestamp = timestampMatch ? parseInt(timestampMatch[1]) : 0;
          
          // Check if metadata exists
          const metadataFilename = filename.replace('.mp4', '.json');
          const metadataUri = `${videoDirectory}${metadataFilename}`;
          
          try {
            const metadataInfo = await FileSystem.getInfoAsync(metadataUri);
            if (metadataInfo.exists) {
              const metadataContent = await FileSystem.readAsStringAsync(metadataUri);
              const metadata: MediaItem = JSON.parse(metadataContent);
              allMedia.push(metadata);
            } else {
              // No metadata, add basic item
              allMedia.push({
                uri: `${videoDirectory}${filename}`,
                filename,
                timestamp,
                type: 'video' as const,
                published: false,
              });
            }
          } catch (error) {
            // If metadata read fails, add basic item
            allMedia.push({
              uri: `${videoDirectory}${filename}`,
              filename,
              timestamp,
              type: 'video' as const,
              published: false,
            });
          }
        }
      }

      // Load photos (with metadata if available)
      const photoDirectory = `${FileSystem.documentDirectory}photos/`;
      const photoDirInfo = await FileSystem.getInfoAsync(photoDirectory);

      if (!photoDirInfo.exists) {
        await FileSystem.makeDirectoryAsync(photoDirectory, { intermediates: true });
      } else {
        const photoFiles = await FileSystem.readDirectoryAsync(photoDirectory);
        const photoMediaFiles = photoFiles.filter((file) => 
          file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.png')
        );
        
        for (const filename of photoMediaFiles) {
          const timestampMatch = filename.match(/photo_(\d+)\.(jpg|jpeg|png)/);
          const timestamp = timestampMatch ? parseInt(timestampMatch[1]) : 0;
          
          // Check if metadata exists
          const metadataFilename = filename.replace(/\.(jpg|jpeg|png)$/, '.json');
          const metadataUri = `${photoDirectory}${metadataFilename}`;
          
          try {
            const metadataInfo = await FileSystem.getInfoAsync(metadataUri);
            if (metadataInfo.exists) {
              const metadataContent = await FileSystem.readAsStringAsync(metadataUri);
              const metadata: MediaItem = JSON.parse(metadataContent);
              allMedia.push(metadata);
            } else {
              // No metadata, add basic item
              allMedia.push({
                uri: `${photoDirectory}${filename}`,
                filename,
                timestamp,
                type: 'photo' as const,
                published: false,
              });
            }
          } catch (error) {
            // If metadata read fails, add basic item
            allMedia.push({
              uri: `${photoDirectory}${filename}`,
              filename,
              timestamp,
              type: 'photo' as const,
              published: false,
            });
          }
        }
      }

      // Sort by timestamp (newest first)
      allMedia.sort((a, b) => b.timestamp - a.timestamp);

      setMediaItems(allMedia);
    } catch (error) {
      console.error('Error loading media:', error);
      Alert.alert('Error', 'Failed to load media');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteMedia = async (media: MediaItem) => {
    // Different warning based on public status
    const title = media.published 
      ? `⚠️ Delete Public ${media.type === 'video' ? 'Video' : 'Photo'}`
      : `Delete ${media.type === 'video' ? 'Video' : 'Photo'}`;
    
    const message = media.published
      ? `This ${media.type} is public and visible to everyone. Deleting it will remove it permanently. Are you sure you want to continue?`
      : `Are you sure you want to delete this ${media.type} from your device?`;
    
    Alert.alert(
      title,
      message,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // If published, try to delete from backend database
              if (media.published) {
                try {
                  // Load metadata to get backend ID
                  const metadata = await loadMediaMetadata(media.uri);
                  
                  if (metadata && metadata.id) {
                    // Delete from backend database
                    console.log('🗑️ Deleting from backend, ID:', metadata.id);
                    await deleteMediaFromBackend(metadata.id);
                    console.log('✅ Deleted from backend database');
                  } else {
                    console.log('⚠️ No backend ID found, skipping backend deletion');
                  }
                } catch (backendError) {
                  console.error('Error deleting from backend:', backendError);
                  // Continue with local deletion even if backend fails
                  Alert.alert(
                    'Warning',
                    'Could not delete from server, but will delete locally. The media may still appear in others\' feeds.'
                  );
                }
              }
              
              // Delete the local media file
              await FileSystem.deleteAsync(media.uri);
              
              // Try to delete metadata file if it exists
              try {
                const extension = media.type === 'photo' ? /\.(jpg|jpeg|png)$/ : /\.mp4$/;
                const metadataUri = media.uri.replace(extension, '.json');
                const metadataInfo = await FileSystem.getInfoAsync(metadataUri);
                if (metadataInfo.exists) {
                  await FileSystem.deleteAsync(metadataUri);
                }
              } catch (metaError) {
                // Metadata doesn't exist or couldn't be deleted, that's okay
                console.log('Metadata file not found or already deleted');
              }
              
              // Use functional update to ensure we have the latest state
              setMediaItems((currentMedia) => currentMedia.filter((m) => m.uri !== media.uri));
              if (selectedMedia?.uri === media.uri) {
                setSelectedMedia(null);
              }
              
              Alert.alert('Success', `${media.type === 'video' ? 'Video' : 'Photo'} deleted successfully`);
            } catch (error) {
              console.error(`Error deleting ${media.type}:`, error);
              Alert.alert('Error', `Failed to delete ${media.type}`);
            }
          },
        },
      ]
    );
  };

  const handleBack = () => {
    if (selectedMedia) {
      setSelectedMedia(null);
      setCurrentSegmentIndex(0);
      setIsCaptionExpanded(false);
    } else if (onBack) {
      onBack();
    }
  };

  const handleVideoPlaybackEnd = () => {
    if (selectedMedia?.segments && selectedMedia.segments.length > 1) {
      const segments = selectedMedia.segments;
      if (currentSegmentIndex < segments.length - 1) {
        // Play next segment
        setCurrentSegmentIndex(currentSegmentIndex + 1);
      } else {
        // Loop back to first segment
        setCurrentSegmentIndex(0);
      }
    }
  };

  const handleEditMedia = async (media: MediaItem) => {
    // Check if media is public
    if (media.published) {
      Alert.alert(
        'Public Media',
        'This media is already public and cannot be edited. Would you like to duplicate it as a new media and edit the copy?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Duplicate & Edit',
            onPress: async () => {
              try {
                // Create a copy of the media
                const timestamp = new Date().getTime();
                const extension = media.type === 'photo' ? 'jpg' : 'mp4';
                const filename = `${media.type}_${timestamp}.${extension}`;
                
                // Determine target directory (private media goes to photos/videos directory)
                const targetDirectory = media.type === 'photo' 
                  ? `${FileSystem.documentDirectory}photos/`
                  : `${FileSystem.documentDirectory}videos/`;
                
                // Ensure directory exists
                const dirInfo = await FileSystem.getInfoAsync(targetDirectory);
                if (!dirInfo.exists) {
                  await FileSystem.makeDirectoryAsync(targetDirectory, { intermediates: true });
                }
                
                const newUri = `${targetDirectory}${filename}`;
                
                // Copy the media file
                await FileSystem.copyAsync({
                  from: media.uri,
                  to: newUri,
                });
                
                // Create new metadata (duplicate caption and emojis, but mark as not public)
                const newMetadata: MediaItem = {
                  uri: newUri,
                  filename,
                  timestamp,
                  type: media.type,
                  caption: media.caption,
                  emojis: media.emojis,
                  published: false,
                  segments: media.segments,
                };
                
                // Save metadata
                const metadataFilename = `${media.type}_${timestamp}.json`;
                const metadataUri = `${targetDirectory}${metadataFilename}`;
                await FileSystem.writeAsStringAsync(metadataUri, JSON.stringify(newMetadata));
                
                // Open the duplicated media for editing
                setEditingMedia(newMetadata);
                setShowEditor(true);
                
                // Reload media to show the new duplicate
                await loadMedia();
              } catch (error) {
                console.error('Error duplicating media:', error);
                Alert.alert('Error', 'Failed to duplicate media');
              }
            },
          },
        ]
      );
    } else {
      // Media is not public, allow editing
      setEditingMedia(media);
      setShowEditor(true);
    }
  };

  const handleEditorBack = () => {
    setShowEditor(false);
    setEditingMedia(null);
  };

  const handleMakePublicFromGallery = async (data: {
    uri: string;
    caption: string;
    emojis: any[];
    type: 'photo' | 'video';
    segments?: string[];
  }) => {
    try {
      if (!editingMedia) return;

      // Request media library permission if not granted
      if (!mediaPermission?.granted) {
        const { status } = await requestMediaPermission();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Media library permission is needed to make this public');
          return;
        }
      }

      // Create public directory
      const publicDirectory = `${FileSystem.documentDirectory}public/`;
      const dirInfo = await FileSystem.getInfoAsync(publicDirectory);
      
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(publicDirectory, { intermediates: true });
      }

      // Generate unique filename
      const timestamp = new Date().getTime();
      const extension = data.type === 'photo' ? 'jpg' : 'mp4';
      const filename = `${data.type}_${timestamp}.${extension}`;
      const newUri = `${publicDirectory}${filename}`;

      // Copy the media to public storage
      await FileSystem.copyAsync({
        from: editingMedia.uri,
        to: newUri,
      });

      // Save metadata
      const metadataFilename = `${data.type}_${timestamp}.json`;
      const metadataUri = `${publicDirectory}${metadataFilename}`;
      
      const metadata: MediaItem = {
        uri: newUri,
        filename,
        timestamp,
        type: data.type,
        caption: data.caption,
        emojis: data.emojis,
        published: true,
        segments: data.segments,
      };

      await FileSystem.writeAsStringAsync(metadataUri, JSON.stringify(metadata));

      // Upload to backend server
      try {
        console.log('Uploading media to backend...', { uri: editingMedia.uri, type: data.type });
        const uploadResult = await uploadMedia({
          fileUri: editingMedia.uri,
          mediaType: data.type,
          caption: data.caption,
          emojis: data.emojis,
          published: true,
        });
        console.log('Media uploaded successfully:', uploadResult);

        // Update local metadata with backend ID
        metadata.id = uploadResult.id;
        await FileSystem.writeAsStringAsync(metadataUri, JSON.stringify(metadata));
      } catch (uploadError) {
        console.error('⚠️ Upload to backend failed:', uploadError);
        // Continue even if upload fails - media is still saved locally
        Alert.alert(
          'Partial Success',
          `Media saved locally but upload to server failed. It won't appear in the public feed until you have a stable connection.`,
          [{ text: 'OK' }]
        );
      }

      // Optionally save to device's media library
      if (Platform.OS !== 'web') {
        try {
          await MediaLibrary.saveToLibraryAsync(editingMedia.uri);
        } catch (mlError) {
          console.error('Error saving to media library:', mlError);
        }
      }

      Alert.alert('Success', `${data.type === 'photo' ? 'Photo' : 'Video'} is now public!`);
      
      // Reload media to show the public item
      await loadMedia();
      
      setShowEditor(false);
      setEditingMedia(null);
      setSelectedMedia(null);
    } catch (error) {
      console.error('Error making public:', error);
      Alert.alert('Error', 'Failed to make media public');
    }
  };

  const handleSaveFromGallery = async (data: {
    uri: string;
    caption: string;
    emojis: any[];
    type: 'photo' | 'video';
    segments?: string[];
  }) => {
    try {
      if (!editingMedia) return;

      // Use the new saveMediaMetadata utility
      const success = await saveMediaMetadata(editingMedia.uri, {
        type: data.type,
        caption: data.caption,
        emojis: data.emojis,
        segments: data.segments,
        published: editingMedia.published || false,
      });

      if (success) {
        Alert.alert('Success', 'Changes saved successfully!');
        
        // Reload media
        await loadMedia();
        
        setShowEditor(false);
        setEditingMedia(null);
        setSelectedMedia(null);
      } else {
        throw new Error('Failed to save metadata');
      }
    } catch (error) {
      console.error('Error saving:', error);
      Alert.alert('Error', 'Failed to save changes');
    }
  };

  const handleDeleteFromEditor = () => {
    if (editingMedia) {
      setShowEditor(false);
      setEditingMedia(null);
      deleteMedia(editingMedia);
    }
  };

  const handleAddSegments = () => {
    if (editingMedia && editingMedia.type === 'video' && onRecordMoreSegments) {
      // Close editor and trigger camera with existing video and its segments
      setShowEditor(false);
      onRecordMoreSegments(editingMedia.uri, editingMedia.segments);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const truncateCaption = (caption: string, maxLength: number = 100) => {
    if (caption.length <= maxLength) return caption;
    return caption.substring(0, maxLength) + '...';
  };

  const renderMediaItem = ({ item, index }: { item: MediaItem; index: number }) => {
    const itemKey = `${item.filename}-${item.timestamp}`;
    const isInDeleteMode = deleteMode === itemKey;

    const handleDelete = () => {
      setDeleteMode(null);
      deleteMedia(item);
    };

    const handlePress = () => {
      if (isInDeleteMode) {
        setDeleteMode(null);
      } else {
        setSelectedMedia(item);
        setCurrentSegmentIndex(0);
        setIsCaptionExpanded(false);
      }
    };

    const handleLongPress = () => {
      // Trigger haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setDeleteMode(itemKey);
    };

    // Create varying heights for masonry effect
    const heights = [220, 280, 250, 300, 240, 270];
    const itemHeight = heights[index % heights.length];

    return (
      <View style={[styles.videoItem, { height: itemHeight }]}>
        <TouchableOpacity
          style={styles.videoTouchable}
          onPress={handlePress}
          onLongPress={handleLongPress}
          delayLongPress={500}
          activeOpacity={0.9}
        >
          {item.type === 'photo' ? (
            <Image source={{ uri: item.uri }} style={styles.thumbnailImage} />
          ) : (
            <View style={styles.thumbnail}>
              <Image source={{ uri: item.uri }} style={styles.thumbnailImage} />
              <View style={styles.playIconOverlay}>
                <MaterialIcons name="play-circle-filled" size={50} color="rgba(255,255,255,0.9)" />
              </View>
            </View>
          )}
          
          {/* Gradient overlay for better text visibility */}
          
          {/* Public/Private badge for gallery - only icon, no text */}
          {!isInDeleteMode && (
            <View style={styles.galleryStatusBadge}>
              <MaterialIcons 
                name={item.published ? "public" : "lock"} 
                size={16} 
                color="#fff" 
              />
            </View>
          )}
          
          {/* Heart and Comments stack - only for public media when not in delete mode */}
          {!isInDeleteMode && item.published && (
            <View style={styles.socialActionsStack}>
              <TouchableOpacity
                style={styles.socialActionButton}
                activeOpacity={0.7}
              >
                <MaterialIcons name="favorite-border" size={22} color="#fff" />
                <Text style={styles.socialActionCount}>0</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.socialActionButton}
                activeOpacity={0.7}
              >
                <MaterialIcons name="chat-bubble-outline" size={22} color="#fff" />
                <Text style={styles.socialActionCount}>0</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.socialActionButton}
                activeOpacity={0.7}
              >
                <MaterialIcons name="attach-money" size={22} color="#fff" />
                <Text style={styles.socialActionCount}>$0</Text> 
              </TouchableOpacity>
            </View>
          )}

          {/* Delete mode overlay - shows when long pressed */}
          {isInDeleteMode && (
            <>
              {/* Dark overlay with pulsing effect */}
              <View style={styles.deleteOverlay} />
              
              {/* Delete confirmation buttons - minimalistic */}
              <View style={styles.deleteActionsContainer}>
                <TouchableOpacity
                  style={styles.confirmDeleteButton}
                  onPress={handleDelete}
                  activeOpacity={0.6}
                >
                  <MaterialIcons name="delete-outline" size={36} color="#ff3b30" />
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.cancelDeleteButton}
                  onPress={() => setDeleteMode(null)}
                  activeOpacity={0.6}
                >
                  <MaterialIcons name="close" size={36} color="#fff" />
                </TouchableOpacity>
              </View>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // Show MediaEditor if editing
  if (showEditor && editingMedia) {
    return (
      <MediaEditorScreen
        mediaUri={editingMedia.uri}
        mediaType={editingMedia.type}
        videoSegments={editingMedia.segments}
        initialCaption={editingMedia.caption}
        initialEmojis={editingMedia.emojis}
        isFromGallery={true}
        onBack={handleEditorBack}
        onAddSegments={editingMedia.type === 'video' ? handleAddSegments : undefined}
        onMakePublic={handleMakePublicFromGallery}
        onSaveToGallery={handleSaveFromGallery}
        onDelete={handleDeleteFromEditor}
      />
    );
  }

  if (selectedMedia) {
    // Determine current video URI based on segments
    const segments = selectedMedia.segments || [selectedMedia.uri];
    const hasMultipleSegments = segments.length > 1;
    const currentVideoUri = segments[currentSegmentIndex];

    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.videoPlayerContainer}>
          {selectedMedia.type === 'video' ? (
            <>
              <Video
                ref={videoRef}
                key={currentVideoUri}
                source={{ uri: currentVideoUri }}
                style={styles.fullVideo}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
                isLooping={!hasMultipleSegments}
                onPlaybackStatusUpdate={(status) => {
                  if (status.isLoaded && status.didJustFinish && hasMultipleSegments) {
                    handleVideoPlaybackEnd();
                  }
                }}
              />
              {hasMultipleSegments && (
                <View style={styles.segmentIndicator}>
                  <MaterialIcons name="video-library" size={16} color="#fff" />
                  <Text style={styles.segmentText}>
                    Segment {currentSegmentIndex + 1} of {segments.length}
                  </Text>
                </View>
              )}
            </>
          ) : (
            <Image
              source={{ uri: selectedMedia.uri }}
              style={styles.fullVideo}
              resizeMode="contain"
            />
          )}
          
          {/* Emoji Overlays */}
          {selectedMedia.emojis?.map((emoji) => (
            <View
              key={emoji.id}
              style={[
                styles.fullscreenEmojiOverlay,
                {
                  left: `${emoji.x * 100}%`,
                  top: `${emoji.y * 100}%`,
                  transform: [{ scale: emoji.scale }],
                },
              ]}
            >
              <Text style={styles.fullscreenEmojiText}>{emoji.emoji}</Text>
            </View>
          ))}
        </View>
        
        {/* Back button - top left */}
        <TouchableOpacity
          style={styles.mediaBackButton}
          onPress={handleBack}
        >
          <MaterialIcons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>

        {/* Edit button - top right */}
        <TouchableOpacity
          style={styles.mediaEditButton}
          onPress={() => handleEditMedia(selectedMedia)}
        >
          <MaterialIcons name="edit" size={24} color="#fff" />
        </TouchableOpacity>

        {/* Caption - TikTok style */}
        {selectedMedia.caption && (
          <View style={styles.captionContainer}>
            <TouchableOpacity onPress={() => setIsCaptionExpanded(!isCaptionExpanded)}>
              <Text style={styles.captionText}>
                {isCaptionExpanded ? selectedMedia.caption : truncateCaption(selectedMedia.caption)}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Date - bottom left corner */}
        <View style={styles.dateContainer}>
          <Text style={styles.videoDate}>
            {formatDate(selectedMedia.timestamp)}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <MaterialIcons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Loading media...</Text>
        </View>
      ) : mediaItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="photo-library" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No media yet</Text>
          <Text style={styles.emptySubtext}>Capture your first photo or video to get started</Text>
        </View>
      ) : (
        <FlatList
          key={`gallery-${mediaItems.length}`}
          data={mediaItems}
          renderItem={renderMediaItem}
          keyExtractor={(item, index) => `${item.filename}-${item.timestamp}-${index}`}
          numColumns={2}
          contentContainerStyle={styles.gridContainer}
          columnWrapperStyle={styles.columnWrapper}
          extraData={mediaItems.length}
          removeClippedSubviews={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#0a0a0a',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSpacer: {
    width: 40,
  },
  gridContainer: {
    padding: 8,
    paddingBottom: 20,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  videoItem: {
    width: COLUMN_WIDTH,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    position: 'relative',
  },
  videoTouchable: {
    width: '100%',
    height: '100%',
  },
  thumbnail: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  playIconOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  userInfoOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userInfo: {
    flex: 1,
    marginRight: 8,
  },
  userName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  userSubtitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '400',
    opacity: 0.9,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  verifiedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(79, 70, 229, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialActionsStack: {
    position: 'absolute',
    top: 12, // Moved to top-right to avoid overlap with user info at bottom
    right: 12,
    flexDirection: 'column',
    gap: 12,
    alignItems: 'flex-end',
  },
  socialActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  socialActionCount: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  deleteOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  deleteActionsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    zIndex: 10,
  },
  cancelDeleteButton: {
    padding: 8,
  },
  confirmDeleteButton: {
    padding: 8,
  },
  galleryStatusBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaTypeIndicator: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  publicBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,200,100,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  fullscreenEmojiOverlay: {
    position: 'absolute',
    zIndex: 10,
  },
  fullscreenEmojiText: {
    fontSize: 40,
  },
  captionText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#fff',
    lineHeight: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ccc',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  videoPlayerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullVideo: {
    flex: 1,
  },
  captionContainer: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  moreButton: {
    marginLeft: 4,
    paddingHorizontal: 4,
  },
  moreButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.8,
  },
  dateContainer: {
    position: 'absolute',
    bottom: 20,
    left: 16,
  },
  videoInfo: {
    backgroundColor: 'transparent',
    padding: 16,
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
  },
  videoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  videoDate: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '400',
    opacity: 0.7,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  mediaBackButton: {
    position: 'absolute',
    top: 60,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  mediaEditButton: {
    position: 'absolute',
    top: 60,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fullVideoControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    backgroundColor: 'transparent',
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    gap: 8,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff0050',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    flex: 1,
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  segmentIndicator: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
    zIndex: 10,
  },
  segmentText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});

