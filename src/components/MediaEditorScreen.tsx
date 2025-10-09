import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';

interface EmojiOverlay {
  id: string;
  emoji: string;
  x: number;
  y: number;
  scale: number;
}

interface MediaEditorScreenProps {
  mediaUri: string;
  mediaType: 'photo' | 'video';
  videoSegments?: string[]; // For multi-segment videos
  initialCaption?: string;
  initialEmojis?: EmojiOverlay[];
  isFromGallery?: boolean;
  onBack: () => void;
  onAddSegments?: () => void; // For videos from gallery - return to camera to add more segments
  onMakePublic: (data: {
    uri: string;
    caption: string;
    emojis: EmojiOverlay[];
    type: 'photo' | 'video';
    segments?: string[];
  }) => void;
  onSaveToGallery: (data: {
    uri: string;
    caption: string;
    emojis: EmojiOverlay[];
    type: 'photo' | 'video';
    segments?: string[];
  }) => void;
  onDelete: () => void;
}

const EMOJI_LIST = ['😀', '😂', '😍', '🥰', '😎', '🤩', '🥳', '😇', '🤔', '😱', '🔥', '💯', '✨', '💖', '👍', '🎉', '🎵', '🎨', '🌟', '⭐', '💫', '🌈', '🦄', '🐶', '🐱', '🍕', '🍔', '🎂', '☕'];

export const MediaEditorScreen: React.FC<MediaEditorScreenProps> = ({
  mediaUri,
  mediaType,
  videoSegments,
  initialCaption = '',
  initialEmojis = [],
  isFromGallery = false,
  onBack,
  onAddSegments,
  onMakePublic,
  onSaveToGallery,
  onDelete,
}) => {
  const [caption, setCaption] = useState(initialCaption);
  const [emojis, setEmojis] = useState<EmojiOverlay[]>(initialEmojis);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const videoRef = useRef<Video>(null);

  const segments = videoSegments || [mediaUri];
  const hasMultipleSegments = segments.length > 1;
  const currentVideoUri = segments[currentSegmentIndex];

  const handleVideoPlaybackEnd = () => {
    if (hasMultipleSegments && currentSegmentIndex < segments.length - 1) {
      // Play next segment
      setCurrentSegmentIndex(currentSegmentIndex + 1);
    } else if (hasMultipleSegments) {
      // Loop back to first segment
      setCurrentSegmentIndex(0);
    }
  };

  const addEmoji = (emoji: string) => {
    const newEmoji: EmojiOverlay = {
      id: Date.now().toString(),
      emoji,
      x: Math.random() * 0.6 + 0.2, // 20% to 80% of width
      y: Math.random() * 0.6 + 0.2, // 20% to 80% of height
      scale: 1,
    };
    setEmojis([...emojis, newEmoji]);
  };

  const removeEmoji = (id: string) => {
    setEmojis(emojis.filter((e) => e.id !== id));
  };

  const handleMakePublic = async () => {
    setIsProcessing(true);
    try {
      onMakePublic({
        uri: mediaUri,
        caption: caption.trim(),
        emojis,
        type: mediaType,
        segments: videoSegments,
      });
    } catch (error) {
      console.error('Error making public:', error);
      Alert.alert('Error', 'Failed to make media public');
      setIsProcessing(false);
    }
  };

  const handleSaveToGallery = async () => {
    setIsProcessing(true);
    try {
      onSaveToGallery({
        uri: mediaUri,
        caption: caption.trim(),
        emojis,
        type: mediaType,
        segments: videoSegments,
      });
    } catch (error) {
      console.error('Error saving:', error);
      Alert.alert('Error', 'Failed to save media');
      setIsProcessing(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Media',
      'Are you sure you want to delete this? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDelete();
          },
        },
      ]
    );
  };

  const handleBackPress = () => {
    // Different behavior for gallery videos vs new captures
    if (isFromGallery && mediaType === 'video' && onAddSegments) {
      // For videos from gallery, allow adding segments
      Alert.alert(
        'What would you like to do?',
        'You can add more video segments or return to the gallery.',
        [
          {
            text: 'Back to Gallery',
            onPress: () => {
              onBack();
            },
          },
          {
            text: 'Add Segments',
            onPress: () => {
              onAddSegments();
            },
          },
        ],
        { cancelable: true }
      );
    } else if (isFromGallery) {
      // For photos from gallery or when no add segments option, just go back
      onBack();
    } else {
      // For new captures from camera
      Alert.alert(
        'Save Changes?',
        'Do you want to save this to your gallery, or go back to continue recording?',
        [
          {
            text: 'Back to Camera',
            onPress: () => {
              onBack();
            },
          },
          {
            text: 'Save to Gallery',
            onPress: () => {
              handleSaveToGallery();
            },
          },
        ],
        { cancelable: true }
      );
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <StatusBar style="light" />
      
      {/* Back Button - Top Left */}
      <TouchableOpacity style={styles.backButtonTop} onPress={handleBackPress}>
        <MaterialIcons name="arrow-back" size={28} color="#fff" />
      </TouchableOpacity>
      
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          {/* Media Preview */}
          <View style={styles.mediaContainer}>
            {mediaType === 'photo' ? (
              <Image source={{ uri: mediaUri }} style={styles.media} resizeMode="contain" />
            ) : (
              <>
                <Video
                  ref={videoRef}
                  key={currentVideoUri}
                  source={{ uri: currentVideoUri }}
                  style={styles.media}
                  resizeMode={ResizeMode.CONTAIN}
                  isLooping={!hasMultipleSegments}
                  shouldPlay
                  useNativeControls={false}
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
            )}
            
            {/* Emoji Overlays */}
            {emojis.map((emoji) => (
              <TouchableOpacity
                key={emoji.id}
                style={[
                  styles.emojiOverlay,
                  {
                    left: `${emoji.x * 100}%`,
                    top: `${emoji.y * 100}%`,
                    transform: [{ scale: emoji.scale }],
                  },
                ]}
                onLongPress={() => removeEmoji(emoji.id)}
              >
                <Text style={styles.emojiText}>{emoji.emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableWithoutFeedback>

      {/* Bottom Controls - Fixed at bottom */}
      <View style={styles.bottomContainer}>
        <ScrollView 
          style={styles.scrollableContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Caption Input */}
          <View style={styles.captionContainer}>
            <TextInput
              style={styles.captionInput}
              placeholder="Add a caption..."
              placeholderTextColor="#999"
              value={caption}
              onChangeText={setCaption}
              multiline
              maxLength={150}
              returnKeyType="done"
              blurOnSubmit={true}
            />
            <Text style={styles.characterCount}>{caption.length}/150</Text>
          </View>

          {/* Emoji Picker Toggle */}
          <TouchableOpacity
            style={styles.emojiPickerButton}
            onPress={() => {
              Keyboard.dismiss();
              setShowEmojiPicker(!showEmojiPicker);
            }}
          >
            <MaterialIcons name="insert-emoticon" size={24} color="#fff" />
            <Text style={styles.emojiPickerButtonText}>
              {showEmojiPicker ? 'Hide Emojis' : 'Add Emojis'}
            </Text>
          </TouchableOpacity>

          {/* Emoji Picker */}
          {showEmojiPicker && (
            <>
              <ScrollView
                horizontal
                style={styles.emojiPicker}
                showsHorizontalScrollIndicator={false}
              >
                {EMOJI_LIST.map((emoji, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.emojiButton}
                    onPress={() => addEmoji(emoji)}
                  >
                    <Text style={styles.emoji}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {emojis.length > 0 && (
                <Text style={styles.emojiHint}>Long press emoji to remove</Text>
              )}
            </>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtonsContainer}>
            {/* Save Changes Button - Only show if from gallery */}
            {isFromGallery && (
              <TouchableOpacity
                style={[styles.saveButton, isProcessing && styles.buttonDisabled]}
                onPress={handleSaveToGallery}
                disabled={isProcessing}
              >
                <MaterialIcons name="save" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>
                  {isProcessing ? 'Saving...' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
            )}
            
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={[styles.publishButton, isProcessing && styles.buttonDisabled]}
                onPress={handleMakePublic}
                disabled={isProcessing}
              >
                <MaterialIcons name="public" size={20} color="#fff" />
                <Text style={styles.publishButtonText}>
                  {isProcessing ? 'Publishing...' : 'Publish'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.deleteButtonBottom, isProcessing && styles.buttonDisabled]} 
                onPress={handleDelete}
                disabled={isProcessing}
              >
                <MaterialIcons name="delete" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backButtonTop: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 16,
    zIndex: 100,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  mediaContainer: {
    flex: 1,
    position: 'relative',
  },
  media: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  emojiOverlay: {
    position: 'absolute',
    padding: 4,
  },
  emojiText: {
    fontSize: 40,
  },
  bottomContainer: {
    backgroundColor: 'rgba(0,0,0,0.95)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '50%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  scrollableContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  captionContainer: {
    marginBottom: 12,
  },
  captionInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    minHeight: 80,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    textAlignVertical: 'top',
  },
  characterCount: {
    color: '#999',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  emojiPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  emojiPickerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emojiPicker: {
    maxHeight: 70,
    marginBottom: 8,
  },
  emojiButton: {
    padding: 8,
    marginRight: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
  },
  emoji: {
    fontSize: 32,
  },
  emojiHint: {
    color: '#999',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  actionButtonsContainer: {
    marginTop: 8,
    marginBottom: 8,
    gap: 12,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34c759',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#34c759',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  publishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff0050',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    flex: 1,
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#ff0050',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  publishButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  deleteButtonBottom: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#ff3b30',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#ff3b30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  segmentIndicator: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  segmentText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

