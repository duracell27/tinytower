import React, { useMemo, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  SectionList,
  Modal,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useGameStore } from '../stores/gameStore';
import { gameConfig } from '../../shared/config/gameConfig';
import { getWorkerForSlot } from '../../shared/engine/workerUtils';
import { FLOOR_SCHEMES } from './FloorCard';
import WorkerAvatar from './WorkerAvatar';
import type { Worker } from '../../shared/types';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_TIMING = { duration: 420, easing: Easing.bezier(0.4, 0, 0.2, 1) };
const SCRIM_TIMING = { duration: 400, easing: Easing.linear };

interface JobPickerSheetProps {
  visible: boolean;
  worker: Worker | null;
  onClose: () => void;
}

interface SlotItem {
  floorId: number;
  slotIdx: number;
  typeId: string;
  matchLevel: 'dream' | 'match' | 'other';
}

interface FloorSection {
  floorId: number;
  floorName: string;
  floorType: string;
  data: SlotItem[];
}

const MATCH_BADGES = {
  dream: {
    label: 'Робота мрії · 2x',
    bg: 'rgba(82,184,71,0.15)',
    text: '#4E9A2E',
  },
  match: {
    label: 'Підходящий тип · 1.3x',
    bg: 'rgba(240,185,42,0.15)',
    text: '#B07F12',
  },
  other: {
    label: 'Інший тип · 1x',
    bg: 'rgba(0,0,0,0.05)',
    text: '#9098A6',
  },
} as const;

export default function JobPickerSheet({
  visible,
  worker,
  onClose,
}: JobPickerSheetProps) {
  const scrimOpacity = useSharedValue(0);
  const sheetTranslateY = useSharedValue(102);

  const workers = useGameStore((s) => s.workers);

  useEffect(() => {
    if (visible) {
      scrimOpacity.value = withTiming(1, SCRIM_TIMING);
      sheetTranslateY.value = withTiming(0, SHEET_TIMING);
    } else {
      scrimOpacity.value = withTiming(0, SCRIM_TIMING);
      sheetTranslateY.value = withTiming(102, SHEET_TIMING);
    }
  }, [visible]);

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: scrimOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (sheetTranslateY.value / 100) * SCREEN_HEIGHT }],
  }));

  const sections = useMemo((): FloorSection[] => {
    if (!worker) return [];

    const result: FloorSection[] = [];

    for (const floorConfig of gameConfig.floors) {
      const slots: SlotItem[] = [];

      for (let slotIdx = 0; slotIdx < floorConfig.slots; slotIdx++) {
        const assigned = getWorkerForSlot(workers, floorConfig.id, slotIdx);
        if (assigned) continue;

        const typeId = floorConfig.availableTypes[slotIdx];
        if (!typeId) continue;

        let matchLevel: SlotItem['matchLevel'] = 'other';
        if (floorConfig.floorType === worker.floorType) {
          if (typeId === worker.dreamJob) {
            matchLevel = 'dream';
          } else {
            matchLevel = 'match';
          }
        }

        slots.push({ floorId: floorConfig.id, slotIdx, typeId, matchLevel });
      }

      if (slots.length === 0) continue;

      // Sort within floor: dream job first, then match, then other
      const matchOrder = { dream: 0, match: 1, other: 2 };
      slots.sort((a, b) => matchOrder[a.matchLevel] - matchOrder[b.matchLevel]);

      result.push({
        floorId: floorConfig.id,
        floorName: floorConfig.name,
        floorType: floorConfig.floorType,
        data: slots,
      });
    }

    // Sort sections: matching floorType first
    result.sort((a, b) => {
      const aMatch = a.floorType === worker.floorType ? 0 : 1;
      const bMatch = b.floorType === worker.floorType ? 0 : 1;
      return aMatch - bMatch;
    });

    return result;
  }, [worker, workers]);

  const handleAssign = (floorId: number, slotIdx: number) => {
    if (!worker) return;
    useGameStore.getState().assignWorker(worker.id, floorId, slotIdx);
    onClose();
  };

  const ft = worker ? gameConfig.floorTypes[worker.floorType] : null;
  const accent = ft?.accent ?? '#888';
  const category = ft?.category ?? worker?.floorType ?? '';

  const isEmpty = sections.length === 0;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Scrim */}
        <Animated.View style={[styles.scrim, scrimStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* Sheet */}
        <Animated.View style={[styles.sheet, sheetStyle]}>
        {/* Header */}
        <LinearGradient colors={['#6C7C92', '#56657C']} style={styles.header}>
          {/* Drag handle */}
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>

          {/* Title row */}
          <View style={styles.titleRow}>
            <View style={styles.titleLeft}>
              {worker && <WorkerAvatar worker={worker} size={36} />}
              <View style={styles.titleInfo}>
                <Text style={styles.nameText} numberOfLines={1}>
                  {worker?.name ?? ''}
                </Text>
                <View
                  style={[styles.typePill, { backgroundColor: accent }]}
                >
                  <Text style={styles.typePillText}>{category}</Text>
                </View>
              </View>
            </View>

            {/* Close button */}
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M18 6L6 18M6 6l12 12"
                  stroke="#fff"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </Pressable>
          </View>
        </LinearGradient>

        {/* Body */}
        {isEmpty ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Всі місця зайняті</Text>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) =>
              `${item.floorId}-${item.slotIdx}`
            }
            renderSectionHeader={({ section }) => (
              <SectionHeader section={section} />
            )}
            renderItem={({ item }) => (
              <SlotRow item={item} onAssign={handleAssign} />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            style={styles.list}
            stickySectionHeadersEnabled={false}
          />
        )}
      </Animated.View>
      </View>
    </Modal>
  );
}

function SectionHeader({ section }: { section: FloorSection }) {
  const scheme = FLOOR_SCHEMES[section.floorId];
  const headerColors = scheme?.headerColors ?? ['#888', '#777'];

  return (
    <View style={sectionStyles.container}>
      <LinearGradient
        colors={headerColors}
        style={sectionStyles.header}
      >
        <View style={sectionStyles.numberBadge}>
          <Text style={sectionStyles.numberText}>{section.floorId}</Text>
        </View>
        <Text style={sectionStyles.floorName}>{section.floorName}</Text>
      </LinearGradient>
    </View>
  );
}

function SlotRow({
  item,
  onAssign,
}: {
  item: SlotItem;
  onAssign: (floorId: number, slotIdx: number) => void;
}) {
  const productConfig = gameConfig.productionTypes[item.typeId];
  const productName = productConfig?.displayName ?? item.typeId;
  const badge = MATCH_BADGES[item.matchLevel];

  return (
    <View style={slotStyles.row}>
      <Text style={slotStyles.productName} numberOfLines={1}>
        {productName}
      </Text>

      <View style={[slotStyles.badge, { backgroundColor: badge.bg }]}>
        <Text style={[slotStyles.badgeText, { color: badge.text }]}>
          {badge.label}
        </Text>
      </View>

      <Pressable
        onPress={() => onAssign(item.floorId, item.slotIdx)}
        style={({ pressed }) => [
          slotStyles.assignButton,
          pressed && slotStyles.assignButtonPressed,
        ]}
      >
        <LinearGradient
          colors={['#72C24F', '#5BA63C']}
          style={slotStyles.assignButtonGradient}
        >
          <Text style={slotStyles.assignButtonText}>Призначити</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18,26,44,0.5)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 56,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: '#EAEDF2',
    overflow: 'hidden',
  },
  header: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingBottom: 14,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 8,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  titleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  titleInfo: {
    flex: 1,
    gap: 4,
  },
  nameText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
    color: '#fff',
  },
  typePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  typePillText: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 11,
    color: '#fff',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 14,
    paddingBottom: 40,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 14,
    color: '#9098A6',
  },
});

const sectionStyles = StyleSheet.create({
  container: {
    marginBottom: 8,
    marginTop: 6,
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 31,
    paddingHorizontal: 12,
  },
  numberBadge: {
    width: 21,
    height: 21,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.26)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  numberText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12,
    color: '#fff',
  },
  floorName: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.6,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
});

const slotStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
    gap: 8,
  },
  productName: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13.5,
    color: '#2A3344',
    flex: 1,
    minWidth: 0,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 10.5,
  },
  assignButton: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  assignButtonPressed: {
    opacity: 0.85,
  },
  assignButtonGradient: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  assignButtonText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
});
