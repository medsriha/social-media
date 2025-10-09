/**
 * Save Changes Feature - Usage Examples
 * 
 * This file demonstrates how to use the save changes feature
 * for media captions and emojis in your components.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, Button, Alert } from 'react-native';
import {
  saveMediaMetadata,
  loadMediaMetadata,
  deleteMediaMetadata,
  MediaMetadata,
  EmojiOverlay,
} from '../utils/mediaStorage';

// Example 1: Save caption to a video
export const SaveCaptionExample = () => {
  const videoUri = 'file:///path/to/videos/video_1234567890.mp4';

  const handleSaveCaption = async () => {
    const success = await saveMediaMetadata(videoUri, {
      type: 'video',
      caption: 'My awesome video caption!',
    });

    if (success) {
      Alert.alert('Success', 'Caption saved!');
    } else {
      Alert.alert('Error', 'Failed to save caption');
    }
  };

  return (
    <View>
      <Text>Save Video Caption Example</Text>
      <Button title="Save Caption" onPress={handleSaveCaption} />
    </View>
  );
};

// Example 2: Save emojis to a photo
export const SaveEmojisExample = () => {
  const photoUri = 'file:///path/to/photos/photo_1234567890.jpg';

  const handleSaveEmojis = async () => {
    const emojis: EmojiOverlay[] = [
      {
        id: '1',
        emoji: '😀',
        x: 0.5,  // 50% of width
        y: 0.3,  // 30% of height
        scale: 1,
      },
      {
        id: '2',
        emoji: '🎉',
        x: 0.7,
        y: 0.6,
        scale: 1.2,
      },
    ];

    const success = await saveMediaMetadata(photoUri, {
      type: 'photo',
      emojis,
    });

    if (success) {
      Alert.alert('Success', 'Emojis saved!');
    }
  };

  return (
    <View>
      <Text>Save Photo Emojis Example</Text>
      <Button title="Add Emojis" onPress={handleSaveEmojis} />
    </View>
  );
};

// Example 3: Save both caption and emojis
export const SaveCompleteMetadataExample = () => {
  const mediaUri = 'file:///path/to/videos/video_1234567890.mp4';

  const handleSaveComplete = async () => {
    const emojis: EmojiOverlay[] = [
      {
        id: '1',
        emoji: '💖',
        x: 0.5,
        y: 0.5,
        scale: 1.5,
      },
    ];

    const success = await saveMediaMetadata(mediaUri, {
      type: 'video',
      caption: 'Check out this amazing video! 🎥',
      emojis,
      segments: [
        'file:///path/to/segment1.mp4',
        'file:///path/to/segment2.mp4',
      ],
    });

    if (success) {
      Alert.alert('Success', 'All metadata saved!');
    }
  };

  return (
    <View>
      <Text>Save Complete Metadata Example</Text>
      <Button title="Save Everything" onPress={handleSaveComplete} />
    </View>
  );
};

// Example 4: Load existing metadata
export const LoadMetadataExample = () => {
  const [metadata, setMetadata] = useState<MediaMetadata | null>(null);
  const mediaUri = 'file:///path/to/videos/video_1234567890.mp4';

  useEffect(() => {
    loadExistingMetadata();
  }, []);

  const loadExistingMetadata = async () => {
    const data = await loadMediaMetadata(mediaUri);
    if (data) {
      setMetadata(data);
      console.log('Loaded metadata:', data);
    }
  };

  return (
    <View>
      <Text>Load Metadata Example</Text>
      {metadata ? (
        <>
          <Text>Caption: {metadata.caption || 'No caption'}</Text>
          <Text>Emojis: {metadata.emojis?.length || 0}</Text>
          <Text>Type: {metadata.type}</Text>
          <Text>Published: {metadata.published ? 'Yes' : 'No'}</Text>
        </>
      ) : (
        <Text>No metadata found</Text>
      )}
      <Button title="Reload" onPress={loadExistingMetadata} />
    </View>
  );
};

// Example 5: Update existing metadata (merge with current)
export const UpdateMetadataExample = () => {
  const mediaUri = 'file:///path/to/videos/video_1234567890.mp4';

  const handleUpdateCaption = async () => {
    // First load existing metadata
    const existing = await loadMediaMetadata(mediaUri);

    // Update only the caption, keeping emojis and other data
    const success = await saveMediaMetadata(mediaUri, {
      type: existing?.type || 'video',
      caption: 'Updated caption text',
      emojis: existing?.emojis, // Keep existing emojis
      segments: existing?.segments, // Keep existing segments
    });

    if (success) {
      Alert.alert('Success', 'Caption updated!');
    }
  };

  return (
    <View>
      <Text>Update Metadata Example</Text>
      <Button title="Update Caption Only" onPress={handleUpdateCaption} />
    </View>
  );
};

// Example 6: Delete metadata
export const DeleteMetadataExample = () => {
  const mediaUri = 'file:///path/to/videos/video_1234567890.mp4';

  const handleDeleteMetadata = async () => {
    const success = await deleteMediaMetadata(mediaUri);

    if (success) {
      Alert.alert('Success', 'Metadata deleted!');
    } else {
      Alert.alert('Error', 'Failed to delete metadata');
    }
  };

  return (
    <View>
      <Text>Delete Metadata Example</Text>
      <Button title="Delete Metadata" onPress={handleDeleteMetadata} />
    </View>
  );
};

// Example 7: Integration with MediaEditorScreen
export const MediaEditorIntegrationExample = () => {
  const [showEditor, setShowEditor] = useState(false);
  const mediaUri = 'file:///path/to/videos/video_1234567890.mp4';

  const handleSaveFromEditor = async (data: {
    uri: string;
    caption: string;
    emojis: EmojiOverlay[];
    type: 'photo' | 'video';
    segments?: string[];
  }) => {
    try {
      const success = await saveMediaMetadata(data.uri, {
        type: data.type,
        caption: data.caption,
        emojis: data.emojis,
        segments: data.segments,
      });

      if (success) {
        Alert.alert('Success', 'Changes saved successfully!');
        setShowEditor(false);
      } else {
        throw new Error('Failed to save metadata');
      }
    } catch (error) {
      console.error('Error saving:', error);
      Alert.alert('Error', 'Failed to save changes');
    }
  };

  return (
    <View>
      <Text>MediaEditor Integration Example</Text>
      <Button title="Open Editor" onPress={() => setShowEditor(true)} />
      
      {/* 
      {showEditor && (
        <MediaEditorScreen
          mediaUri={mediaUri}
          mediaType="video"
          isFromGallery={true}
          onBack={() => setShowEditor(false)}
          onSaveToGallery={handleSaveFromEditor}
          onPublish={(data) => console.log('Publish:', data)}
          onDelete={() => console.log('Delete')}
        />
      )}
      */}
    </View>
  );
};

// Example 8: Batch metadata operations
export const BatchMetadataExample = () => {
  const mediaUris = [
    'file:///path/to/videos/video_1.mp4',
    'file:///path/to/videos/video_2.mp4',
    'file:///path/to/videos/video_3.mp4',
  ];

  const handleBatchSave = async () => {
    const results = await Promise.all(
      mediaUris.map(async (uri) => {
        return await saveMediaMetadata(uri, {
          type: 'video',
          caption: 'Batch updated caption',
        });
      })
    );

    const successCount = results.filter(Boolean).length;
    Alert.alert('Success', `Updated ${successCount} of ${mediaUris.length} items`);
  };

  return (
    <View>
      <Text>Batch Operations Example</Text>
      <Button title="Update All" onPress={handleBatchSave} />
    </View>
  );
};

// Example 9: Conditional metadata saving
export const ConditionalSaveExample = () => {
  const mediaUri = 'file:///path/to/videos/video_1234567890.mp4';

  const handleConditionalSave = async (
    caption: string,
    emojis: EmojiOverlay[]
  ) => {
    // Only save if there are changes
    if (!caption && emojis.length === 0) {
      Alert.alert('Info', 'No changes to save');
      return;
    }

    const success = await saveMediaMetadata(mediaUri, {
      type: 'video',
      caption: caption || undefined,
      emojis: emojis.length > 0 ? emojis : undefined,
    });

    if (success) {
      Alert.alert('Success', 'Changes saved!');
    }
  };

  return (
    <View>
      <Text>Conditional Save Example</Text>
      <Button
        title="Save if Changed"
        onPress={() => handleConditionalSave('New caption', [])}
      />
    </View>
  );
};

// Example 10: Error handling
export const ErrorHandlingExample = () => {
  const mediaUri = 'file:///path/to/videos/video_1234567890.mp4';

  const handleSaveWithErrorHandling = async () => {
    try {
      // Validate media URI exists
      const metadata = await loadMediaMetadata(mediaUri);
      
      const success = await saveMediaMetadata(mediaUri, {
        type: 'video',
        caption: 'New caption',
      });

      if (!success) {
        throw new Error('Save operation failed');
      }

      Alert.alert('Success', 'Metadata saved successfully!');
    } catch (error) {
      console.error('Save error:', error);
      
      if (error instanceof Error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert('Error', 'An unexpected error occurred');
      }
    }
  };

  return (
    <View>
      <Text>Error Handling Example</Text>
      <Button title="Save with Validation" onPress={handleSaveWithErrorHandling} />
    </View>
  );
};
