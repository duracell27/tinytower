import React, { useEffect } from 'react';
import {
  View, Text, Pressable, Modal, ScrollView, StyleSheet, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useOnboardingStore } from '../stores/onboardingStore';
import { useAppTheme } from '../hooks/useAppTheme';

const ICON_FLOOR  = require('../../assets/img/floor.png');

const TYPE_COLORS: Record<string, string> = {
  green:  '#3FA535',
  blue:   '#3376E5',
  yellow: '#E5A72E',
  purple: '#9A6FD0',
  red:    '#E05A4A',
};

const WORKER_ICONS: Record<string, ReturnType<typeof require>> = {
  green:  require('../../assets/img/workers/man-green.png'),
  blue:   require('../../assets/img/workers/man-blue.png'),
  yellow: require('../../assets/img/workers/man-yellow.png'),
  purple: require('../../assets/img/workers/man-violet.png'),
  red:    require('../../assets/img/workers/man-red.png'),
};
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence, Easing, runOnJS,
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
  builtFloorCounts?: Record<string, number>;
  hotelWorkerCounts?: Record<string, number>;
}

export default function BusinessTypePickerSheet({
  visible,
  underConstruction,
  onClose,
  onSelectType,
  exhaustedTypes = new Set(),
  builtFloorCounts = {},
  hotelWorkerCounts = {},
}: BusinessTypePickerSheetProps) {
  const theme = useAppTheme();
  const { isDark } = theme;
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

  const onboardingStep = useOnboardingStore((s) => s.step);
  const isLocked = onboardingStep === 'choose_floor_type';

  const panGesture = Gesture.Pan()
    .enabled(!isLocked)
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

  const arrowX = useSharedValue(0);
  useEffect(() => {
    if (onboardingStep !== 'choose_floor_type') { arrowX.value = 0; return; }
    arrowX.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 350, easing: Easing.out(Easing.quad) }),
        withTiming(0,   { duration: 350, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [onboardingStep]);
  const arrowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: arrowX.value }] }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={isLocked ? undefined : onClose}>
      <Pressable style={styles.scrim} onPress={isLocked ? undefined : onClose} />
      <Animated.View style={[styles.sheet, sheetStyle, { backgroundColor: isDark ? 'rgba(22,26,22,0.99)' : theme.surfaceSub }]}>

        {onboardingStep === 'choose_floor_type' && (
          <View style={[pickerHint.card, { backgroundColor: theme.surface }, isDark && { borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }]}>
            <Image source={require('../../assets/img/happySmile.png')} style={pickerHint.icon} contentFit="contain" />
            <Text style={[pickerHint.text, { color: isDark ? '#E8EDE4' : '#1a1a1a' }]}>
              {'All types earn equally. Green floors need frequent attention, red ones less often'}
            </Text>
          </View>
        )}

        <GestureDetector gesture={panGesture}>
          <View style={styles.handleRow}>
            <View style={[styles.handle, isDark && { backgroundColor: 'rgba(255,255,255,0.18)' }]} />
          </View>
        </GestureDetector>

        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.text }]}>Choose business type</Text>
          {!isLocked && (
            <Pressable onPress={onClose} style={[styles.closeBtn, isDark && { backgroundColor: theme.divider }]} hitSlop={8}>
              <Text style={[styles.closeBtnText, isDark && { color: '#A0AABC' }]}>✕</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.subtitle}>Floor {underConstruction.floorId}</Text>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {floorTypes.map((ft) => {
            const isExhausted = exhaustedTypes.has(ft);
            const showArrow = ft === 'yellow' && onboardingStep === 'choose_floor_type';
            return (
              <View key={ft} style={showArrow ? { position: 'relative' } : undefined}>
              <Pressable
                onPress={isExhausted ? undefined : () => onSelectType(ft)}
                accessibilityState={{ disabled: isExhausted }}
                style={({ pressed }) => [
                  styles.typeRow,
                  { backgroundColor: theme.surface },
                  isDark && { borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
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
                  <Text style={[styles.typeName, { color: TYPE_COLORS[ft] }]}>{FLOOR_TYPE_NAMES[ft] ?? ft}</Text>
                  {isExhausted ? (
                    <Text style={styles.typeExhaustedHint}>
                      All floors of this category already built
                    </Text>
                  ) : (
                    <View style={styles.typeStatsRow}>
                      <Image source={ICON_FLOOR} style={styles.typeStatIcon} contentFit="contain" />
                      <Text style={[styles.typeStatBuilt, { color: isDark ? theme.textMuted : '#2A3344' }]}>Built </Text>
                      <Text style={[styles.typeStatBuilt, { color: TYPE_COLORS[ft] }]}>{builtFloorCounts[ft] ?? 0}</Text>
                      <Text style={[styles.typeStatSep, isDark && { color: 'rgba(255,255,255,0.2)' }]}>·</Text>
                      <Image source={WORKER_ICONS[ft]} style={styles.typeStatIcon} contentFit="contain" />
                      <Text style={[styles.typeStat, { color: isDark ? theme.textMuted : '#7A8899' }]}>{hotelWorkerCounts[ft] ?? 0} waiting in the hotel</Text>
                    </View>
                  )}
                </View>
              </Pressable>
              {showArrow && (
                <Animated.View pointerEvents="none" style={[pickerHint.arrowOverlay, arrowStyle]}>
                  <Image
                    source={require('../../assets/img/greenArrowUp.png')}
                    style={pickerHint.arrowImg}
                    contentFit="contain"
                  />
                </Animated.View>
              )}
              </View>
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
  typeStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  typeStatIcon: {
    width: 13,
    height: 13,
  },
  typeStatBuilt: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12,
  },
  typeStat: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 12,
    color: '#7A8899',
  },
  typeStatSep: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 12,
    color: '#C0C8D4',
  },
});

const pickerHint = StyleSheet.create({
  card: {
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 0,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 4,
  },
  icon: {
    width: 24,
    height: 24,
    flexShrink: 0,
  },
  text: {
    flex: 1,
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: '#1a1a1a',
    lineHeight: 20,
  },
  arrowOverlay: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  arrowImg: {
    width: 36,
    height: 36,
    transform: [{ rotate: '-90deg' }],
  },
});

