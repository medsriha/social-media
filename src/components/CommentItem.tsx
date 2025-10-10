import React, { useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Alert,
  Pressable,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { 
  CommentWithReplies, 
  Comment,
  likeComment,
  unlikeComment,
  deleteComment,
} from '../utils/api';

interface CommentItemProps {
  comment: CommentWithReplies;
  currentUser: string;
  onReply: (comment: Comment) => void;
  onCommentUpdate: () => void;
  isReply?: boolean;
}

export const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  currentUser,
  onReply,
  onCommentUpdate,
  isReply = false,
}) => {
  // State
  const [isLiked, setIsLiked] = useState(() => {
    return comment.likes.some(like => like.user_name === currentUser);
  });
  const [likesCount, setLikesCount] = useState(comment.likes_count);
  const [showReplies, setShowReplies] = useState(true);
  const [isLiking, setIsLiking] = useState(false);

  // Animations
  const likeScale = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(0)).current;
  const itemOpacity = useRef(new Animated.Value(1)).current;
  const repliesHeight = useRef(new Animated.Value(1)).current;

  // Format time
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
  };

  // Handle like/unlike
  const handleLike = useCallback(async () => {
    if (isLiking) return;
    
    try {
      setIsLiking(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (isLiked) {
        // Unlike
        await unlikeComment(comment.id, currentUser);
        setIsLiked(false);
        setLikesCount(prev => Math.max(0, prev - 1));
        
        // Unlike animation
        Animated.sequence([
          Animated.spring(likeScale, {
            toValue: 0.8,
            useNativeDriver: true,
          }),
          Animated.spring(likeScale, {
            toValue: 1,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        // Like
        await likeComment(comment.id, { user_name: currentUser });
        setIsLiked(true);
        setLikesCount(prev => prev + 1);
        
        // Like animation with floating heart
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        
        Animated.parallel([
          // Button scale
          Animated.sequence([
            Animated.spring(likeScale, {
              toValue: 1.3,
              useNativeDriver: true,
            }),
            Animated.spring(likeScale, {
              toValue: 1,
              useNativeDriver: true,
            }),
          ]),
          // Floating heart
          Animated.sequence([
            Animated.spring(heartScale, {
              toValue: 1,
              useNativeDriver: true,
            }),
            Animated.timing(heartScale, {
              toValue: 0,
              duration: 1500,
              useNativeDriver: true,
            }),
          ]),
        ]).start();
      }

      onCommentUpdate();
    } catch (error) {
      console.error('Error toggling like:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLiking(false);
    }
  }, [isLiked, isLiking, comment.id, currentUser, likeScale, heartScale, onCommentUpdate]);

  // Handle reply
  const handleReply = useCallback(() => {
    onReply(comment);
  }, [comment, onReply]);

  // Toggle replies visibility
  const handleToggleReplies = useCallback(() => {
    setShowReplies(prev => !prev);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    Animated.spring(repliesHeight, {
      toValue: showReplies ? 0 : 1,
      useNativeDriver: false,
    }).start();
  }, [showReplies, repliesHeight]);

  // Handle delete (only for current user's comments)
  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Fade out animation
              Animated.timing(itemOpacity, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
              }).start();

              await deleteComment(comment.id);
              onCommentUpdate();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch (error) {
              console.error('Error deleting comment:', error);
              // Restore opacity if delete fails
              Animated.timing(itemOpacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
              }).start();
            }
          }
        }
      ]
    );
  }, [comment.id, itemOpacity, onCommentUpdate]);

  const isOwnComment = comment.author_name === currentUser;

  return (
    <Animated.View 
      style={[
        styles.container, 
        isReply && styles.replyContainer,
        { opacity: itemOpacity }
      ]}
    >
      {/* Avatar */}
      <View style={[styles.avatar, isReply && styles.replyAvatar]}>
        <LinearGradient
          colors={isOwnComment ? ['#ff0050', '#ff7a00'] : ['#4a90e2', '#7b68ee']}
          style={styles.avatarGradient}
        >
          <Text style={styles.avatarText}>
            {comment.author_name.charAt(0).toUpperCase()}
          </Text>
        </LinearGradient>
      </View>

      {/* Content */}
      <View style={styles.contentContainer}>
        {/* Header */}
        <View style={styles.commentHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.authorName}>{comment.author_name}</Text>
            {isOwnComment && (
              <View style={styles.youBadge}>
                <Text style={styles.youBadgeText}>You</Text>
              </View>
            )}
            <Text style={styles.timeAgo}>{formatTimeAgo(comment.created_at)}</Text>
          </View>
          
          {isOwnComment && (
            <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
              <MaterialIcons name="more-horiz" size={16} color="#888" />
            </TouchableOpacity>
          )}
        </View>

        {/* Comment Text */}
        <Pressable>
          <Text style={styles.commentText}>{comment.content}</Text>
        </Pressable>

        {/* Actions */}
        <View style={styles.actions}>
          <Animated.View style={{ transform: [{ scale: likeScale }] }}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleLike}
              disabled={isLiking}
            >
              <MaterialIcons 
                name={isLiked ? "favorite" : "favorite-border"} 
                size={16} 
                color={isLiked ? "#ff0050" : "#888"} 
              />
              {likesCount > 0 && (
                <Text style={[styles.actionText, isLiked && styles.likedText]}>
                  {likesCount}
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity style={styles.actionButton} onPress={handleReply}>
            <MaterialCommunityIcons name="reply" size={16} color="#888" />
            <Text style={styles.actionText}>Reply</Text>
          </TouchableOpacity>

          {comment.replies && comment.replies.length > 0 && !isReply && (
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={handleToggleReplies}
            >
              <MaterialIcons 
                name={showReplies ? "expand-less" : "expand-more"} 
                size={16} 
                color="#888" 
              />
              <Text style={styles.actionText}>
                {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Floating Heart Animation */}
        <Animated.View 
          style={[
            styles.floatingHeart,
            {
              transform: [
                { scale: heartScale },
                { 
                  translateY: heartScale.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -30],
                  })
                }
              ],
              opacity: heartScale,
            }
          ]}
        >
          <MaterialIcons name="favorite" size={20} color="#ff0050" />
        </Animated.View>

        {/* Replies */}
        {comment.replies && comment.replies.length > 0 && !isReply && (
          <Animated.View 
            style={[
              styles.repliesContainer,
              {
                opacity: repliesHeight,
                transform: [{
                  scaleY: repliesHeight,
                }],
              }
            ]}
          >
            {showReplies && comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={{ ...reply, replies: [] }} // Replies don't have nested replies
                currentUser={currentUser}
                onReply={onReply}
                onCommentUpdate={onCommentUpdate}
                isReply={true}
              />
            ))}
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: 12,
    gap: 12,
  },
  replyContainer: {
    marginLeft: 16,
    paddingLeft: 16,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255,255,255,0.1)',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  authorName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  youBadge: {
    backgroundColor: 'rgba(255,0,80,0.2)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  youBadgeText: {
    color: '#ff0050',
    fontSize: 10,
    fontWeight: 'bold',
  },
  timeAgo: {
    color: '#888',
    fontSize: 12,
  },
  deleteButton: {
    padding: 4,
  },
  commentText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  actionText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '500',
  },
  likedText: {
    color: '#ff0050',
  },
  floatingHeart: {
    position: 'absolute',
    top: -10,
    right: 0,
    zIndex: 10,
  },
  repliesContainer: {
    marginTop: 8,
  },
});