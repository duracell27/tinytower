import React, { useEffect } from 'react';
import {
  View, Text, Pressable, Modal, ScrollView, StyleSheet, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing, runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { gameConfig } from '../../shared/config/gameConfig';
import type { UnderConstructionState } from '../../shared/types';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.7;
const SHEET_TIMING = { duration: 320, easing: Easing.bezier(0.4, 0, 0.2, 1) };
const SWIPE_CLOSE_THRESHOLD = 80;
const VELOCITY_CLOSE_THRESHOLD = 500;

const FLOOR_TYPE_NAMES: Record<string, string> = {
  green:  'Products',
  blue:   'Service',
  yellow: 'Rest',
  purple: 'Fashion',
  red:    'Electronics',
};

const FLOOR_TYPE_ICONS: Record<string, ReturnType<typeof require>> = {
  green:  require('../../assets/img/flourTypes/products.png'),
  blue:   require('../../assets/img/flourTypes/service.png'),
  yellow: require('../../assets/img/flourTypes/rest.png'),
  purple: require('../../assets/img/flourTypes/fashion.png'),
  red:    require('../../assets/img/flourTypes/electronics.png'),
};

interface BusinessTypePickerSheetProps {
  visible: boolean;
  underConstruction: UnderConstructionState;
  onClose: () => void;
  onSelectType: (floorType: string) => void;
  exhaustedTypes?: Set<string>;
}

export default function BusinessTypePickerSheet({
  visible,
  underConstruction,
  onClose,
  onSelectType,
  exhaustedTypes = new Set(),
}: BusinessTypePickerSheetProps) {
  const translateY = useSharedValue(SHEET_HEIGHT);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, SHEET_TIMING);
    } else {
      translateY.value = withTiming(SHEET_HEIGHT, SHEET_TIMING);
    }
  }, [visible]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const panGesture = Gesture.Pan()
    .activeOffsetY(5)
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (e.translationY > SWIPE_CLOSE_THRESHOLD || e.velocityY > VELOCITY_CLOSE_THRESHOLD) {
        translateY.value = withTiming(SHEET_HEIGHT, SHEET_TIMING);
        runOnJS(onClose)();
      } else {
        translateY.value = withTiming(0, SHEET_TIMING);
      }
    });

  const floorTypes = Object.keys(gameConfig.floorTypes);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />
      <Animated.View style={[styles.sheet, sheetStyle]}>

        <GestureDetector gesture={panGesture}>
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>
        </GestureDetector>

        <View style={styles.titleRow}>
          <Text style={styles.title}>Choose business type</Text>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>
        <Text style={styles.subtitle}>Floor {underConstruction.floorId}</Text>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {floorTypes.map((ft) => {
            const isExhausted = exhaustedTypes.has(ft);
            return (
              <Pressable
                key={ft}
                onPress={isExhausted ? undefined : () => onSelectType(ft)}
                accessibilityState={{ disabled: isExhausted }}
                style={({ pressed }) => [
                  styles.typeRow,
                  isExhausted && styles.typeRowExhausted,
                  !isExhausted && pressed && { opacity: 0.82 },
                ]}
              >
                <Image
                  source={FLOOR_TYPE_ICONS[ft]}
                  style={styles.iconSwatch}
                  contentFit="contain"
                />
                <View style={styles.typeTextCol}>
                  <Text style={styles.typeName}>{FLOOR_TYPE_NAMES[ft] ?? ft}</Text>
                  {isExhausted && (
                    <Text style={styles.typeExhaustedHint}>
                      All floors of this category already built
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(18,26,44,0.5)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F4ECEF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: SHEET_HEIGHT,
    paddingBottom: 30,
    shadowColor: 'rgba(20,30,50,1)',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.28,
    shadowRadius: 30,
    elevation: 10,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  handle: { width: 38, height: 4, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.18)' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 2,
  },
  title: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 20,
    color: '#2A3344',
    flex: 1,
    textAlign: 'center',
    marginLeft: 40,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { fontSize: 14, color: '#5A6375', fontWeight: '700', lineHeight: 16 },
  subtitle: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 13,
    color: '#9BA3B0',
    textAlign: 'center',
    marginBottom: 12,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, gap: 10, paddingBottom: 16 },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: 'rgba(40,60,90,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  iconSwatch: { width: 44, height: 44, borderRadius: 10 },
  typeTextCol: {
    flex: 1,
  },
  typeName: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
    color: '#2A3344',
  },
  typeRowExhausted: {
    opacity: 0.4,
  },
  typeExhaustedHint: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 12,
    color: '#9BA3B0',
    marginTop: 1,
  },
});
