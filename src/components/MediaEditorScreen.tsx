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
import { MAX_LENGTH } from '../utils/constants';
import { FilterSelector } from './FilterSelector';
import { CustomFilterEditor } from './CustomFilterEditor';
import { useCameraFilters } from '../hooks/useCameraFilters';

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

type EditorStep = 'editing' | 'publishing';

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
  // Step management
  const [currentStep, setCurrentStep] = useState<EditorStep>('editing');
  
  // Media state
  const [caption, setCaption] = useState(initialCaption);
  const [emojis, setEmojis] = useState<EmojiOverlay[]>(initialEmojis);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const videoRef = useRef<Video>(null);
  const mediaContainerRef = useRef<View>(null);
  
  // Filter state
  const filters = useCameraFilters();

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

  // Handle filter selection
  const handleFilterSelect = (filter: any) => {
    filters.setSelectedFilter(filter);
    if (filter.isCustom) {
      filters.setShowCustomEditor(true);
    }
  };

  // Calculate filter overlay style based on custom values
  const getCustomFilterOverlay = () => {
    if (!filters.selectedFilter.isCustom || !filters.selectedFilter.customValues) {
      return null;
    }

    const values = filters.selectedFilter.customValues;
    
    // Calculate brightness overlay
    const brightness = values.brightness;
    const brightnessColor = brightness > 0 ? '#fff' : '#000';
    const brightnessOpacity = Math.abs(brightness) * 0.3;

    // Calculate warmth (orange for warm, blue for cool)
    const warmth = values.warmth;
    const warmthColor = warmth > 0 ? '#FF9500' : '#4A90E2';
    const warmthOpacity = Math.abs(warmth) * 0.25;

    // Use tint color if not black
    const hasTint = values.tint !== '#000000';
    const tintOpacity = hasTint ? 0.2 : 0;

    return (
      <>
        {/* Brightness overlay */}
        {brightness !== 0 && (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: brightnessColor,
                opacity: brightnessOpacity,
              },
            ]}
            pointerEvents="none"
          />
        )}
        
        {/* Warmth overlay */}
        {warmth !== 0 && (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: warmthColor,
                opacity: warmthOpacity,
              },
            ]}
            pointerEvents="none"
          />
        )}
        
        {/* Color tint overlay */}
        {hasTint && (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: values.tint,
                opacity: tintOpacity,
              },
            ]}
            pointerEvents="none"
          />
        )}
        
        {/* Structure effect (simulated with slight overlay) */}
        {values.structure !== 0 && (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: values.structure > 0 ? '#fff' : '#000',
                opacity: Math.abs(values.structure) * 0.1,
              },
            ]}
            pointerEvents="none"
          />
        )}
        
        {/* Saturation effect (simulated with desaturation overlay) */}
        {values.saturation < 0 && (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: '#808080',
                opacity: Math.abs(values.saturation) * 0.3,
              },
            ]}
            pointerEvents="none"
          />
        )}
      </>
    );
  };

  const handleMakePublic = async () => {
    setIsProcessing(true);
    try {
      // Close filter selector before processing
      if (filters.showFilters) {
        filters.setShowFilters(false);
      }
      
      // Apply filter to photo if selected
      let finalUri = mediaUri;
      if (mediaType === 'photo' && filters.selectedFilter.id !== 'normal') {
        try {
          finalUri = await filters.applyFilterToPhoto(mediaUri);
        } catch (filterError) {
          console.warn('Filter application failed, using original:', filterError);
          // Continue with original if filter fails
        }
      }
      
      onMakePublic({
        uri: finalUri,
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
      // Close filter selector before processing
      if (filters.showFilters) {
        filters.setShowFilters(false);
      }
      
      // Apply filter to photo if selected
      let finalUri = mediaUri;
      if (mediaType === 'photo' && filters.selectedFilter.id !== 'normal') {
        try {
          finalUri = await filters.applyFilterToPhoto(mediaUri);
        } catch (filterError) {
          console.warn('Filter application failed, using original:', filterError);
          // Continue with original if filter fails
        }
      }
      
      onSaveToGallery({
        uri: finalUri,
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
    // If on publishing step, go back to editing
    if (currentStep === 'publishing') {
      setCurrentStep('editing');
      return;
    }
    
    // If on editing step, handle exit
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
        'Discard Changes?',
        'Do you want to go back to the camera? Your edits will be lost.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              onBack();
            },
          },
        ],
        { cancelable: true }
      );
    }
  };

  const handleNextStep = () => {
    // Close any open pickers/selectors before proceeding
    if (filters.showFilters) {
      filters.setShowFilters(false);
    }
    if (showEmojiPicker) {
      setShowEmojiPicker(false);
    }
    
    setCurrentStep('publishing');
  };

  // Render editing step
  const renderEditingStep = () => (
    <>
      {/* Back Button - Top Left */}
      <TouchableOpacity style={styles.backButtonTop} onPress={handleBackPress}>
        <MaterialIcons name="arrow-back" size={28} color="#fff" />
      </TouchableOpacity>
      
      {/* Step Indicator */}
      <View style={styles.stepIndicator}>
        <View style={styles.stepDot} />
        <View style={[styles.stepDot, styles.stepDotInactive]} />
      </View>
      
      <TouchableWithoutFeedback onPress={() => {
        if (filters.showFilters) filters.setShowFilters(false);
        if (showEmojiPicker) setShowEmojiPicker(false);
      }}>
        <View style={styles.container}>
          {/* Media Preview */}
          <View style={styles.mediaContainer} ref={mediaContainerRef}>
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
            
            {/* Filter overlay */}
            {filters.selectedFilter.isCustom ? (
              getCustomFilterOverlay()
            ) : (
              filters.selectedFilter.id !== 'normal' && filters.selectedFilter.style.backgroundColor && (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      backgroundColor: filters.selectedFilter.style.backgroundColor,
                      opacity: filters.selectedFilter.style.opacity || 0,
                    },
                  ]}
                  pointerEvents="none"
                />
              )
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
            
            {/* Filter selection button */}
            <TouchableOpacity
              style={styles.filterButton}
              onPress={filters.toggleFilters}
            >
              <MaterialIcons name="filter" size={20} color="#fff" />
              <Text style={styles.filterButtonText}>{filters.selectedFilter.name}</Text>
            </TouchableOpacity>
            
            {/* Dismissible overlay - tap anywhere to close filters */}
            {filters.showFilters && (
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={() => filters.setShowFilters(false)}
              />
            )}
            
            {/* Filter selector */}
            {filters.showFilters && (
              <FilterSelector
                selectedFilter={filters.selectedFilter}
                onFilterSelect={handleFilterSelect}
              />
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>

      {/* Bottom Controls - Editing Tools */}
      <View style={styles.bottomContainer}>
        <ScrollView 
          style={styles.scrollableContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Emoji Picker Toggle */}
          <TouchableOpacity
            style={styles.toolButton}
            onPress={() => {
              setShowEmojiPicker(!showEmojiPicker);
            }}
          >
            <MaterialIcons name="insert-emoticon" size={24} color="#fff" />
            <Text style={styles.toolButtonText}>
              {showEmojiPicker ? 'Hide Emojis' : 'Add Emojis'}
            </Text>
            {emojis.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{emojis.length}</Text>
              </View>
            )}
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
                <Text style={styles.emojiHint}>Long press emoji on screen to remove</Text>
              )}
            </>
          )}

          {/* Next Button */}
          <TouchableOpacity
            style={styles.nextButton}
            onPress={handleNextStep}
          >
            <Text style={styles.nextButtonText}>Next</Text>
            <MaterialIcons name="arrow-forward" size={24} color="#fff" />
          </TouchableOpacity>
        </ScrollView>
      </View>
      
      {/* Custom Filter Editor */}
      <CustomFilterEditor
        visible={filters.showCustomEditor}
        initialValues={filters.selectedFilter.customValues || {
          brightness: 0,
          contrast: 0,
          saturation: 0,
          warmth: 0,
          structure: 0,
          tint: '#000000',
        }}
        onClose={() => filters.setShowCustomEditor(false)}
        onApply={filters.updateCustomFilter}
        onReset={filters.resetCustomFilter}
      />
    </>
  );

  // Render publishing step
  const renderPublishingStep = () => (
    <>
      {/* Back Button - Top Left */}
      <TouchableOpacity style={styles.backButtonTop} onPress={handleBackPress}>
        <MaterialIcons name="arrow-back" size={28} color="#fff" />
      </TouchableOpacity>
      
      {/* Step Indicator */}
      <View style={styles.stepIndicator}>
        <View style={[styles.stepDot, styles.stepDotInactive]} />
        <View style={styles.stepDot} />
      </View>
      
      <View style={styles.container}>
        {/* Small Media Preview */}
        <View style={styles.mediaThumbnail}>
          {mediaType === 'photo' ? (
            <Image source={{ uri: mediaUri }} style={styles.thumbnailImage} resizeMode="cover" />
          ) : (
            <Video
              source={{ uri: currentVideoUri }}
              style={styles.thumbnailImage}
              resizeMode={ResizeMode.COVER}
              isLooping
              shouldPlay={false}
              useNativeControls={false}
            />
          )}
          
          {/* Filter overlay on thumbnail */}
          {filters.selectedFilter.isCustom ? (
            getCustomFilterOverlay()
          ) : (
            filters.selectedFilter.id !== 'normal' && filters.selectedFilter.style.backgroundColor && (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: filters.selectedFilter.style.backgroundColor,
                    opacity: filters.selectedFilter.style.opacity || 0,
                  },
                ]}
                pointerEvents="none"
              />
            )
          )}
          
          {/* Emoji overlays on thumbnail */}
          {emojis.map((emoji) => (
            <View
              key={emoji.id}
              style={[
                styles.thumbnailEmoji,
                {
                  left: `${emoji.x * 100}%`,
                  top: `${emoji.y * 100}%`,
                  transform: [{ scale: emoji.scale * 0.5 }],
                },
              ]}
            >
              <Text style={styles.emojiText}>{emoji.emoji}</Text>
            </View>
          ))}
        </View>
        
        {/* Publishing Controls */}
        <KeyboardAvoidingView 
          style={styles.publishingContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView 
            style={styles.publishingScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.stepTitle}>Add Caption & Publish</Text>
            
            {/* Caption Input */}
            <View style={styles.captionContainer}>
              <TextInput
                style={styles.captionInput}
                placeholder="Add a caption..."
                placeholderTextColor="#999"
                value={caption}
                onChangeText={setCaption}
                multiline
                maxLength={MAX_LENGTH.postCaption}
                returnKeyType="done"
                blurOnSubmit={true}
              />
              <Text style={styles.characterCount}>{caption.length}/{MAX_LENGTH.postCaption}</Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtonsContainer}>
              {/* Save to Gallery Button - Always show */}
              <TouchableOpacity
                style={[styles.saveButton, isProcessing && styles.buttonDisabled]}
                onPress={handleSaveToGallery}
                disabled={isProcessing}
              >
                <MaterialIcons name="save" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>
                  {isProcessing ? 'Saving...' : 'Save to Gallery'}
                </Text>
              </TouchableOpacity>
              
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
        </KeyboardAvoidingView>
      </View>
    </>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <StatusBar style="light" />
      {currentStep === 'editing' ? renderEditingStep() : renderPublishingStep()}
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
  filterButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 70,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  filterButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  stepIndicator: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 16,
    flexDirection: 'row',
    gap: 8,
    zIndex: 100,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff0050',
  },
  stepDotInactive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
    position: 'relative',
  },
  toolButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  badge: {
    backgroundColor: '#ff0050',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff0050',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
    elevation: 3,
    shadowColor: '#ff0050',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  mediaThumbnail: {
    width: '100%',
    height: 200,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: Platform.OS === 'ios' ? 100 : 70,
    marginHorizontal: 16,
    position: 'relative',
    alignSelf: 'center',
    maxWidth: '92%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailEmoji: {
    position: 'absolute',
  },
  publishingContainer: {
    flex: 1,
    marginTop: 20,
  },
  publishingScroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  stepTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
  },
});

