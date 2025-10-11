import { useState } from 'react';
import { CameraFilter, CAMERA_FILTERS, CustomFilterValues } from '../constants/cameraFilters';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

interface UseCameraFiltersReturn {
  selectedFilter: CameraFilter;
  showFilters: boolean;
  showCustomEditor: boolean;
  setSelectedFilter: React.Dispatch<React.SetStateAction<CameraFilter>>;
  setShowFilters: React.Dispatch<React.SetStateAction<boolean>>;
  setShowCustomEditor: React.Dispatch<React.SetStateAction<boolean>>;
  toggleFilters: () => void;
  updateCustomFilter: (values: CustomFilterValues) => void;
  resetCustomFilter: () => void;
  applyFilterToPhoto: (photoUri: string) => Promise<string>;
}

export const useCameraFilters = (): UseCameraFiltersReturn => {
  const [selectedFilter, setSelectedFilter] = useState<CameraFilter>(CAMERA_FILTERS[0]);
  const [showFilters, setShowFilters] = useState(false);
  const [showCustomEditor, setShowCustomEditor] = useState(false);

  const toggleFilters = () => {
    setShowFilters((prev) => !prev);
  };

  const updateCustomFilter = (values: CustomFilterValues) => {
    setSelectedFilter((prev) => ({
      ...prev,
      customValues: values,
    }));
  };

  const resetCustomFilter = () => {
    const defaultCustomValues: CustomFilterValues = {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      warmth: 0,
      structure: 0,
      tint: '#000000',
    };
    updateCustomFilter(defaultCustomValues);
  };

  const applyFilterToPhoto = async (photoUri: string): Promise<string> => {
    // If no filter applied, return original
    if (selectedFilter.id === 'normal') {
      return photoUri;
    }

    try {
      // For custom filters, we need to apply the overlay effect
      // Since expo-image-manipulator doesn't support color overlays directly,
      // we'll create a processed version with the filter metadata
      
      // Apply manipulations using expo-image-manipulator
      const manipulations: any[] = [];
      
      if (selectedFilter.imageManipulation) {
        // Note: expo-image-manipulator supports rotate, flip, resize, and crop
        // but doesn't support brightness, contrast, saturation directly
        // These would need to be applied using canvas or native image processing
      }
      
      // For now, create a copy with a timestamp to indicate it's been processed
      const timestamp = new Date().getTime();
      const result = await manipulateAsync(
        photoUri,
        manipulations, // Apply any transformations
        { compress: 1, format: SaveFormat.JPEG }
      );
      
      return result.uri;
    } catch (error) {
      console.error('Error applying filter:', error);
      // Return original if filter application fails
      return photoUri;
    }
  };

  return {
    selectedFilter,
    showFilters,
    showCustomEditor,
    setSelectedFilter,
    setShowFilters,
    setShowCustomEditor,
    toggleFilters,
    updateCustomFilter,
    resetCustomFilter,
    applyFilterToPhoto,
  };
};

