import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { CameraFilter, CAMERA_FILTERS } from '../constants/cameraFilters';

interface FilterSelectorProps {
  selectedFilter: CameraFilter;
  onFilterSelect: (filter: CameraFilter) => void;
}

export const FilterSelector: React.FC<FilterSelectorProps> = ({
  selectedFilter,
  onFilterSelect,
}) => {
  return (
    <View style={styles.filterSelector}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {CAMERA_FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter.id}
            style={[
              styles.filterOption,
              selectedFilter.id === filter.id && styles.filterOptionActive,
            ]}
            onPress={() => onFilterSelect(filter)}
          >
            <View style={styles.filterPreview}>
              {filter.id === 'normal' ? (
                // Show icon for "No Filter" option
                <View style={styles.filterPreviewNoFilter}>
                  <MaterialIcons name="filter-none" size={32} color="#999" />
                </View>
              ) : filter.isCustom ? (
                // Show icon for "Custom" option
                <View style={styles.filterPreviewCustom}>
                  <MaterialIcons name="tune" size={32} color="#ff0050" />
                </View>
              ) : (
                <>
                  <View style={styles.filterPreviewImage} />
                  {filter.style.backgroundColor && (
                    <View
                      style={[
                        StyleSheet.absoluteFill,
                        {
                          backgroundColor: filter.style.backgroundColor,
                          opacity: filter.style.opacity || 0,
                          borderRadius: 8,
                        },
                      ]}
                    />
                  )}
                </>
              )}
            </View>
            <Text style={styles.filterName}>{filter.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  filterSelector: {
    position: 'absolute',
    bottom: 140,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
  },
  filterOption: {
    alignItems: 'center',
    marginHorizontal: 6,
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  filterOptionActive: {
    backgroundColor: 'rgba(255,0,80,0.6)',
    borderWidth: 2,
    borderColor: '#ff0050',
  },
  filterPreview: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 4,
  },
  filterPreviewImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#444',
  },
  filterPreviewNoFilter: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#666',
    borderStyle: 'dashed',
    borderRadius: 8,
  },
  filterPreviewCustom: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#ff0050',
    borderRadius: 8,
  },
  filterName: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },
});

