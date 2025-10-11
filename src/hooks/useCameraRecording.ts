import { useState, useRef } from 'react';
import { Alert } from 'react-native';
import { CameraView } from 'expo-camera';

interface UseCameraRecordingReturn {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  videoSegments: string[];
  setVideoSegments: React.Dispatch<React.SetStateAction<string[]>>;
  setRecordingTime: React.Dispatch<React.SetStateAction<number>>;
  setIsPaused: React.Dispatch<React.SetStateAction<boolean>>;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  resumeRecording: () => void;
  formatTime: (seconds: number) => string;
  timerRef: React.MutableRefObject<NodeJS.Timeout | null>;
  cameraRef: React.RefObject<CameraView | null>;
}

export const useCameraRecording = (): UseCameraRecordingReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [videoSegments, setVideoSegments] = useState<string[]>([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const cameraRef = useRef<CameraView>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    if (cameraRef.current && !isRecording) {
      try {
        setIsRecording(true);
        setIsPaused(false);
        
        // Resume timer from where it left off
        timerRef.current = setInterval(() => {
          setRecordingTime((prev) => prev + 1);
        }, 1000);
        
        const video = await cameraRef.current.recordAsync({
          maxDuration: 60, // 60 seconds max
        });
        
        if (video && video.uri) {
          // Add segment to list
          setVideoSegments((prev) => [...prev, video.uri]);
        }
      } catch (error) {
        console.error('Error recording video:', error);
        Alert.alert('Error', 'Failed to record video');
      } finally {
        setIsRecording(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      }
    }
  };

  const stopRecording = () => {
    if (cameraRef.current && isRecording) {
      setIsPaused(true);
      cameraRef.current.stopRecording();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const resumeRecording = () => {
    if (isPaused && !isRecording) {
      startRecording();
    }
  };

  return {
    isRecording,
    isPaused,
    recordingTime,
    videoSegments,
    setVideoSegments,
    setRecordingTime,
    setIsPaused,
    startRecording,
    stopRecording,
    resumeRecording,
    formatTime,
    timerRef,
    cameraRef,
  };
};

