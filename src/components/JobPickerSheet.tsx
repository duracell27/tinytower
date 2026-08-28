import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  SectionList,
  Modal,
  StyleSheet,
  Dimensions,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../stores/gameStore';
import { useOnboardingStore } from '../stores/onboardingStore';
import { useAppTheme } from '../hooks/useAppTheme';
import { gameConfig } from '../../shared/config/gameConfig';
import { getWorkerForSlot } from '../../shared/engine/workerUtils';
import { clock } from '../services/clock';
import { FLOOR_TYPE_SCHEMES } from './FloorCard';
import { getProductionTimeRemaining } from './WorkerJobCard';
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
  occupant: Worker | null;
  floorName?: string;
}

interface FloorSection {
  floorId: number;
  floorType: string;
  data: SlotItem[];
  isOccupied?: boolean;
}

function formatTimeShort(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const totalMin = Math.floor(totalSec / 60);
  if (totalMin < 60) return `${totalMin}m`;
  const hours = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  return `${hours}h ${min}m`;
}

const MATCH_BADGE_STYLES = {
  dream: { bg: 'rgba(82,184,71,0.15)', text: '#4E9A2E' },
  match: { bg: 'rgba(240,185,42,0.15)', text: '#B07F12' },
  other: { bg: 'rgba(0,0,0,0.05)', text: '#9098A6' },
} as const;

export default function JobPickerSheet({
  visible,
  worker,
  onClose,
}: JobPickerSheetProps) {
  const theme = useAppTheme();
  const { isDark } = theme;

  const scrimOpacity = useSharedValue(0);
  const sheetTranslateY = useSharedValue(102);
  const firstAssignBtnRef = useRef<View>(null);
  const firstAssignRowRef = useRef<View>(null);
  const firstSectionHeaderRef = useRef<View>(null);
  const [firstAssignBtnPos, setFirstAssignBtnPos] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [firstAssignRowPos, setFirstAssignRowPos] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [firstSectionHeaderPos, setFirstSectionHeaderPos] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const assignBounceY = useSharedValue(0);
  const assignArrowStyle = useAnimatedStyle(() => ({ transform: [{ translateY: assignBounceY.value }] }));

  const workers = useGameStore((s) => s.workers);
  const storeFloors = useGameStore((s) => s.floors);
  const openedFloorTypes = useGameStore((s) => s.openedFloorTypes);
  const floorStars = useGameStore((s) => s.floorStars ?? {});

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

    const occupiedSlots: SlotItem[] = [];
    const result: FloorSection[] = [];

    const resolveFloorDisplayName = (floorId: number, floorType: string, firstTypeId?: string | null): string => {
      const ftBusinesses = gameConfig.floorTypes[floorType as keyof typeof gameConfig.floorTypes]?.businesses ?? [];
      if (firstTypeId) {
        const biz = ftBusinesses.find((b) => b.dreamJobs.includes(firstTypeId));
        if (biz) return biz.name;
      }
      return `Floor ${floorId}`;
    };

    // Process static floors
    for (const floorConfig of gameConfig.floors) {
      const slots: SlotItem[] = [];
      for (let slotIdx = 0; slotIdx < floorConfig.slots; slotIdx++) {
        const assigned = getWorkerForSlot(workers, floorConfig.id, slotIdx);
        if (assigned && assigned.id === worker.id) continue;
        const typeId = floorConfig.availableTypes[slotIdx];
        if (!typeId) continue;
        let matchLevel: SlotItem['matchLevel'] = 'other';
        if (floorConfig.floorType === worker.floorType) {
          matchLevel = typeId === worker.dreamJob ? 'dream' : 'match';
        }
        if (assigned) {
          if (matchLevel === 'dream') {
            occupiedSlots.push({
              floorId: floorConfig.id, slotIdx, typeId, matchLevel, occupant: assigned,
              floorName: resolveFloorDisplayName(floorConfig.id, floorConfig.floorType, typeId),
            });
          }
          continue;
        }
        slots.push({ floorId: floorConfig.id, slotIdx, typeId, matchLevel, occupant: null });
      }
      if (slots.length > 0) {
        result.push({ floorId: floorConfig.id, floorType: floorConfig.floorType, data: slots });
      }
    }

    // Process dynamic floors (floor 5+)
    for (const storeFloor of storeFloors) {
      if (gameConfig.floors.some((f) => f.id === storeFloor.id)) continue;
      const floorType = openedFloorTypes[String(storeFloor.id)];
      if (!floorType) continue;
      if (!gameConfig.floorTypes[floorType]) continue;

      const slots: SlotItem[] = [];
      for (let slotIdx = 0; slotIdx < storeFloor.productions.length; slotIdx++) {
        const assigned = getWorkerForSlot(workers, storeFloor.id, slotIdx);
        if (assigned && assigned.id === worker.id) continue;
        const typeId = storeFloor.productions[slotIdx]?.typeId ?? null;
        let matchLevel: SlotItem['matchLevel'] = 'other';
        if (floorType === worker.floorType) {
          matchLevel = typeId === worker.dreamJob ? 'dream' : 'match';
        }
        if (assigned) {
          if (matchLevel === 'dream') {
            occupiedSlots.push({
              floorId: storeFloor.id, slotIdx, typeId: typeId ?? '', matchLevel, occupant: assigned,
              floorName: resolveFloorDisplayName(storeFloor.id, floorType, typeId),
            });
          }
          continue;
        }
        slots.push({ floorId: storeFloor.id, slotIdx, typeId: typeId ?? '', matchLevel, occupant: null });
      }
      if (slots.length > 0) {
        result.push({ floorId: storeFloor.id, floorType, data: slots });
      }
    }

    // Sort sections: matching floorType first
    result.sort((a, b) => {
      const aMatch = a.floorType === worker.floorType ? -1 : 1;
      const bMatch = b.floorType === worker.floorType ? -1 : 1;
      return aMatch - bMatch;
    });

    // Sort occupied: dream first, then match
    occupiedSlots.sort((a, b) => {
      const order = { dream: 0, match: 1, other: 2 };
      return order[a.matchLevel] - order[b.matchLevel];
    });

    if (occupiedSlots.length > 0) {
      result.unshift({ floorId: -1, floorType: '', data: occupiedSlots, isOccupied: true });
    }

    return result;
  }, [workers, worker, storeFloors, openedFloorTypes]);

  const { t } = useTranslation('hotel');
  const { t: tContent } = useTranslation('gameContent');

  const checkAndFireSelf = useCallback(
    (w: Worker): boolean => {
      if (w.assignedFloorId === null) return true;
      const currentFloor = storeFloors.find((f) => f.id === w.assignedFloorId);
      if (currentFloor) {
        const prod = currentFloor.productions[w.assignedSlotIdx!];
        if (prod?.stage === 'DELIVERING' || prod?.stage === 'SELLING') {
          const active = getProductionTimeRemaining(currentFloor, w.assignedSlotIdx!, clock.now(), floorStars);
          if (active && active.remainingMs > 0) {
            const msg = active.stage === 'DELIVERING'
              ? t('workersPanel.fireBlockedDelivering', { name: w.name, time: formatTimeShort(active.remainingMs) })
              : t('workersPanel.fireBlockedSelling', { name: w.name, time: formatTimeShort(active.remainingMs) });
            Alert.alert(t('workersPanel.fireBlockedTitle'), msg, [{ text: 'OK' }]);
            return false;
          }
        }
      }
      useGameStore.getState().fireWorker(w.id);
      return true;
    },
    [storeFloors, t],
  );

  const handleAssign = (floorId: number, slotIdx: number) => {
    if (!worker) return;
    if (!checkAndFireSelf(worker)) return;
    useGameStore.getState().assignWorker(worker.id, floorId, slotIdx);
    onClose();
  };

  const handleReplace = useCallback(
    (floorId: number, slotIdx: number, occupantId: string) => {
      if (!worker) return;
      const floor = storeFloors.find((f) => f.id === floorId);
      if (!floor) return;
      const occupant = workers.find((w) => w.id === occupantId);
      if (!occupant) return;

      const production = floor.productions[occupant.assignedSlotIdx!];
      const stage = production?.stage;
      if (stage === 'DELIVERING' || stage === 'SELLING') {
        const active = getProductionTimeRemaining(floor, occupant.assignedSlotIdx!, clock.now(), floorStars);
        if (active && active.remainingMs > 0) {
          const msg = active.stage === 'DELIVERING'
            ? t('jobPicker.replaceBlockedDelivering', { name: occupant.name, time: formatTimeShort(active.remainingMs) })
            : t('jobPicker.replaceBlockedSelling', { name: occupant.name, time: formatTimeShort(active.remainingMs) });
          Alert.alert(t('jobPicker.replaceBlockedTitle'), msg, [{ text: 'OK' }]);
          return;
        }
      }

      if (!checkAndFireSelf(worker)) return;
      useGameStore.getState().fireWorker(occupantId);
      useGameStore.getState().assignWorker(worker.id, floorId, slotIdx);
      onClose();
    },
    [worker, storeFloors, workers, t, onClose, checkAndFireSelf],
  );
  const ft = worker ? gameConfig.floorTypes[worker.floorType as keyof typeof gameConfig.floorTypes] : null;
  const accent = ft?.accent ?? '#888';
  const category = tContent(`floorTypes.${worker?.floorType ?? ''}.category`, {
    defaultValue: worker?.floorType ?? '',
  });

  const dreamJobBusinessName = worker && ft
    ? (ft.businesses.find((b) => b.dreamJobs.includes(worker.dreamJob))?.name ?? '')
    : '';
  const dreamJobProductName = worker
    ? tContent(`productionTypes.${worker.dreamJob}.displayName`, { defaultValue: worker.dreamJob })
    : '';

  const isEmpty = sections.length === 0;
  const onboardingStep = useOnboardingStore((s) => s.step);

  useEffect(() => {
    if (!visible || onboardingStep !== 'assign_worker') {
      setFirstAssignBtnPos(null);
      setFirstAssignRowPos(null);
      setFirstSectionHeaderPos(null);
      return;
    }
    const timer = setTimeout(() => {
      firstAssignBtnRef.current?.measureInWindow((x, y, w, h) => {
        if (h > 0) setFirstAssignBtnPos({ x, y, width: w, height: h });
      });
      firstAssignRowRef.current?.measureInWindow((x, y, w, h) => {
        if (h > 0) setFirstAssignRowPos({ x, y, width: w, height: h });
      });
      firstSectionHeaderRef.current?.measureInWindow((x, y, w, h) => {
        if (h > 0) setFirstSectionHeaderPos({ x, y, width: w, height: h });
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [visible, onboardingStep]);

  useEffect(() => {
    if (!firstAssignBtnPos) return;
    assignBounceY.value = withRepeat(
      withSequence(withTiming(-8, { duration: 400 }), withTiming(0, { duration: 400 })),
      -1, true,
    );
  }, [firstAssignBtnPos]);

  const styles = getStyles(theme);
  const pickerHintStyles = getPickerHintStyles(theme);

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
                <View style={styles.pillRow}>
                  <View style={[styles.typePill, { backgroundColor: accent }]}>
                    <Text style={styles.typePillText}>{category}</Text>
                  </View>
                  {!!dreamJobBusinessName && (
                    <View style={[styles.dreamPill, { borderColor: accent }]}>
                      <Text style={[styles.dreamPillText, { color: accent }]} numberOfLines={1}>
                        {dreamJobBusinessName} · {dreamJobProductName}
                      </Text>
                    </View>
                  )}
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
            <Text style={styles.emptyText}>{t('jobPicker.empty')}</Text>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) =>
              `${item.floorId}-${item.slotIdx}`
            }
            renderSectionHeader={({ section }) => {
              const isFirstSection = onboardingStep === 'assign_worker' && sections[0] === section && !section.isOccupied;
              return (
                <SectionHeader
                  section={section}
                  headerRef={isFirstSection ? firstSectionHeaderRef as React.RefObject<View> : undefined}
                />
              );
            }}
            renderItem={({ item, index, section }) => {
              const isFirst = onboardingStep === 'assign_worker' && sections[0] === section && index === 0 && !section.isOccupied;
              return (
                <SlotRow
                  item={item}
                  onAssign={handleAssign}
                  onReplace={handleReplace}
                  rowRef={isFirst ? firstAssignRowRef as React.RefObject<View> : undefined}
                  assignRef={isFirst ? firstAssignBtnRef as React.RefObject<View> : undefined}
                />
              );
            }}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            style={styles.list}
            stickySectionHeadersEnabled={false}
          />
        )}
      </Animated.View>

      {/* Onboarding spotlight overlay — arrow + spotlight on first Assign button */}
      {onboardingStep === 'assign_worker' && firstAssignBtnPos && (() => {
        const SW = Dimensions.get('window').width;
        const SH = Dimensions.get('window').height;
        const PAD = 6; const R = 10;

        // Spotlight: from top of section header (if measured) to bottom of slot row (if measured), else just the assign btn
        const spotTop = firstSectionHeaderPos
          ? firstSectionHeaderPos.y - PAD
          : (firstAssignRowPos ? firstAssignRowPos.y - PAD : firstAssignBtnPos.y - PAD);
        const spotBottom = firstAssignRowPos
          ? firstAssignRowPos.y + firstAssignRowPos.height + PAD
          : firstAssignBtnPos.y + firstAssignBtnPos.height + PAD;
        const spotLeft = firstAssignRowPos ? firstAssignRowPos.x - PAD : 8;
        const spotWidth = firstAssignRowPos ? firstAssignRowPos.width + PAD * 2 : SW - 16;

        const sx = spotLeft;
        const sy = spotTop;
        const sw = spotWidth;
        const sh = spotBottom - spotTop;

        // Arrow just below the Assign button, pointing UP at it
        const cx = firstAssignBtnPos.x + firstAssignBtnPos.width / 2;
        const arrowTop = firstAssignBtnPos.y + firstAssignBtnPos.height + 4;
        const hintTop = arrowTop + 56;
        return (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width={SW} height={SH} style={StyleSheet.absoluteFill} pointerEvents="none">
              <Path
                fillRule="evenodd"
                d={[
                  `M0 0 H${SW} V${SH} H0 Z`,
                  `M${sx + R} ${sy} H${sx + sw - R} Q${sx + sw} ${sy} ${sx + sw} ${sy + R}`,
                  `V${sy + sh - R} Q${sx + sw} ${sy + sh} ${sx + sw - R} ${sy + sh}`,
                  `H${sx + R} Q${sx} ${sy + sh} ${sx} ${sy + sh - R}`,
                  `V${sy + R} Q${sx} ${sy} ${sx + R} ${sy} Z`,
                ].join(' ')}
                fill="rgba(0,0,0,0.55)"
              />
            </Svg>
            <Animated.View style={[assignArrowStyle, { position: 'absolute', left: cx - 24, top: arrowTop }]}>
              <Image
                source={require('../../assets/img/greenArrowUp.png')}
                style={{ width: 48, height: 48 }}
                contentFit="contain"
              />
            </Animated.View>
            <View style={[pickerHintStyles.card, { position: 'absolute', left: 20, right: 20, top: hintTop }]}>
              <Image source={require('../../assets/img/happySmile.png')} style={pickerHintStyles.icon} />
              <Text style={pickerHintStyles.text}>
                {'Tap «Assign» to place a worker on a floor'}
              </Text>
            </View>
          </View>
        );
      })()}
      </View>
    </Modal>
  );
}

function resolveSectionName(
  section: FloorSection,
  tContent: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const translated = tContent(`floors.${section.floorId}.name`, { defaultValue: '' });
  if (translated) return translated;
  const ftBusinesses =
    gameConfig.floorTypes[section.floorType as keyof typeof gameConfig.floorTypes]?.businesses ?? [];
  const firstTypeId = section.data[0]?.typeId;
  return (
    ftBusinesses.find((b) => b.dreamJobs.includes(firstTypeId))?.name ??
    `Floor ${section.floorId}`
  );
}

function SectionHeader({ section, headerRef }: { section: FloorSection; headerRef?: React.RefObject<View> }) {
  const { t } = useTranslation('hotel');
  const { t: tContent } = useTranslation('gameContent');

  if (section.isOccupied) {
    return (
      <View style={sectionStyles.container}>
        <View style={[sectionStyles.header, { backgroundColor: '#7A8596' }]}>
          <Text style={sectionStyles.floorName}>{t('jobPicker.occupiedSection')}</Text>
        </View>
      </View>
    );
  }

  const scheme = FLOOR_TYPE_SCHEMES[section.floorType];
  const headerColor = scheme?.color ?? '#888';
  const floorName = resolveSectionName(section, tContent);

  return (
    <View ref={headerRef} style={sectionStyles.container} collapsable={false}>
      <View style={[sectionStyles.header, { backgroundColor: headerColor }]}>
        <View style={sectionStyles.numberBadge}>
          <Text style={sectionStyles.numberText}>{section.floorId}</Text>
        </View>
        <Text style={sectionStyles.floorName}>{floorName}</Text>
      </View>
    </View>
  );
}

function SlotRow({
  item,
  onAssign,
  onReplace,
  rowRef,
  assignRef,
}: {
  item: SlotItem;
  onAssign: (floorId: number, slotIdx: number) => void;
  onReplace: (floorId: number, slotIdx: number, occupantId: string) => void;
  rowRef?: React.RefObject<View>;
  assignRef?: React.RefObject<View>;
}) {
  const theme = useAppTheme();
  const slotStyles = getSlotStyles(theme);

  const { t } = useTranslation('hotel');
  const { t: tContent } = useTranslation('gameContent');
  const productName = tContent(`productionTypes.${item.typeId}.displayName`, {
    defaultValue: item.typeId,
  });
  const badgeStyle = MATCH_BADGE_STYLES[item.matchLevel];
  const badgeLabel = t(`jobPicker.matchBadges.${item.matchLevel}`);

  if (item.occupant) {
    return (
      <View style={slotStyles.row}>
        <View style={slotStyles.occupiedInfo}>
          <Text style={slotStyles.productName} numberOfLines={1}>
            {productName}
          </Text>
          <Text style={slotStyles.occupantText} numberOfLines={1}>
            {item.floorName ? `${item.floorName} · ` : ''}{item.occupant.name}
          </Text>
        </View>

        <View style={[slotStyles.badge, { backgroundColor: badgeStyle.bg }]}>
          <Text style={[slotStyles.badgeText, { color: badgeStyle.text }]}>
            {badgeLabel}
          </Text>
        </View>

        <Pressable
          onPress={() => onReplace(item.floorId, item.slotIdx, item.occupant!.id)}
          style={({ pressed }) => [
            slotStyles.assignButton,
            pressed && slotStyles.assignButtonPressed,
          ]}
        >
          <LinearGradient
            colors={['#E0813C', '#C4621C']}
            style={slotStyles.assignButtonGradient}
          >
            <Text style={slotStyles.assignButtonText}>{t('jobPicker.replace')}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    );
  }

  return (
    <View ref={rowRef} style={slotStyles.row} collapsable={false}>
      <Text style={slotStyles.productName} numberOfLines={1}>
        {productName}
      </Text>

      <View style={[slotStyles.badge, { backgroundColor: badgeStyle.bg }]}>
        <Text style={[slotStyles.badgeText, { color: badgeStyle.text }]}>
          {badgeLabel}
        </Text>
      </View>

      <Pressable
        ref={assignRef as React.RefObject<View>}
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
          <Text style={slotStyles.assignButtonText}>{t('jobPicker.assign')}</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

type AppTheme = ReturnType<typeof useAppTheme>;

function getStyles(theme: AppTheme) {
  const { isDark } = theme;
  return StyleSheet.create({
    overlay: {
      flex: 1,
    },
    scrim: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
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
      backgroundColor: isDark ? '#1E2132' : '#EAEDF2',
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
      textTransform: 'capitalize',
    },
    pillRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
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
    dreamPill: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
      backgroundColor: 'rgba(255,255,255,0.9)',
    },
    dreamPillText: {
      fontFamily: 'Fredoka_500Medium',
      fontSize: 11,
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
      color: theme.textMuted,
    },
  });
}

function getPickerHintStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.surface,
      borderRadius: 20,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 12,
      elevation: 8,
    },
    icon: {
      width: 28,
      height: 28,
      flexShrink: 0,
    },
    text: {
      flex: 1,
      fontFamily: 'Nunito_700Bold',
      fontSize: 15,
      color: theme.text,
      lineHeight: 22,
    },
  });
}

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
    textTransform: 'capitalize',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
});

function getSlotStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: 6,
      gap: 8,
    },
    productName: {
      fontFamily: 'Fredoka_600SemiBold',
      fontSize: 13.5,
      color: theme.text,
      flex: 1,
      minWidth: 0,
      textTransform: 'capitalize',
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
    occupiedInfo: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    occupantText: {
      fontFamily: 'Fredoka_500Medium',
      fontSize: 11,
      color: theme.textMuted,
      textTransform: 'capitalize',
    },
  });
}
