import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CommentWithReplies } from '../utils/api';

interface CommentPreviewProps {
  comments: CommentWithReplies[];
  isVisible: boolean;
  onPress: () => void;
}

export const CommentPreview: React.FC<CommentPreviewProps> = ({
  comments,
  isVisible,
  onPress,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (isVisible && comments.length > 0) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 20,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible, comments.length, fadeAnim, slideAnim]);

  if (!isVisible || comments.length === 0) return null;

  // Show the 2 most recent comments
  const previewComments = comments.slice(0, 2);
  const totalComments = comments.reduce((total, comment) => 
    total + 1 + (comment.replies?.length || 0), 0
  );

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
        <LinearGradient
          colors={['rgba(0,0,0,0.9)', 'rgba(0,0,0,0.7)']}
          style={styles.gradient}
        >
          <View style={styles.header}>
            <MaterialIcons name="comment" size={16} color="#fff" />
            <Text style={styles.headerText}>
              {totalComments} comment{totalComments !== 1 ? 's' : ''}
            </Text>
          </View>
          
          {previewComments.map((comment, index) => (
            <View key={comment.id} style={[styles.commentPreview, index > 0 && styles.commentSpacing]}>
              <Text style={styles.authorName}>{comment.author_name}</Text>
              <Text style={styles.commentText} numberOfLines={2}>
                {comment.content}
              </Text>
            </View>
          ))}
          
          {comments.length > 2 && (
            <Text style={styles.moreText}>
              +{totalComments - 2} more comments...
            </Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 100,
    right: 20,
    maxWidth: 250,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  gradient: {
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  headerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  commentPreview: {
    marginBottom: 4,
  },
  commentSpacing: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  authorName: {
    color: '#ff0050',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  commentText: {
    color: '#fff',
    fontSize: 11,
    lineHeight: 14,
  },
  moreText: {
    color: '#888',
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 4,
  },
});
