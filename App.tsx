import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { FeedScreen } from './src/screens/FeedScreen';
import { VideoRecorderScreen } from './src/screens/VideoRecorderScreen';
import { VideoGalleryScreen } from './src/screens/VideoGalleryScreen';

type Screen = 'feed' | 'recorder' | 'gallery';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('feed');
  const [editingVideoUri, setEditingVideoUri] = useState<string | null>(null);

  const navigateToRecorder = () => {
    setEditingVideoUri(null);
    setCurrentScreen('recorder');
  };

  const navigateToRecorderWithVideo = (videoUri: string) => {
    setEditingVideoUri(videoUri);
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
          <VideoRecorderScreen
            onBack={navigateToFeed}
            existingVideoUri={editingVideoUri}
            onVideoSaved={() => {
              // Navigate back to feed after saving
              setEditingVideoUri(null);
              navigateToFeed();
            }}
          />
        );
      case 'gallery':
        return (
          <VideoGalleryScreen
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

  return <View style={styles.container}>{renderScreen()}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});

