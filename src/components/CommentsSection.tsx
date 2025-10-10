import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { 
  getMediaComments, 
  createComment, 
  CommentWithReplies, 
  Comment,
} from '../utils/api';
import { CommentItem } from './CommentItem';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

interface CommentsSectionProps {
  mediaId: number;
  isVisible: boolean;
  onClose: () => void;
}

export const CommentsSection: React.FC<CommentsSectionProps> = ({
  mediaId,
  isVisible,
  onClose,
}) => {
  // State
  const [comments, setComments] = useState<CommentWithReplies[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [userName] = useState('You'); // In a real app, this would come from auth

  // Animations
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const inputScale = useRef(new Animated.Value(1)).current;
  const headerOpacity = useRef(new Animated.Value(1)).current;

  // Refs
  const inputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // Load comments
  const loadComments = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true);
      const fetchedComments = await getMediaComments(mediaId, 0, 100);
      setComments(fetchedComments);
    } catch (error) {
      console.error('Error loading comments:', error);
      Alert.alert('Error', 'Failed to load comments. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [mediaId]);

  // Refresh comments
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadComments(false);
  }, [loadComments]);

  // Show/hide animations
  useEffect(() => {
    if (isVisible) {
      // Show animation
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Load comments when modal opens
      loadComments();
    } else {
      // Hide animation
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: SCREEN_HEIGHT,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible, slideAnim, overlayOpacity, loadComments]);

  // Keyboard handling
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        // Scale input slightly when keyboard shows
        Animated.spring(inputScale, {
          toValue: 1.02,
          useNativeDriver: true,
        }).start();
      }
    );

    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
        Animated.spring(inputScale, {
          toValue: 1,
          useNativeDriver: true,
        }).start();
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [inputScale]);

  // Submit comment
  const handleSubmitComment = useCallback(async () => {
    if (!commentText.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      await createComment(mediaId, {
        content: commentText.trim(),
        author_name: userName,
        parent_comment_id: replyingTo?.id || null,
      });

      // Clear input and reset state
      setCommentText('');
      setReplyingTo(null);
      
      // Reload comments
      await loadComments(false);
      
      // Success animation
      Animated.sequence([
        Animated.spring(inputScale, {
          toValue: 0.95,
          useNativeDriver: true,
        }),
        Animated.spring(inputScale, {
          toValue: 1,
          useNativeDriver: true,
        }),
      ]).start();

      // Scroll to bottom to show new comment
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);

    } catch (error) {
      console.error('Error submitting comment:', error);
      Alert.alert('Error', 'Failed to post comment. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSubmitting(false);
    }
  }, [commentText, isSubmitting, mediaId, userName, replyingTo, loadComments, inputScale]);

  // Handle reply
  const handleReply = useCallback((comment: Comment) => {
    setReplyingTo(comment);
    setCommentText(`@${comment.author_name} `);
    inputRef.current?.focus();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Cancel reply
  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
    setCommentText('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Close modal
  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    onClose();
    // Clear reply state when closing
    setTimeout(() => {
      setReplyingTo(null);
      setCommentText('');
    }, 300);
  }, [onClose]);

  // Pan gesture for swipe to close
  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: slideAnim } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = ({ nativeEvent }: any) => {
    if (nativeEvent.oldState === State.ACTIVE) {
      const { translationY, velocityY } = nativeEvent;
      
      if (translationY > 100 || velocityY > 1000) {
        // Close modal
        handleClose();
      } else {
        // Snap back
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    }
  };

  if (!isVisible) return null;

  return (
    <View style={styles.container}>
      {/* Overlay */}
      <Animated.View 
        style={[styles.overlay, { opacity: overlayOpacity }]}
      >
        <TouchableOpacity 
          style={styles.overlayTouch} 
          onPress={handleClose}
          activeOpacity={1}
        />
      </Animated.View>

      {/* Comments Modal */}
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
      >
        <Animated.View 
          style={[
            styles.modal,
            {
              transform: [{ translateY: slideAnim }],
              paddingBottom: keyboardHeight,
            },
          ]}
        >
          {/* Header */}
          <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
            <View style={styles.handle} />
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>
                Comments ({comments.reduce((total, comment) => 
                  total + 1 + (comment.replies?.length || 0), 0
                )})
              </Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <MaterialIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Comments List */}
          <View style={styles.commentsContainer}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#ff0050" />
                <Text style={styles.loadingText}>Loading comments...</Text>
              </View>
            ) : comments.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons 
                  name="comment-outline" 
                  size={60} 
                  color="#666" 
                />
                <Text style={styles.emptyTitle}>No comments yet</Text>
                <Text style={styles.emptySubtitle}>
                  Be the first to share your thoughts!
                </Text>
              </View>
            ) : (
              <ScrollView
                ref={scrollViewRef}
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={handleRefresh}
                    tintColor="#ff0050"
                  />
                }
              >
                {comments.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    currentUser={userName}
                    onReply={handleReply}
                    onCommentUpdate={() => loadComments(false)}
                  />
                ))}
                <View style={styles.bottomSpacing} />
              </ScrollView>
            )}
          </View>

          {/* Reply Banner */}
          {replyingTo && (
            <Animated.View style={styles.replyBanner}>
              <LinearGradient
                colors={['rgba(255,0,80,0.1)', 'rgba(255,122,0,0.1)']}
                style={styles.replyBannerGradient}
              >
                <MaterialIcons name="reply" size={16} color="#ff0050" />
                <Text style={styles.replyText}>
                  Replying to @{replyingTo.author_name}
                </Text>
                <TouchableOpacity onPress={handleCancelReply}>
                  <MaterialIcons name="close" size={16} color="#ff0050" />
                </TouchableOpacity>
              </LinearGradient>
            </Animated.View>
          )}

          {/* Comment Input */}
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <Animated.View 
              style={[
                styles.inputContainer,
                { transform: [{ scale: inputScale }] }
              ]}
            >
              <LinearGradient
                colors={['rgba(20,20,20,0.95)', 'rgba(30,30,30,0.95)']}
                style={styles.inputGradient}
              >
                <View style={styles.inputWrapper}>
                  <TextInput
                    ref={inputRef}
                    style={styles.textInput}
                    placeholder={replyingTo ? "Write a reply..." : "Add a comment..."}
                    placeholderTextColor="#888"
                    value={commentText}
                    onChangeText={setCommentText}
                    multiline
                    maxLength={500}
                    returnKeyType="send"
                    onSubmitEditing={handleSubmitComment}
                    blurOnSubmit={false}
                  />
                  
                  {commentText.trim() && (
                    <TouchableOpacity 
                      style={styles.sendButton}
                      onPress={handleSubmitComment}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <LinearGradient
                          colors={['#ff0050', '#ff7a00']}
                          style={styles.sendButtonGradient}
                        >
                          <MaterialIcons name="send" size={20} color="#fff" />
                        </LinearGradient>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </LinearGradient>
            </Animated.View>
          </KeyboardAvoidingView>
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  overlayTouch: {
    flex: 1,
  },
  modal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.85,
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -10,
    },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#666',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  commentsContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#888',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  emptySubtitle: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
  },
  bottomSpacing: {
    height: 20,
  },
  replyBanner: {
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  replyBannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  replyText: {
    flex: 1,
    color: '#ff0050',
    fontSize: 14,
    fontWeight: '600',
  },
  inputContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 25,
    overflow: 'hidden',
  },
  inputGradient: {
    padding: 2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#2a2a2a',
    borderRadius: 23,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  textInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    maxHeight: 100,
    minHeight: 24,
  },
  sendButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  sendButtonGradient: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});