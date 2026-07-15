import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  Alert,
  Modal,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../stores/gameStore';
import WorkerCard from './WorkerCard';
import JobPickerSheet from './JobPickerSheet';
import { getHotelExpansionCost } from '../../shared/engine/lobbyCommands';
import { gameConfig } from '../../shared/config/gameConfig';
import type { Worker } from '../../shared/types';
import { GemIcon } from './CurrencyIcons';
import InsufficientResourcesModal from './InsufficientResourcesModal';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = SCREEN_HEIGHT - 56;
const DISMISS_THRESHOLD = 120;
const SHEET_TIMING = { duration: 420, easing: Easing.bezier(0.4, 0, 0.2, 1) };
const SCRIM_TIMING = { duration: 400, easing: Easing.linear };

interface HotelPanelProps {
  visible: boolean;
  onClose: () => void;
}

type ListItem =
  | { kind: 'worker'; worker: Worker }
  | { kind: 'empty'; index: number }
  | { kind: 'evict-low' }
  | { kind: 'buy' };

export default function HotelPanel({ visible, onClose }: HotelPanelProps) {
  const { t } = useTranslation('hotel');
  const { t: tContent } = useTranslation('gameContent');
  const [expandedWorkerId, setExpandedWorkerId] = useState<string | null>(null);
  const [pickerWorker, setPickerWorker] = useState<Worker | null>(null);

  const scrimOpacity = useSharedValue(0);
  const translateY = useSharedValue(SHEET_HEIGHT);

  const workers = useGameStore((s) => s.workers);
  const floors = useGameStore((s) => s.floors);
  const openedFloorTypes = useGameStore((s) => s.openedFloorTypes);
  const hotelCapacity = useGameStore((s) => s.hotelCapacity);
  const gems = useGameStore((s) => s.gems);
  const expandHotel = useGameStore((s) => s.expandHotel);
  const evictLowLevelWorkers = useGameStore((s) => s.evictLowLevelWorkers);
  const showInsufficientResources = useGameStore((s) => s.showInsufficientResources);
  const clearInsufficientResources = useGameStore((s) => s.clearInsufficientResources);

  const unemployedWorkers = workers
    .filter((w: Worker) => w.assignedFloorId === null)
    .sort((a, b) => a.id.localeCompare(b.id));
  const occupiedSeats = unemployedWorkers.length;
  const freeSeats = Math.max(0, hotelCapacity - occupiedSeats);
  const expansionCost = getHotelExpansionCost(hotelCapacity);
  const hasLowLevelWorkers = unemployedWorkers.some((w: Worker) => w.level < 9);

  const listData: ListItem[] = [
    ...unemployedWorkers.map((w): ListItem => ({ kind: 'worker', worker: w })),
    ...Array.from({ length: freeSeats }, (_, i): ListItem => ({ kind: 'empty', index: i })),
    ...(hasLowLevelWorkers ? [{ kind: 'evict-low' } as ListItem] : []),
    { kind: 'buy' },
  ];

  useEffect(() => {
    setExpandedWorkerId(null);
    if (!visible) clearInsufficientResources();
  }, [visible, clearInsufficientResources]);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, SHEET_TIMING);
      scrimOpacity.value = withTiming(1, SCRIM_TIMING);
    } else {
      translateY.value = withTiming(SHEET_HEIGHT, SHEET_TIMING);
      scrimOpacity.value = withTiming(0, SCRIM_TIMING);
    }
  }, [visible]);

  const panGesture = Gesture.Pan()
    .enabled(visible)
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
        scrimOpacity.value = 1 - (e.translationY / SHEET_HEIGHT);
      }
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_THRESHOLD || e.velocityY > 500) {
        translateY.value = withTiming(SHEET_HEIGHT, { duration: 300 });
        scrimOpacity.value = withTiming(0, { duration: 300 });
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
        scrimOpacity.value = withTiming(1, { duration: 200 });
      }
    });

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: scrimOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleEvict = useCallback(
    (workerId: string, workerName: string) => {
      Alert.alert(
        t('hotelPanel.evictConfirm.title'),
        t('hotelPanel.evictConfirm.message', { name: workerName }),
        [
          { text: t('hotelPanel.evictConfirm.cancel'), style: 'cancel' },
          {
            text: t('hotelPanel.evictConfirm.confirm'),
            style: 'destructive',
            onPress: () => {
              useGameStore.getState().evictWorker(workerId);
            },
          },
        ],
      );
    },
    [t],
  );

  const handleFindJob = useCallback((worker: Worker) => {
    setPickerWorker(worker);
  }, []);

  const handleExpandHotel = useCallback(() => {
    if (expansionCost === null) return;
    if (gems < expansionCost) {
      showInsufficientResources({ currency: 'gems', need: expansionCost, have: gems });
      return;
    }
    expandHotel();
  }, [expansionCost, gems, expandHotel, showInsufficientResources]);

  const handleEvictLowLevel = useCallback(() => {
    evictLowLevelWorkers();
  }, [evictLowLevelWorkers]);

  const renderItem = useCallback(
    ({ item, index }: { item: ListItem; index: number }) => {
      if (item.kind === 'buy') {
        return (
          <BuySlotCard
            cost={expansionCost}
            onPress={handleExpandHotel}
            t={t}
          />
        );
      }
      if (item.kind === 'evict-low') {
        return <EvictLowLevelCard onPress={handleEvictLowLevel} t={t} />;
      }
      const roomNumber = index + 1;
      const workerDreamJob = item.kind === 'worker' ? item.worker.dreamJob : null;
      let dreamFloorName: string | undefined;
      if (workerDreamJob) {
        for (const ft of Object.values(gameConfig.floorTypes)) {
          const biz = ft.businesses.find((b) => b.dreamJobs.includes(workerDreamJob));
          if (biz) { dreamFloorName = biz.name; break; }
        }
      }
      const card = item.kind === 'worker' ? (
        <WorkerCard
          worker={item.worker}
          expanded={expandedWorkerId === item.worker.id}
          dreamFloorName={dreamFloorName}
          onToggle={() =>
            setExpandedWorkerId((prev) => (prev === item.worker.id ? null : item.worker.id))
          }
          onFindJob={() => handleFindJob(item.worker)}
          onEvict={() => handleEvict(item.worker.id, item.worker.name)}
        />
      ) : (
        <EmptySlotCard t={t} />
      );
      return (
        <View style={styles.roomRow}>
          <View style={styles.roomBadge}>
            <Text style={styles.roomNumber}>{roomNumber}</Text>
          </View>
          <View style={styles.roomCard}>{card}</View>
        </View>
      );
    },
    [expandedWorkerId, handleEvict, handleFindJob, expansionCost, handleExpandHotel, evictLowLevelWorkers, handleEvictLowLevel, t],
  );

  const keyExtractor = useCallback((item: ListItem) => {
    if (item.kind === 'worker') return `w-${item.worker.id}`;
    if (item.kind === 'empty') return `e-${item.index}`;
    if (item.kind === 'evict-low') return 'evict-low';
    return 'buy';
  }, []);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.overlay}>
        {/* Scrim */}
        <Animated.View style={[styles.scrim, scrimStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* Sheet */}
        <Animated.View style={[styles.sheet, sheetStyle]}>
          {/* Header with pan gesture for swipe-to-dismiss */}
          <GestureDetector gesture={panGesture}>
            <Animated.View>
              <LinearGradient colors={['#C9637E', '#A8475F']} style={styles.header}>
                {/* Drag handle */}
                <View style={styles.handleRow}>
                  <View style={styles.handle} />
                </View>

                {/* Title row */}
                <View style={styles.titleRow}>
                  <View style={styles.titleLeft}>
                    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M3 21V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14"
                        stroke="#fff"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <Rect x={7} y={9} width={4} height={4} rx={0.5} stroke="#fff" strokeWidth={1.5} />
                      <Rect x={13} y={9} width={4} height={4} rx={0.5} stroke="#fff" strokeWidth={1.5} />
                      <Rect x={7} y={15} width={4} height={4} rx={0.5} stroke="#fff" strokeWidth={1.5} />
                      <Rect x={13} y={15} width={4} height={4} rx={0.5} stroke="#fff" strokeWidth={1.5} />
                    </Svg>
                    <View>
                      <Text style={styles.titleText}>{t('hotelPanel.title')}</Text>
                      <Text style={styles.subtitleText}>{t('hotelPanel.subtitle')}</Text>
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

                {/* Stats row */}
                <View style={styles.statsRow}>
                  <View style={styles.statPill}>
                    <Text style={styles.statLabel}>{t('hotelPanel.seats')}</Text>
                    <Text style={styles.statValue}>{hotelCapacity}</Text>
                  </View>
                  <View style={styles.statPill}>
                    <Text style={styles.statLabel}>{t('hotelPanel.free')}</Text>
                    <Text style={styles.statValue}>
                      {freeSeats > 0 ? freeSeats : 0}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </Animated.View>
          </GestureDetector>

          {/* Worker list */}
          <FlatList
            data={listData}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            style={styles.list}
          />

          {/* Job picker */}
          <JobPickerSheet
            visible={!!pickerWorker}
            worker={pickerWorker}
            onClose={() => setPickerWorker(null)}
          />
        </Animated.View>

        <InsufficientResourcesModal asOverlay />
      </GestureHandlerRootView>
    </Modal>
  );
}

function EmptySlotCard({ t }: { t: (key: string) => string }) {
  return (
    <View style={slotStyles.card}>
      <View style={slotStyles.avatarPlaceholder}>
        <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
          <Path
            d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
            stroke="#C8CDD8"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx={12} cy={7} r={4} stroke="#C8CDD8" strokeWidth={2} />
        </Svg>
      </View>
      <View style={slotStyles.info}>
        <Text style={slotStyles.title}>{t('hotelPanel.emptySlot.title')}</Text>
        <Text style={slotStyles.subtitle}>{t('hotelPanel.emptySlot.subtitle')}</Text>
      </View>
    </View>
  );
}

function BuySlotCard({
  cost,
  onPress,
  t,
}: {
  cost: number | null;
  onPress: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  if (cost === null) {
    return (
      <View style={buyStyles.card}>
        <Text style={buyStyles.maxedText}>{t('hotelPanel.expandCard.maxed')}</Text>
      </View>
    );
  }
  return (
    <View style={buyStyles.card}>
      <View style={buyStyles.left}>
        <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
          <Path
            d="M3 21V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14"
            stroke="#C9637E"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Rect x={7} y={9} width={4} height={4} rx={0.5} stroke="#C9637E" strokeWidth={1.5} />
          <Rect x={13} y={9} width={4} height={4} rx={0.5} stroke="#C9637E" strokeWidth={1.5} />
          <Rect x={7} y={15} width={4} height={4} rx={0.5} stroke="#C9637E" strokeWidth={1.5} />
          <Rect x={13} y={15} width={4} height={4} rx={0.5} stroke="#C9637E" strokeWidth={1.5} />
        </Svg>
        <Text style={buyStyles.title}>{t('hotelPanel.expandCard.title')}</Text>
      </View>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [buyStyles.btn, pressed && { opacity: 0.82 }]}
      >
        <LinearGradient colors={['#D96E8A', '#B84E6A']} style={buyStyles.btnGradient}>
          <GemIcon size={16} />
          <Text style={buyStyles.btnCost}>{cost}</Text>
        </LinearGradient>
        <View style={buyStyles.btnShadow} />
      </Pressable>
    </View>
  );
}

function EvictLowLevelCard({
  onPress,
  t,
}: {
  onPress: () => void;
  t: (key: string) => string;
}) {
  return (
    <View style={[buyStyles.card, { paddingVertical: 5 }]}>
      <View style={buyStyles.left}>
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path
            d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
            stroke="#C9637E"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M9 7l6 6M15 7l-6 6"
            stroke="#C9637E"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx={12} cy={5} r={3} stroke="#C9637E" strokeWidth={2} />
        </Svg>
        <Text style={[buyStyles.title, { fontSize: 13 }]}>{t('hotelPanel.evictLowLevelCard.title')}</Text>
      </View>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [buyStyles.btn, pressed && { opacity: 0.82 }]}
      >
        <LinearGradient colors={['#D96E8A', '#B84E6A']} style={[buyStyles.btnGradient, { paddingVertical: 4, paddingHorizontal: 10 }]}>
          <GemIcon size={13} />
          <Text style={[buyStyles.btnCost, { fontSize: 13 }]}>1</Text>
        </LinearGradient>
        <View style={buyStyles.btnShadow} />
      </Pressable>
    </View>
  );
}

const slotStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(40,60,90,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 11,
    gap: 12,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F2F4F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
    color: '#B0B6C2',
  },
  subtitle: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 12.5,
    color: '#C8CDD8',
  },
});

const buyStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(201,99,126,0.18)',
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    marginTop: 4,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  title: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
    color: '#3A4250',
  },
  btn: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    minWidth: 64,
  },
  btnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    zIndex: 1,
  },
  btnCost: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 15,
    color: '#fff',
  },
  btnShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#963050',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  maxedText: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 14,
    color: '#B0B6C2',
    textAlign: 'center',
    paddingVertical: 10,
    flex: 1,
  },
});

const styles = StyleSheet.create({
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
    backgroundColor: '#F4ECEF',
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
  },
  titleText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 17,
    color: '#fff',
    letterSpacing: 0.5,
  },
  subtitleText: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
    marginTop: 12,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  statLabel: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  statValue: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 13,
    color: '#fff',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 14,
    gap: 10,
    paddingBottom: 40,
  },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  roomBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#C9637E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomNumber: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
    color: '#C9637E',
  },
  roomCard: {
    flex: 1,
  },
});
