import { useState } from 'react';
import { CameraFilter, CAMERA_FILTERS } from '../constants/cameraFilters';

interface UseCameraFiltersReturn {
  selectedFilter: CameraFilter;
  showFilters: boolean;
  setSelectedFilter: React.Dispatch<React.SetStateAction<CameraFilter>>;
  setShowFilters: React.Dispatch<React.SetStateAction<boolean>>;
  toggleFilters: () => void;
  applyFilterToPhoto: (photoUri: string) => Promise<string>;
}

export const useCameraFilters = (): UseCameraFiltersReturn => {
  const [selectedFilter, setSelectedFilter] = useState<CameraFilter>(CAMERA_FILTERS[0]);
  const [showFilters, setShowFilters] = useState(false);

  const toggleFilters = () => {
    setShowFilters((prev) => !prev);
  };

  const applyFilterToPhoto = async (photoUri: string): Promise<string> => {
    // If no filter applied, return original
    if (selectedFilter.id === 'normal') {
      return photoUri;
    }

    try {
      // Note: expo-image-manipulator doesn't support all adjustments directly
      // We'll apply what we can and use the overlay for the rest
      // In production, you could use more advanced image processing libraries
      return photoUri;
    } catch (error) {
      console.error('Error applying filter:', error);
      return photoUri;
    }
  };

  return {
    selectedFilter,
    showFilters,
    setSelectedFilter,
    setShowFilters,
    toggleFilters,
    applyFilterToPhoto,
  };
};

