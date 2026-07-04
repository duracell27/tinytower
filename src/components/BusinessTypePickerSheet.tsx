import React, { useState, useEffect } from 'react';
import {
  View, Text, Pressable, Modal, ScrollView, StyleSheet, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing,
} from 'react-native-reanimated';
import { useGameStore } from '../stores/gameStore';
import { gameConfig } from '../../shared/config/gameConfig';
import type { UnderConstructionState } from '../../shared/types';

type ToolKey = 'briks' | 'glass' | 'nails' | 'screw';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.7;
const SHEET_TIMING = { duration: 380, easing: Easing.bezier(0.4, 0, 0.2, 1) };

const TOOL_IMAGES: Record<ToolKey, ReturnType<typeof require>> = {
  briks: require('../../assets/img/tools/briks.png'),
  glass: require('../../assets/img/tools/glass.png'),
  nails: require('../../assets/img/tools/nails.png'),
  screw: require('../../assets/img/tools/screw.png'),
};

const TOOL_NAMES: Record<ToolKey, string> = {
  briks: 'Цегла',
  glass: 'Скло',
  nails: 'Цвяхи',
  screw: 'Гвинти',
};

const FLOOR_TYPE_NAMES: Record<string, string> = {
  green:  'Пекарня',
  blue:   'Пральня',
  yellow: 'Кафе',
  violet: 'Ательє',
  red:    'Морозиво',
};

const FLOOR_TYPE_COLORS: Record<string, [string, string]> = {
  green:  ['#5E8F42', '#3E6F22'],
  blue:   ['#2E6EC9', '#0E4EA9'],
  yellow: ['#E7A52B', '#C7850B'],
  violet: ['#9A6FD0', '#7A4FB0'],
  red:    ['#4C9BDD', '#2C7BBD'],
};

interface BusinessTypePickerSheetProps {
  visible: boolean;
  underConstruction: UnderConstructionState;
  onClose: () => void;
  onOpen: (floorType: string) => void;
}

export default function BusinessTypePickerSheet({
  visible,
  underConstruction,
  onClose,
  onOpen,
}: BusinessTypePickerSheetProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const tools = useGameStore((s) => s.tools);
  const translateY = useSharedValue(SHEET_HEIGHT);

  useEffect(() => {
    if (visible) {
      setSelectedType(null);
      translateY.value = withTiming(0, SHEET_TIMING);
    } else {
      translateY.value = withTiming(SHEET_HEIGHT, SHEET_TIMING);
    }
  }, [visible]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const floorTypes = Object.keys(gameConfig.floorTypes);
  const requiredTool = underConstruction.requiredTool as ToolKey;
  const requiredCount = underConstruction.requiredCount;
  const available = (tools?.[requiredTool] ?? 0) >= requiredCount;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />
      <Animated.View style={[styles.sheet, sheetStyle]}>
        {/* Handle */}
        <View style={styles.handleRow}>
          <View style={styles.handle} />
        </View>

        <Text style={styles.title}>Вибери тип бізнесу</Text>
        <Text style={styles.subtitle}>Поверх {underConstruction.floorId}</Text>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {floorTypes.map((ft) => {
            const colors = FLOOR_TYPE_COLORS[ft] ?? ['#888', '#666'];
            const isSelected = selectedType === ft;
            return (
              <Pressable
                key={ft}
                onPress={() => setSelectedType(isSelected ? null : ft)}
                style={({ pressed }) => [
                  styles.typeRow,
                  isSelected && styles.typeRowSelected,
                  pressed && { opacity: 0.85 },
                ]}
              >
                {/* Color swatch */}
                <LinearGradient
                  colors={colors as [string, string]}
                  style={styles.colorSwatch}
                />
                <Text style={styles.typeName}>{FLOOR_TYPE_NAMES[ft] ?? ft}</Text>
                {isSelected && (
                  <View style={styles.checkDot} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Tool requirement row — shows only when a type is selected */}
        {selectedType && (
          <View style={styles.requirementCard}>
            <Image
              source={TOOL_IMAGES[requiredTool]}
              style={{ width: 32, height: 32 }}
              contentFit="contain"
            />
            <View style={styles.requirementInfo}>
              <Text style={styles.requirementLabel}>Потрібно:</Text>
              <Text style={[
                styles.requirementValue,
                { color: available ? '#49AA38' : '#E05050' },
              ]}>
                {`${requiredCount} ${TOOL_NAMES[requiredTool]}`}
              </Text>
              <Text style={styles.requirementHave}>
                {`На складі: ${tools?.[requiredTool] ?? 0}`}
              </Text>
            </View>

            <Pressable
              onPress={() => available && onOpen(selectedType)}
              style={({ pressed }) => [
                styles.openBizBtn,
                !available && styles.openBizBtnDisabled,
                pressed && available && { opacity: 0.85 },
              ]}
            >
              <LinearGradient
                colors={available ? ['#72C24F', '#5BA63C'] : ['#B7BDC8', '#A2A9B6']}
                style={styles.openBizGradient}
              >
                <Text style={styles.openBizText}>Відкрити бізнес</Text>
              </LinearGradient>
              {available && <View style={styles.openBizShadow} />}
            </Pressable>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
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
  handleRow: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handle: { width: 38, height: 4, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.18)' },
  title: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 20,
    color: '#2A3344',
    textAlign: 'center',
    marginTop: 4,
  },
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
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: 'rgba(40,60,90,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  typeRowSelected: {
    borderColor: '#E67E22',
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  typeName: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
    color: '#2A3344',
    flex: 1,
  },
  checkDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E67E22',
  },
  requirementCard: {
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: 'rgba(40,60,90,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.13,
    shadowRadius: 6,
    elevation: 3,
  },
  requirementInfo: { flex: 1 },
  requirementLabel: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 12,
    color: '#9BA3B0',
  },
  requirementValue: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 15,
  },
  requirementHave: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 12,
    color: '#9BA3B0',
  },
  openBizBtn: {
    borderRadius: 13,
    overflow: 'hidden',
    position: 'relative',
  },
  openBizBtnDisabled: {
    opacity: 0.7,
  },
  openBizGradient: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 13,
    zIndex: 1,
  },
  openBizText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 14,
    color: '#fff',
  },
  openBizShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#4A8A2E',
    borderBottomLeftRadius: 13,
    borderBottomRightRadius: 13,
  },
});
