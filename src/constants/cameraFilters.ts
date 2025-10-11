// Camera filter definitions for MediaRecorderScreen

export interface CameraFilter {
  id: string;
  name: string;
  style: {
    backgroundColor?: string;
    opacity?: number;
  };
  // Image manipulator matrix for photos (brightness, contrast, saturation, etc)
  imageManipulation?: {
    brightness?: number;
    contrast?: number;
    saturation?: number;
  };
}

export const CAMERA_FILTERS: CameraFilter[] = [
  {
    id: 'normal',
    name: 'Normal',
    style: {},
  },
  {
    id: 'bw',
    name: 'B&W',
    style: {
      backgroundColor: '#000',
      opacity: 0.5,
    },
    imageManipulation: {
      saturation: -1,
    },
  },
  {
    id: 'sepia',
    name: 'Sepia',
    style: {
      backgroundColor: '#704214',
      opacity: 0.4,
    },
    imageManipulation: {
      saturation: -0.3,
      brightness: 0.1,
    },
  },
  {
    id: 'vintage',
    name: 'Vintage',
    style: {
      backgroundColor: '#ff6b35',
      opacity: 0.3,
    },
    imageManipulation: {
      contrast: 0.1,
      saturation: -0.2,
    },
  },
  {
    id: 'cool',
    name: 'Cool',
    style: {
      backgroundColor: '#4A90E2',
      opacity: 0.25,
    },
    imageManipulation: {
      brightness: -0.05,
    },
  },
  {
    id: 'warm',
    name: 'Warm',
    style: {
      backgroundColor: '#FF9500',
      opacity: 0.3,
    },
    imageManipulation: {
      brightness: 0.05,
    },
  },
  {
    id: 'dramatic',
    name: 'Dramatic',
    style: {
      backgroundColor: '#000',
      opacity: 0.3,
    },
    imageManipulation: {
      contrast: 0.3,
      brightness: -0.1,
    },
  },
  {
    id: 'bright',
    name: 'Bright',
    style: {
      backgroundColor: '#fff',
      opacity: 0.2,
    },
    imageManipulation: {
      brightness: 0.2,
    },
  },
];

