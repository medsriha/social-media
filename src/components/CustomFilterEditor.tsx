import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Dimensions, Animated, PanResponder } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { CustomFilterValues } from '../constants/cameraFilters';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CustomFilterEditorProps {
  visible: boolean;
  initialValues: CustomFilterValues;
  onClose: () => void;
  onApply: (values: CustomFilterValues) => void;
  onReset: () => void;
}

interface FilterParameter {
  key: keyof CustomFilterValues;
  label: string;
  icon: string;
  type: 'slider' | 'color';
  min?: number;
  max?: number;
  colors?: string[];
}

const FILTER_PARAMETERS: FilterParameter[] = [
  { key: 'brightness', label: 'Brightness', icon: 'brightness-6', type: 'slider', min: -1, max: 1 },
  { key: 'contrast', label: 'Contrast', icon: 'contrast', type: 'slider', min: -1, max: 1 },
  { key: 'saturation', label: 'Saturation', icon: 'palette', type: 'slider', min: -1, max: 1 },
  { key: 'warmth', label: 'Warmth', icon: 'wb-sunny', type: 'slider', min: -1, max: 1 },
  { key: 'structure', label: 'Structure', icon: 'tune', type: 'slider', min: -1, max: 1 },
  { 
    key: 'tint', 
    label: 'Color', 
    icon: 'color-lens', 
    type: 'color',
    colors: ['#000000', '#ff0000', '#ff6b35', '#FFD700', '#00ff00', '#4A90E2', '#9370DB']
  },
];

export const CustomFilterEditor: React.FC<CustomFilterEditorProps> = ({
  visible,
  initialValues,
  onClose,
  onApply,
  onReset,
}) => {
  const [values, setValues] = useState<CustomFilterValues>(initialValues);
  const [currentPage, setCurrentPage] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const translateY = useRef(new Animated.Value(0)).current;

  // Pan responder for drag-to-dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to vertical drags
        return Math.abs(gestureState.dy) > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow dragging down
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // If dragged down more than 100px, close the modal
        if (gestureState.dy > 100) {
          Animated.timing(translateY, {
            toValue: 300,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            onClose();
            translateY.setValue(0);
          });
        } else {
          // Spring back to original position
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const handleValueChange = (key: keyof CustomFilterValues, value: number | string) => {
    const newValues = { ...values, [key]: value };
    setValues(newValues);
    onApply(newValues); // Real-time preview
  };

  const handleReset = () => {
    const resetValues: CustomFilterValues = {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      warmth: 0,
      structure: 0,
      tint: '#000000',
    };
    setValues(resetValues);
    onApply(resetValues);
    onReset();
  };

  const formatValue = (value: number) => {
    return value > 0 ? `+${Math.round(value * 100)}` : `${Math.round(value * 100)}`;
  };

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / SCREEN_WIDTH);
    setCurrentPage(page);
  };

  const renderParameter = (param: FilterParameter, index: number) => {
    if (param.type === 'slider') {
      const value = values[param.key] as number;
      return (
        <View key={param.key} style={styles.parameterPage}>
          <View style={styles.parameterHeader}>
            <MaterialIcons name={param.icon as any} size={28} color="#ff0050" />
            <Text style={styles.parameterLabel}>{param.label}</Text>
            <Text style={styles.parameterValue}>{formatValue(value)}</Text>
          </View>
          
          <Slider
            style={styles.slider}
            minimumValue={param.min || -1}
            maximumValue={param.max || 1}
            value={value}
            onValueChange={(val) => handleValueChange(param.key, val)}
            minimumTrackTintColor="#ff0050"
            maximumTrackTintColor="#444"
            thumbTintColor="#ff0050"
          />
          
          {(param.key === 'warmth' || param.key === 'structure') && (
            <View style={styles.rangeIndicator}>
              <Text style={styles.rangeLabel}>
                {param.key === 'warmth' ? 'Cool' : 'Soft'}
              </Text>
              <Text style={styles.rangeLabel}>
                {param.key === 'warmth' ? 'Warm' : 'Sharp'}
              </Text>
            </View>
          )}
        </View>
      );
    } else {
      return (
        <View key={param.key} style={styles.parameterPage}>
          <View style={styles.parameterHeader}>
            <MaterialIcons name={param.icon as any} size={28} color="#ff0050" />
            <Text style={styles.parameterLabel}>{param.label}</Text>
          </View>
          
          <View style={styles.colorGrid}>
            {param.colors?.map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorOption,
                  { backgroundColor: color },
                  values.tint === color && styles.colorOptionActive,
                ]}
                onPress={() => handleValueChange('tint', color)}
              >
                {values.tint === color && (
                  <MaterialIcons name="check" size={24} color="#fff" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Backdrop - tap to dismiss */}
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1}
          onPress={onClose}
        />

        {/* Editor Panel with drag-to-dismiss */}
        <Animated.View 
          style={[
            styles.editorPanel,
            {
              transform: [{ translateY }],
            },
          ]}
        >
          {/* Drag Handle */}
          <View {...panResponder.panHandlers} style={styles.dragHandleContainer}>
            <View style={styles.dragHandle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleReset} style={styles.iconButton}>
              <MaterialIcons name="refresh" size={24} color="#ff0050" />
            </TouchableOpacity>
            
            <Text style={styles.title}>Custom Filter</Text>
            
            <TouchableOpacity onPress={onClose} style={styles.iconButton}>
              <MaterialIcons name="check" size={24} color="#ff0050" />
            </TouchableOpacity>
          </View>

          {/* Swipeable Parameters */}
          <ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            style={styles.pager}
          >
            {FILTER_PARAMETERS.map((param, index) => renderParameter(param, index))}
          </ScrollView>

          {/* Page Indicators */}
          <View style={styles.pageIndicators}>
            {FILTER_PARAMETERS.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.pageIndicator,
                  currentPage === index && styles.pageIndicatorActive,
                ]}
              />
            ))}
          </View>

          {/* Swipe Hint */}
          <Text style={styles.swipeHint}>Swipe to adjust • Drag down to close</Text>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  editorPanel: {
    backgroundColor: 'rgba(26, 26, 26, 0.98)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  pager: {
    height: 160,
  },
  parameterPage: {
    width: SCREEN_WIDTH,
    paddingHorizontal: 30,
    paddingVertical: 20,
    justifyContent: 'center',
  },
  parameterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  parameterLabel: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  parameterValue: {
    color: '#ff0050',
    fontSize: 18,
    fontWeight: 'bold',
    minWidth: 60,
    textAlign: 'right',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  rangeIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  rangeLabel: {
    color: '#999',
    fontSize: 13,
  },
  colorGrid: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  colorOption: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#333',
  },
  colorOptionActive: {
    borderColor: '#ff0050',
    borderWidth: 4,
  },
  pageIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  pageIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#444',
  },
  pageIndicatorActive: {
    backgroundColor: '#ff0050',
    width: 20,
  },
  swipeHint: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    paddingBottom: 8,
  },
});

