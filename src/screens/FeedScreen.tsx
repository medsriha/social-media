import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Alert,
  TouchableWithoutFeedback,
  Animated,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { getAllMedia, API_BASE_URL, MediaPost, getMediaComments, CommentWithReplies } from '../utils/api';
import { CommentsSection } from '../components/CommentsSection';
import { CommentPreview } from '../components/CommentPreview';

const { height, width } = Dimensions.get('window');

interface EmojiOverlay {
  id: string;
  emoji: string;
  x: number;
  y: number;
  scale: number;
}

interface MediaItem {
  id?: number;
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
  const [likedItems, setLikedItems] = useState<Set<number | string>>(new Set());
  const [mutedVideos, setMutedVideos] = useState<Set<number | string>>(new Set());
  const [expandedCaptions, setExpandedCaptions] = useState<Set<number | string>>(new Set());
  const [commentCounts, setCommentCounts] = useState<Map<number, number>>(new Map());
  const [showCommentsFor, setShowCommentsFor] = useState<number | null>(null);
  const [commentPreviews, setCommentPreviews] = useState<Map<number, CommentWithReplies[]>>(new Map());
  const [showPreviewFor, setShowPreviewFor] = useState<number | null>(null);
  const lastTapRef = useRef<number>(0);
  const singleTapTimerRef = useRef<NodeJS.Timeout | null>(null);
  const doubleTapDelay = 300; // milliseconds

  const loadPublicMedia = useCallback(async () => {
    try {
      // Fetch media from backend API
      const mediaPosts = await getAllMedia();
      
      // Transform backend data to MediaItem format
      const transformedMedia: MediaItem[] = mediaPosts.map((post: MediaPost) => {
        let emojis: EmojiOverlay[] = [];
        try {
          emojis = post.emojis ? JSON.parse(post.emojis) : [];
        } catch (e) {
          console.error('Error parsing emojis:', e);
        }

        return {
          id: post.id,
          uri: `${API_BASE_URL}${post.url}`,
          filename: post.filename,
          timestamp: post.timestamp,
          type: post.media_type,
          caption: post.caption || '',
          emojis,
          published: post.published,
        };
      });

      setMediaItems(transformedMedia);
      
      // Load comment counts for each media
      await loadCommentCounts(transformedMedia);
    } catch (error) {
      console.error('Error loading public media from backend:', error);
      Alert.alert(
        'Connection Error',
        'Unable to connect to the server. Please make sure the backend is running.',
        [{ text: 'OK' }]
      );
      setMediaItems([]);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadCommentCounts = async (mediaItems: MediaItem[]) => {
    try {
      const counts = new Map<number, number>();
      const previews = new Map<number, CommentWithReplies[]>();
      
      // Load comment counts for each media item
      await Promise.all(
        mediaItems.map(async (item) => {
          if (item.id) {
            try {
              const comments = await getMediaComments(item.id, 0, 1000); // Get all to count
              const totalCount = comments.reduce((total, comment) => {
                return total + 1 + (comment.replies?.length || 0);
              }, 0);
              counts.set(item.id, totalCount);
              previews.set(item.id, comments.slice(0, 3)); // Store first 3 comments for preview
            } catch (error) {
              console.error(`Error loading comments for media ${item.id}:`, error);
              counts.set(item.id, 0);
              previews.set(item.id, []);
            }
          }
        })
      );
      
      setCommentCounts(counts);
      setCommentPreviews(previews);
    } catch (error) {
      console.error('Error loading comment counts:', error);
    }
  };

  useEffect(() => {
    loadPublicMedia();
  }, [loadPublicMedia]);

  useEffect(() => {
    // Cleanup timer on unmount
    return () => {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
      }
    };
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPublicMedia();
  }, [loadPublicMedia]);

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

  const truncateCaption = (caption: string, maxLength: number = 100) => {
    if (caption.length <= maxLength) return caption;
    return caption.substring(0, maxLength) + '...';
  };

  const toggleCaptionExpansion = useCallback((itemId: number | string | undefined) => {
    if (!itemId) return;
    
    setExpandedCaptions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  const toggleMute = useCallback((itemId: number | string | undefined) => {
    if (!itemId) return;
    
    setMutedVideos((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  const handleLike = useCallback((itemId: number | string | undefined) => {
    if (!itemId) return;
    
    setLikedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
        // Trigger haptic feedback for like
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      return newSet;
    });
  }, []);

  const handleOpenComments = useCallback((mediaId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowCommentsFor(mediaId);
  }, []);

  const handleCloseComments = useCallback(() => {
    setShowCommentsFor(null);
    // Reload comment counts when comments modal is closed
    if (mediaItems.length > 0) {
      loadCommentCounts(mediaItems);
    }
  }, [mediaItems]);

  const handleTap = useCallback((itemId: number | string | undefined, itemType: 'photo' | 'video') => {
    if (!itemId) return;
    
    // Hide comment preview if showing
    if (showPreviewFor) {
      setShowPreviewFor(null);
      return;
    }
    
    // Trigger haptic feedback on every tap
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Clear any existing single tap timer
    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }
    
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;
    
    if (timeSinceLastTap < doubleTapDelay) {
      // Double tap detected - trigger like and stronger vibration
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setLikedItems((prev) => {
        const newSet = new Set(prev);
        if (!newSet.has(itemId)) {
          newSet.add(itemId);
        }
        return newSet;
      });
      lastTapRef.current = 0; // Reset
    } else {
      // Potential single tap - wait to see if another tap comes
      lastTapRef.current = now;
      
      // Only toggle mute for videos, not photos
      if (itemType === 'video') {
        singleTapTimerRef.current = setTimeout(() => {
          toggleMute(itemId);
          singleTapTimerRef.current = null;
        }, doubleTapDelay);
      }
    }
  }, [doubleTapDelay, toggleMute, showPreviewFor]);

  const renderMediaItem = ({ item, index }: { item: MediaItem; index: number }) => {
    const isLiked = item.id ? likedItems.has(item.id) : false;
    const isMuted = item.id ? mutedVideos.has(item.id) : true; // Videos start muted by default
    const isCaptionExpanded = item.id ? expandedCaptions.has(item.id) : false;
    const commentCount = item.id ? commentCounts.get(item.id) || 0 : 0;
    
    return (
    <View style={styles.videoContainer}>
      <TouchableWithoutFeedback onPress={() => handleTap(item.id, item.type)}>
        <View style={styles.mediaWrapper}>
          {item.type === 'video' ? (
            <Video
              source={{ uri: item.uri }}
              style={styles.video}
              resizeMode={ResizeMode.COVER}
              shouldPlay={index === currentIndex}
              isLooping
              useNativeControls={false}
              isMuted={isMuted}
              usePoster={false}
              onError={(error) => {
                console.error('Video error:', error);
                console.error('Video URI:', item.uri);
              }}
              onLoad={() => {
                console.log('Video loaded successfully:', item.uri);
              }}
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
          
          {/* Comment Preview */}
          {item.id && showPreviewFor === item.id && (
            <CommentPreview
              comments={commentPreviews.get(item.id) || []}
              isVisible={showPreviewFor === item.id}
              onPress={() => {
                setShowPreviewFor(null);
                handleOpenComments(item.id!);
              }}
            />
          )}
          
          {/* Mute/Unmute Indicator for Videos */}
          {item.type === 'video' && (
            <View style={styles.muteIndicator}>
              <MaterialIcons 
                name={isMuted ? "volume-off" : "volume-up"} 
                size={24} 
                color="rgba(255,255,255,0.8)" 
              />
            </View>
          )}
          
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.gradient}
          >
            <View style={styles.videoInfo}>
              {item.caption ? (
                <TouchableOpacity onPress={() => toggleCaptionExpansion(item.id)}>
                  <Text style={styles.caption}>
                    {isCaptionExpanded ? item.caption : truncateCaption(item.caption)}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </LinearGradient>
        </View>
      </TouchableWithoutFeedback>

      {/* Right side action buttons */}
      <View style={styles.rightActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleLike(item.id)}
        >
          <MaterialIcons 
            name={isLiked ? "favorite" : "favorite-border"} 
            size={32} 
            color={isLiked ? "#ff0050" : "#fff"} 
          />
          <Text style={styles.actionText}>Like</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => item.id && handleOpenComments(item.id)}
        >
          <MaterialIcons name="comment" size={32} color="#fff" />
          <Text style={styles.actionText}>{commentCount || 'Comment'}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton}>
          <MaterialIcons name="share" size={32} color="#fff" />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="video-library" size={80} color="#666" />
      <Text style={styles.emptyTitle}>Your feed is empty</Text>
      <Text style={styles.emptySubtitle}>
        Start creating and sharing your first post!
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

      {/* Comments Modal */}
      {showCommentsFor && (
        <CommentsSection
          mediaId={showCommentsFor}
          isVisible={showCommentsFor !== null}
          onClose={handleCloseComments}
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
  mediaWrapper: {
    width: '100%',
    height: '100%',
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
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 8,
    lineHeight: 20,
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
  muteIndicator: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
    zIndex: 5,
  },
  rightActions: {
    position: 'absolute',
    right: 12,
    bottom: 200, // Moved higher to avoid caption overlap
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
  floatingCommentButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  floatingCommentGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  floatingCommentText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

