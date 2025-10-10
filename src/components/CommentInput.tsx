import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface CommentInputProps {
  onSubmit: (text: string, replyToId?: number) => void;
  placeholder?: string;
  replyTo?: {
    id: number;
    authorName: string;
  };
  onCancelReply?: () => void;
  isLoading?: boolean;
  autoFocus?: boolean;
}

export const CommentInput: React.FC<CommentInputProps> = ({
  onSubmit,
  placeholder = "Add a comment...",
  replyTo,
  onCancelReply,
  isLoading = false,
  autoFocus = false,
}) => {
  const [text, setText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const buttonScale = useRef(new Animated.Value(1)).current;
  const containerHeight = useRef(new Animated.Value(60)).current;

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [autoFocus]);

  useEffect(() => {
    // Animate container height based on focus state
    Animated.timing(containerHeight, {
      toValue: isFocused || replyTo ? 80 : 60,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused, replyTo]);

  const handleSubmit = () => {
    const trimmedText = text.trim();
    if (trimmedText.length === 0) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Animate send button
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    onSubmit(trimmedText, replyTo?.id);
    setText('');
    inputRef.current?.blur();
    
    if (replyTo && onCancelReply) {
      onCancelReply();
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  const handleCancelReply = () => {
    if (onCancelReply) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onCancelReply();
    }
  };

  const canSend = text.trim().length > 0 && !isLoading;

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardAvoidingView}
    >
      <Animated.View style={[styles.container, { height: containerHeight }]}>
        {/* Reply indicator */}
        {replyTo && (
          <View style={styles.replyIndicator}>
            <MaterialIcons name="reply" size={16} color="#999" />
            <Text style={styles.replyText}>
              Replying to <Text style={styles.replyAuthor}>{replyTo.authorName}</Text>
            </Text>
            <TouchableOpacity 
              onPress={handleCancelReply}
              style={styles.cancelReply}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons name="close" size={16} color="#999" />
            </TouchableOpacity>
          </View>
        )}

        {/* Input row */}
        <View style={styles.inputRow}>
          <View style={styles.inputContainer}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder={placeholder}
              placeholderTextColor="#666"
              value={text}
              onChangeText={setText}
              onFocus={handleFocus}
              onBlur={handleBlur}
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={handleSubmit}
              blurOnSubmit={false}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.sendButton,
              canSend && styles.sendButtonActive,
            ]}
            onPress={handleSubmit}
            disabled={!canSend}
          >
            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              {isLoading ? (
                <MaterialIcons name="hourglass-empty" size={20} color="#666" />
              ) : (
                <MaterialIcons 
                  name="send" 
                  size={20} 
                  color={canSend ? "#fff" : "#666"} 
                />
              )}
            </Animated.View>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  container: {
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'flex-end',
  },
  replyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  replyText: {
    color: '#999',
    fontSize: 12,
    flex: 1,
  },
  replyAuthor: {
    color: '#fff',
    fontWeight: '600',
  },
  cancelReply: {
    padding: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  inputContainer: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 40,
    maxHeight: 100,
  },
  input: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 20,
    paddingVertical: 4,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: '#ff0050',
  },
});
