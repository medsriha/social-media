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

interface MediaEditorScreenProps {
  mediaUri: string;
  mediaType: 'photo' | 'video';
  videoSegments?: string[]; // For multi-segment videos
  initialCaption?: string;
  isFromGallery?: boolean;
  onBack: () => void;
  onAddSegments?: () => void; // For videos from gallery - return to camera to add more segments
  onMakePublic: (data: {
    uri: string;
    caption: string;
    type: 'photo' | 'video';
    segments?: string[];
  }) => void;
  onSaveToGallery: (data: {
    uri: string;
    caption: string;
    type: 'photo' | 'video';
    segments?: string[];
  }) => void;
  onDelete: () => void;
}

type EditorStep = 'editing' | 'publishing';

export const MediaEditorScreen: React.FC<MediaEditorScreenProps> = ({
  mediaUri,
  mediaType,
  videoSegments,
  initialCaption = '',
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
    console.log('handleBackPress called, currentStep:', currentStep);
    // If on publishing step, check for changes before going back to editing
    if (currentStep === 'publishing') {
      const hasChanges = caption.trim() !== initialCaption || filters.selectedFilter.id !== 'normal';
      console.log('Publishing step, hasChanges:', hasChanges);
      
      if (hasChanges) {
        console.log('Showing save changes alert');
        Alert.alert(
          'Save Your Changes?',
          'You have unsaved changes. What would you like to do?',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Return to editing',
              onPress: () => {
                setCurrentStep('editing');
              },
            },
            {
              text: 'Discard & exit',
              style: 'destructive',
              onPress: () => {
                onBack();
              },
            },
            {
              text: 'Save & Exit',
              onPress: async () => {
                try {
                  setIsProcessing(true);
                  
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
                  
                  // Save to gallery
                  await onSaveToGallery({
                    uri: finalUri,
                    caption: caption.trim(),
                    type: mediaType,
                    segments: videoSegments,
                  });
                  
                  // Exit to previous screen
                  onBack();
                } catch (error) {
                  console.error('Error saving:', error);
                  Alert.alert('Error', 'Failed to save media');
                  setIsProcessing(false);
                }
              },
            },
          ],
          { cancelable: true }
        );
      } else {
        setCurrentStep('editing');
      }
      return;
    }
    
    // If on editing step, show save/discard/cancel options
    const hasChanges = caption.trim() !== initialCaption || filters.selectedFilter.id !== 'normal';
    console.log('Editing step, hasChanges:', hasChanges, 'caption:', caption.trim(), 'initialCaption:', initialCaption, 'filter:', filters.selectedFilter.id);
    
    if (hasChanges) {
      console.log('Showing save changes alert for editing step');
      Alert.alert(
        'Save Your Changes?',
        'You have unsaved changes. What would you like to do?',
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
          {
            text: 'Save & Exit',
            onPress: async () => {
              try {
                setIsProcessing(true);
                
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
                
                // Save to gallery
                onSaveToGallery({
                  uri: finalUri,
                  caption: caption.trim(),
                  type: mediaType,
                  segments: videoSegments,
                });
              } catch (error) {
                console.error('Error saving:', error);
                Alert.alert('Error', 'Failed to save media');
                setIsProcessing(false);
              }
            },
          },
        ],
        { cancelable: true }
      );
    } else {
      // No changes, handle based on source
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
      } else {
        // No changes and not from gallery with segments, just go back
        onBack();
      }
    }
  };

  const handleNextStep = () => {
    // Close any open pickers/selectors before proceeding
    if (filters.showFilters) {
      filters.setShowFilters(false);
    }
    
    setCurrentStep('publishing');
  };

  // Render editing step
  const renderEditingStep = () => (
    <>
      {/* Back Button - Top Left */}
      <TouchableOpacity style={styles.backButtonTop} onPress={handleBackPress}>
        <MaterialIcons name="arrow-back" size={28} color="#fff" />
        {/* Unsaved changes indicator */}
        {(caption.trim() !== initialCaption || filters.selectedFilter.id !== 'normal') && (
          <View style={styles.unsavedIndicator} />
        )}
      </TouchableOpacity>
      
      {/* Step Indicator */}
      <View style={styles.stepIndicator}>
        <View style={styles.stepDot} />
        <View style={[styles.stepDot, styles.stepDotInactive]} />
      </View>
      
      <TouchableWithoutFeedback onPress={() => {
        if (filters.showFilters) filters.setShowFilters(false);
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
          {/* Next Button - smaller and less prominent */}
          <TouchableOpacity
            style={styles.nextButtonSmall}
            onPress={handleNextStep}
          >
            <Text style={styles.nextButtonTextSmall}>Next</Text>
            <MaterialIcons name="arrow-forward" size={16} color="#fff" />
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
        {/* Unsaved changes indicator */}
        {(caption.trim() !== initialCaption || filters.selectedFilter.id !== 'normal') && (
          <View style={styles.unsavedIndicator} />
        )}
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
  unsavedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff0050',
    borderWidth: 1,
    borderColor: '#fff',
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
  nextButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,0,80,0.8)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    elevation: 2,
    shadowColor: '#ff0050',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  nextButtonTextSmall: {
    color: '#fff',
    fontSize: 14,
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

