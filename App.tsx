import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { FeedScreen } from './src/screens/FeedScreen';
import { MediaRecorderScreen } from './src/screens/MediaRecorderScreen';
import { MediaGalleryScreen } from './src/screens/MediaGalleryScreen';

type Screen = 'feed' | 'recorder' | 'gallery';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('feed');
  const [editingVideoUri, setEditingVideoUri] = useState<string | null>(null);
  const [editingVideoSegments, setEditingVideoSegments] = useState<string[] | undefined>(undefined);

  const navigateToRecorder = () => {
    setEditingVideoUri(null);
    setEditingVideoSegments(undefined);
    setCurrentScreen('recorder');
  };

  const navigateToRecorderWithVideo = (videoUri: string, segments?: string[]) => {
    setEditingVideoUri(videoUri);
    setEditingVideoSegments(segments);
    setCurrentScreen('recorder');
  };

  const navigateToGallery = () => {
    setCurrentScreen('gallery');
  };

  const navigateToFeed = () => {
    setCurrentScreen('feed');
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'feed':
        return (
          <FeedScreen
            onRecordVideo={navigateToRecorder}
            onViewGallery={navigateToGallery}
          />
        );
      case 'recorder':
        return (
          <MediaRecorderScreen
            onBack={navigateToFeed}
            existingVideoUri={editingVideoUri}
            existingVideoSegments={editingVideoSegments}
            onVideoSaved={() => {
              // Navigate back to feed after saving
              setEditingVideoUri(null);
              setEditingVideoSegments(undefined);
              navigateToFeed();
            }}
          />
        );
      case 'gallery':
        return (
          <MediaGalleryScreen
            onBack={navigateToFeed}
            onRecordMoreSegments={navigateToRecorderWithVideo}
          />
        );
      default:
        return (
          <FeedScreen
            onRecordVideo={navigateToRecorder}
            onViewGallery={navigateToGallery}
          />
        );
    }
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      {renderScreen()}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});

