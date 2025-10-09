import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';

const { height, width } = Dimensions.get('window');

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
  caption: string;
  emojis: EmojiOverlay[];
  published: boolean;
  segments?: string[];
}

interface FeedScreenProps {
  onRecordVideo?: () => void;
  onViewGallery?: () => void;
}

export const FeedScreen: React.FC<FeedScreenProps> = ({
  onRecordVideo,
  onViewGallery,
}) => {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const loadPublishedMedia = useCallback(async () => {
    try {
      const publishedDirectory = `${FileSystem.documentDirectory}published/`;
      const dirInfo = await FileSystem.getInfoAsync(publishedDirectory);

      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(publishedDirectory, { intermediates: true });
        setMediaItems([]);
        return;
      }

      const files = await FileSystem.readDirectoryAsync(publishedDirectory);
      const metadataFiles = files.filter((file) => file.endsWith('.json'));

      const mediaPromises = metadataFiles.map(async (filename) => {
        try {
          const metadataUri = `${publishedDirectory}${filename}`;
          const metadataContent = await FileSystem.readAsStringAsync(metadataUri);
          const metadata: MediaItem = JSON.parse(metadataContent);
          return metadata;
        } catch (error) {
          console.error('Error reading metadata:', error);
          return null;
        }
      });

      const mediaResults = await Promise.all(mediaPromises);
      const validMedia = mediaResults.filter((item): item is MediaItem => item !== null);

      // Sort by timestamp (newest first)
      validMedia.sort((a, b) => b.timestamp - a.timestamp);
      setMediaItems(validMedia);
    } catch (error) {
      console.error('Error loading published media:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPublishedMedia();
  }, [loadPublishedMedia]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPublishedMedia();
  }, [loadPublishedMedia]);

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const renderMediaItem = ({ item, index }: { item: MediaItem; index: number }) => (
    <View style={styles.videoContainer}>
      {item.type === 'video' ? (
        <Video
          source={{ uri: item.uri }}
          style={styles.video}
          resizeMode={ResizeMode.COVER}
          shouldPlay={index === currentIndex}
          isLooping
          useNativeControls={false}
        />
      ) : (
        <Image
          source={{ uri: item.uri }}
          style={styles.video}
          resizeMode="cover"
        />
      )}
      
      {/* Emoji Overlays */}
      {item.emojis.map((emoji) => (
        <View
          key={emoji.id}
          style={[
            styles.feedEmojiOverlay,
            {
              left: `${emoji.x * 100}%`,
              top: `${emoji.y * 100}%`,
              transform: [{ scale: emoji.scale }],
            },
          ]}
        >
          <Text style={styles.feedEmojiText}>{emoji.emoji}</Text>
        </View>
      ))}
      
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={styles.gradient}
      >
        <View style={styles.videoInfo}>
          {item.caption ? (
            <Text style={styles.caption}>{item.caption}</Text>
          ) : null}
          <Text style={styles.timeAgo}>{formatTimeAgo(item.timestamp)}</Text>
        </View>
      </LinearGradient>

      {/* Right side action buttons */}
      <View style={styles.rightActions}>
        <TouchableOpacity style={styles.actionButton}>
          <MaterialIcons name="favorite-border" size={32} color="#fff" />
          <Text style={styles.actionText}>Like</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton}>
          <MaterialIcons name="comment" size={32} color="#fff" />
          <Text style={styles.actionText}>Comment</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton}>
          <MaterialIcons name="share" size={32} color="#fff" />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="video-library" size={80} color="#666" />
      <Text style={styles.emptyTitle}>No Posts Yet</Text>
      <Text style={styles.emptySubtitle}>
        Start creating and publishing your first post!
      </Text>
      <TouchableOpacity style={styles.recordBannerButton} onPress={onRecordVideo}>
        <MaterialIcons name="videocam" size={24} color="#fff" />
        <Text style={styles.recordBannerText}>Create Your First Post</Text>
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff0050" />
        <Text style={styles.loadingText}>Loading feed...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Media Feed */}
      {mediaItems.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={mediaItems}
          renderItem={renderMediaItem}
          keyExtractor={(item) => item.uri}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={height}
          snapToAlignment="start"
          decelerationRate="fast"
          onMomentumScrollEnd={(event) => {
            const index = Math.round(event.nativeEvent.contentOffset.y / height);
            setCurrentIndex(index);
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#fff"
            />
          }
        />
      )}

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navButton}>
          <MaterialIcons name="home" size={22} color="#fff" />
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navButton} onPress={onViewGallery}>
          <MaterialIcons name="video-library" size={22} color="#aaa" />
          <Text style={[styles.navText, styles.navTextInactive]}>Gallery</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.createButton} 
          onPress={onRecordVideo}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#ff0050', '#ff7a00']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.createButtonGradient}
          >
            <MaterialIcons name="videocam" size={16} color="#fff" />
            <Text style={styles.createButtonText}>Create</Text>
          </LinearGradient>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navButton}>
          <MaterialIcons name="notifications" size={22} color="#aaa" />
          <Text style={[styles.navText, styles.navTextInactive]}>Inbox</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navButton}>
          <MaterialIcons name="person" size={22} color="#aaa" />
          <Text style={[styles.navText, styles.navTextInactive]}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  videoContainer: {
    width,
    height,
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    justifyContent: 'flex-end',
  },
  videoInfo: {
    padding: 20,
    paddingBottom: 100,
  },
  caption: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    lineHeight: 22,
  },
  timeAgo: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  feedEmojiOverlay: {
    position: 'absolute',
    zIndex: 10,
  },
  feedEmojiText: {
    fontSize: 40,
  },
  rightActions: {
    position: 'absolute',
    right: 12,
    bottom: 120,
    gap: 20,
  },
  actionButton: {
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },
  recordBannerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff0050',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 30,
    gap: 10,
  },
  recordBannerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.95)',
    paddingBottom: 20,
    paddingTop: 8,
    paddingHorizontal: 8,
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  navButton: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    flex: 1,
    paddingVertical: 2,
  },
  navText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
  },
  navTextInactive: {
    color: '#aaa',
  },
  createButton: {
    borderRadius: 20,
    overflow: 'hidden',
    marginHorizontal: 4,
    elevation: 4,
    shadowColor: '#ff0050',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  createButtonGradient: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

