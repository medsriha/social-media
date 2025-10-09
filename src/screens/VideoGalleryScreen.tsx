import React, { useState, useEffect } from 'react';
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
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { MediaEditorScreen } from '../components/MediaEditorScreen';

const { width } = Dimensions.get('window');
const ITEM_SIZE = (width - 32) / 3; // 3 columns with minimal spacing

interface EmojiOverlay {
  id: string;
  emoji: string;
  x: number;
  y: number;
  scale: number;
}

interface MediaItem {
  uri: string;
  filename: string;
  timestamp: number;
  type: 'photo' | 'video';
  caption?: string;
  emojis?: EmojiOverlay[];
  published?: boolean;
  segments?: string[];
}

interface VideoGalleryScreenProps {
  onBack?: () => void;
  onRecordMoreSegments?: (existingVideoUri: string) => void;
}

export const VideoGalleryScreen: React.FC<VideoGalleryScreenProps> = ({ 
  onBack,
  onRecordMoreSegments,
}) => {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingMedia, setEditingMedia] = useState<MediaItem | null>(null);
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();

  useEffect(() => {
    loadMedia();
  }, []);

  const loadMedia = async () => {
    try {
      const allMedia: MediaItem[] = [];

      // Load published media (with metadata)
      const publishedDirectory = `${FileSystem.documentDirectory}published/`;
      const publishedDirInfo = await FileSystem.getInfoAsync(publishedDirectory);

      if (publishedDirInfo.exists) {
        const publishedFiles = await FileSystem.readDirectoryAsync(publishedDirectory);
        const metadataFiles = publishedFiles.filter((file) => file.endsWith('.json'));

        const publishedPromises = metadataFiles.map(async (filename) => {
          try {
            const metadataUri = `${publishedDirectory}${filename}`;
            const metadataContent = await FileSystem.readAsStringAsync(metadataUri);
            const metadata: MediaItem = JSON.parse(metadataContent);
            return metadata;
          } catch (error) {
            console.error('Error reading published metadata:', error);
            return null;
          }
        });

        const publishedResults = await Promise.all(publishedPromises);
        const validPublished = publishedResults.filter((item): item is MediaItem => item !== null);
        allMedia.push(...validPublished);
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
    Alert.alert(
      `Delete ${media.type === 'video' ? 'Video' : 'Photo'}`,
      `Are you sure you want to delete this ${media.type}?`,
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
              // Delete the media file
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
    } else if (onBack) {
      onBack();
    }
  };

  const handleEditMedia = (media: MediaItem) => {
    setEditingMedia(media);
    setShowEditor(true);
  };

  const handleEditorBack = () => {
    setShowEditor(false);
    setEditingMedia(null);
  };

  const handlePublishFromGallery = async (data: {
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
          Alert.alert('Permission Required', 'Media library permission is needed to publish');
          return;
        }
      }

      // Create published directory
      const publishedDirectory = `${FileSystem.documentDirectory}published/`;
      const dirInfo = await FileSystem.getInfoAsync(publishedDirectory);
      
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(publishedDirectory, { intermediates: true });
      }

      // Generate unique filename
      const timestamp = new Date().getTime();
      const extension = data.type === 'photo' ? 'jpg' : 'mp4';
      const filename = `${data.type}_${timestamp}.${extension}`;
      const newUri = `${publishedDirectory}${filename}`;

      // Copy the media to published storage
      await FileSystem.copyAsync({
        from: editingMedia.uri,
        to: newUri,
      });

      // Save metadata
      const metadataFilename = `${data.type}_${timestamp}.json`;
      const metadataUri = `${publishedDirectory}${metadataFilename}`;
      
      const metadata = {
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

      // Optionally save to device's media library
      if (Platform.OS !== 'web') {
        await MediaLibrary.saveToLibraryAsync(editingMedia.uri);
      }

      Alert.alert('Success', `${data.type === 'photo' ? 'Photo' : 'Video'} published to feed!`);
      
      // Reload media to show the published item
      await loadMedia();
      
      setShowEditor(false);
      setEditingMedia(null);
      setSelectedMedia(null);
    } catch (error) {
      console.error('Error publishing:', error);
      Alert.alert('Error', 'Failed to publish media');
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

      // Determine which directory to save metadata to
      const directory = editingMedia.published
        ? `${FileSystem.documentDirectory}published/`
        : data.type === 'photo'
        ? `${FileSystem.documentDirectory}photos/`
        : `${FileSystem.documentDirectory}videos/`;
      
      // Extract timestamp from original filename
      const timestampMatch = editingMedia.filename.match(/(\d+)/);
      const timestamp = timestampMatch ? parseInt(timestampMatch[1]) : Date.now();
      
      // Save metadata
      const metadataFilename = editingMedia.filename.replace(/\.(jpg|jpeg|png|mp4)$/, '.json');
      const metadataUri = `${directory}${metadataFilename}`;
      
      const metadata = {
        uri: editingMedia.uri,
        filename: editingMedia.filename,
        timestamp,
        type: data.type,
        caption: data.caption,
        emojis: data.emojis,
        published: editingMedia.published || false,
        segments: data.segments,
      };

      await FileSystem.writeAsStringAsync(metadataUri, JSON.stringify(metadata));

      Alert.alert('Success', 'Changes saved successfully!');
      
      // Reload media
      await loadMedia();
      
      setShowEditor(false);
      setEditingMedia(null);
      setSelectedMedia(null);
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
      // Close editor and trigger camera with existing video
      setShowEditor(false);
      onRecordMoreSegments(editingMedia.uri);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const renderMediaItem = ({ item, index }: { item: MediaItem; index: number }) => {
    const handleDelete = () => {
      deleteMedia(item);
    };

    const handlePress = () => {
      setSelectedMedia(item);
    };

    return (
      <View style={styles.videoItem}>
        <TouchableOpacity
          style={styles.videoTouchable}
          onPress={handlePress}
          activeOpacity={0.8}
        >
          {item.type === 'photo' ? (
            <Image source={{ uri: item.uri }} style={styles.thumbnailImage} />
          ) : (
            <View style={styles.thumbnail}>
              <MaterialIcons name="play-circle-filled" size={40} color="rgba(255,255,255,0.8)" />
            </View>
          )}
        </TouchableOpacity>
        
        {/* Media type indicator */}
        <View style={styles.mediaTypeIndicator}>
          <MaterialIcons 
            name={item.type === 'video' ? 'videocam' : 'camera-alt'} 
            size={14} 
            color="#fff" 
          />
        </View>
        
        {/* Published badge */}
        {item.published && (
          <View style={styles.publishedBadge}>
            <MaterialIcons name="public" size={12} color="#fff" />
          </View>
        )}
        
        {/* Delete button overlay */}
        <TouchableOpacity
          style={styles.deleteIconButton}
          onPress={handleDelete}
          activeOpacity={0.6}
        >
          <MaterialIcons name="delete-outline" size={18} color="#fff" />
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
        onPublish={handlePublishFromGallery}
        onSaveToGallery={handleSaveFromGallery}
        onDelete={handleDeleteFromEditor}
      />
    );
  }

  if (selectedMedia) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.videoPlayerContainer}>
          {selectedMedia.type === 'video' ? (
            <Video
              source={{ uri: selectedMedia.uri }}
              style={styles.fullVideo}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
            />
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
        
        <View style={styles.videoInfo}>
          {selectedMedia.caption && (
            <Text style={styles.captionText}>{selectedMedia.caption}</Text>
          )}
          <Text style={styles.videoTitle}>{selectedMedia.filename}</Text>
          <Text style={styles.videoDate}>
            {formatDate(selectedMedia.timestamp)}
            {selectedMedia.published && ' • Published'}
          </Text>
        </View>

        <View style={styles.fullVideoControls}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={handleBack}
          >
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
            <Text style={styles.controlButtonText}>Back</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => handleEditMedia(selectedMedia)}
          >
            <MaterialIcons name="edit" size={24} color="#fff" />
            <Text style={styles.controlButtonText}>Edit</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.controlButton, styles.deleteButton]}
            onPress={() => deleteMedia(selectedMedia)}
          >
            <MaterialIcons name="delete" size={24} color="#fff" />
            <Text style={styles.controlButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <MaterialIcons name="arrow-back" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Gallery</Text>
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
          numColumns={3}
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
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
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
    color: '#333',
  },
  headerSpacer: {
    width: 40,
  },
  gridContainer: {
    padding: 8,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  videoItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    position: 'relative',
  },
  videoTouchable: {
    width: '100%',
    height: '100%',
  },
  thumbnail: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
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
  publishedBadge: {
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
  deleteIconButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
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
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    lineHeight: 22,
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
    color: '#666',
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
  videoInfo: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  videoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  videoDate: {
    fontSize: 14,
    color: '#666',
  },
  fullVideoControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
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
  deleteButton: {
    backgroundColor: '#ff3b30',
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
});

