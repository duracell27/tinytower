import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  FlatList,
  Alert,
  Modal,
  StyleSheet,
  Dimensions,
  useColorScheme,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { useGameStore, useTutorialTaskStore } from '../stores/gameStore';
import { useOnboardingStore } from '../stores/onboardingStore';
import WorkerCard from './WorkerCard';
import JobPickerSheet from './JobPickerSheet';
import { getHotelExpansionCost } from '../../shared/engine/lobbyCommands';
import { gameConfig } from '../../shared/config/gameConfig';
import type { Worker, Floor } from '../../shared/types';
import { isBetterCandidate } from '../utils/workerCandidate';
import InsufficientResourcesModal from './InsufficientResourcesModal';
import { GemIcon } from './CurrencyIcons';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SCREEN_WIDTH = Dimensions.get('window').width;
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
  | { kind: 'elevator-hint' }
  | { kind: 'evict-low' }
  | { kind: 'buy' };

export default function HotelPanel({ visible, onClose }: HotelPanelProps) {
  const { t } = useTranslation('hotel');
  const { t: tContent } = useTranslation('gameContent');

  const [expandedWorkerId, setExpandedWorkerId] = useState<string | null>(null);
  const [pickerWorker, setPickerWorker] = useState<Worker | null>(null);
  const [infoVisible, setInfoVisible] = useState(false);
  const isDark = useColorScheme() === 'dark';

  // Onboarding overlay inside hotel modal
  const firstWorkerRowRef = useRef<View>(null);
  const findJobBtnRef = useRef<View>(null);
  const [workerCardPos, setWorkerCardPos] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [findJobBtnPos, setFindJobBtnPos] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const hotelBounceY = useSharedValue(0);
  const hotelArrowStyle = useAnimatedStyle(() => ({ transform: [{ translateY: hotelBounceY.value }] }));

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
  const assignedWorkers = workers.filter((w: Worker) => w.assignedFloorId !== null);
  const occupiedSeats = unemployedWorkers.length;
  const freeSeats = Math.max(0, hotelCapacity - occupiedSeats);
  const betterCandidateCount = unemployedWorkers.filter((w) =>
    isBetterCandidate(w, assignedWorkers, floors, openedFloorTypes ?? {}),
  ).length;
  const expansionCost = getHotelExpansionCost(hotelCapacity);
  const hasLowLevelWorkers = unemployedWorkers.some((w: Worker) => w.level < 9);
  const { claimedFinal: tutorialDone } = useTutorialTaskStore();

  const listData: ListItem[] = [
    ...unemployedWorkers.map((w): ListItem => ({ kind: 'worker', worker: w })),
    ...(!tutorialDone && freeSeats > 0 ? [{ kind: 'elevator-hint' } as ListItem] : []),
    ...Array.from({ length: freeSeats }, (_, i): ListItem => ({ kind: 'empty', index: i })),
    ...(hasLowLevelWorkers ? [{ kind: 'evict-low' } as ListItem] : []),
    { kind: 'buy' },
  ];

  useEffect(() => {
    setExpandedWorkerId(null);
    if (!visible) clearInsufficientResources();
  }, [visible, clearInsufficientResources]);

  // During assign_worker: auto-expand first worker card, then measure it for overlay.
  const onboardingStep = useOnboardingStore((s) => s.step);
  useEffect(() => {
    if (!visible || onboardingStep !== 'assign_worker') {
      setWorkerCardPos(null);
      setFindJobBtnPos(null);
      return;
    }
    const expandTimer = setTimeout(() => {
      const firstFree = useGameStore.getState().workers
        .filter((w) => w.assignedFloorId === null)
        .sort((a, b) => a.id.localeCompare(b.id))[0];
      if (firstFree) setExpandedWorkerId(firstFree.id);
    }, 150);
    // Wait for both the sheet slide-in (420ms) and card expand animation (150ms + 300ms)
    // to finish before measuring, so translateY=0 and maxHeight=440 are committed.
    const measureTimer = setTimeout(() => {
      firstWorkerRowRef.current?.measureInWindow((x, y, width, height) => {
        if (height > 0) setWorkerCardPos({ x, y, width, height });
      });
      findJobBtnRef.current?.measureInWindow((x, y, width, height) => {
        if (height > 0) setFindJobBtnPos({ x, y, width, height });
      });
    }, 500);
    return () => { clearTimeout(expandTimer); clearTimeout(measureTimer); };
  }, [visible, onboardingStep]);

  useEffect(() => {
    if (!findJobBtnPos && !workerCardPos) return;
    hotelBounceY.value = withRepeat(
      withSequence(withTiming(-8, { duration: 400 }), withTiming(0, { duration: 400 })),
      -1, true,
    );
  }, [findJobBtnPos, workerCardPos]);

  useEffect(() => {
    if (!visible) return;
    const { openSheet, closeSheet } = useGameStore.getState();
    openSheet();
    return closeSheet;
  }, [visible]);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, SHEET_TIMING);
      scrimOpacity.value = withTiming(1, SCRIM_TIMING);
    } else {
      translateY.value = withTiming(SHEET_HEIGHT, SHEET_TIMING);
      scrimOpacity.value = withTiming(0, SCRIM_TIMING);
    }
  }, [visible]);

  // Play the slide-out animation first, then call onClose so the Modal unmounts
  // only after the GHRV has visually left the screen. This prevents the GHRV from
  // blocking touches on the main screen during the animation.
  // No `if (finished)` guard: pan onUpdate can cancel this animation mid-flight (finished=false);
  // without the guard onClose fires anyway — avoiding an invisible GHRV touch blocker.
  const handleAnimatedClose = useCallback(() => {
    translateY.value = withTiming(SHEET_HEIGHT, { duration: 300 }, () => {
      'worklet';
      runOnJS(onClose)();
    });
    scrimOpacity.value = withTiming(0, { duration: 300 });
  }, [onClose]);

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
        translateY.value = withTiming(SHEET_HEIGHT, { duration: 300 }, (finished) => {
          'worklet';
          if (finished) runOnJS(onClose)();
        });
        scrimOpacity.value = withTiming(0, { duration: 300 });
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
      if (item.kind === 'elevator-hint') {
        return (
          <View style={[styles.elevatorHintCard, isDark && { backgroundColor: 'rgba(82,166,226,0.08)', borderColor: 'rgba(82,166,226,0.2)' }]}>
            <Image
              source={require('../../assets/img/achivment/achivLiftCategory.png')}
              style={styles.elevatorHintIcon}
              contentFit="contain"
            />
            <Text style={[styles.elevatorHintText, isDark && { color: '#8AAABB' }]}>
              {t('hotelPanel.elevatorHint')}
            </Text>
          </View>
        );
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
          isBetterCandidate={isBetterCandidate(item.worker, assignedWorkers, floors, openedFloorTypes ?? {})}
          onToggle={() =>
            setExpandedWorkerId((prev) => (prev === item.worker.id ? null : item.worker.id))
          }
          onFindJob={() => handleFindJob(item.worker)}
          onEvict={() => handleEvict(item.worker.id, item.worker.name)}
          findJobRef={index === 0 && item.kind === 'worker' ? findJobBtnRef as React.RefObject<View> : undefined}
        />
      ) : (
        <EmptySlotCard t={t} />
      );
      return (
        <View
          style={styles.roomRow}
          ref={index === 0 && item.kind === 'worker' ? firstWorkerRowRef : undefined}
          collapsable={false}
        >
          <View style={styles.roomBadge}>
            <Text style={styles.roomNumber}>{roomNumber}</Text>
          </View>
          <View style={styles.roomCard}>{card}</View>
        </View>
      );
    },
    [expandedWorkerId, handleEvict, handleFindJob, expansionCost, handleExpandHotel, evictLowLevelWorkers, handleEvictLowLevel, t, assignedWorkers, floors, openedFloorTypes],
  );

  const keyExtractor = useCallback((item: ListItem) => {
    if (item.kind === 'worker') return `w-${item.worker.id}`;
    if (item.kind === 'empty') return `e-${item.index}`;
    if (item.kind === 'elevator-hint') return 'elevator-hint';
    if (item.kind === 'evict-low') return 'evict-low';
    return 'buy';
  }, []);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleAnimatedClose}>
      {visible && <GestureHandlerRootView style={styles.overlay}>
        {/* Scrim */}
        <Animated.View style={[styles.scrim, scrimStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleAnimatedClose} />
        </Animated.View>

        {/* Sheet */}
        <Animated.View style={[styles.sheet, sheetStyle, isDark && { backgroundColor: 'rgba(28,32,28,0.97)' }]}>
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
                      <Pressable onPress={() => setInfoVisible(true)} style={styles.titleNameRow}>
                        <Text style={styles.titleText}>{t('hotelPanel.title')}</Text>
                        <Image
                          source={require('../../assets/img/InformationIcon.png')}
                          style={styles.infoIcon}
                          contentFit="contain"
                        />
                      </Pressable>
                      <Text style={styles.subtitleText}>{t('hotelPanel.subtitle')}</Text>
                    </View>
                  </View>

                  {/* Close button */}
                  <Pressable onPress={handleAnimatedClose} style={styles.closeButton}>
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
                  <View style={styles.statPills}>
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
                    {betterCandidateCount > 0 && (
                      <View style={styles.statPill}>
                        <Text style={styles.statLabel}>{t('hotelPanel.best')}</Text>
                        <Text style={styles.statValue}>{betterCandidateCount}</Text>
                      </View>
                    )}
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

          {/* Hotel info overlay */}
          {infoVisible && (
            <View style={styles.infoOverlayScrim}>
              <Pressable style={StyleSheet.absoluteFill} onPress={() => setInfoVisible(false)} />
              <View style={[styles.infoCard, isDark && { backgroundColor: 'rgba(52,55,52,0.97)' }]}>
                <LinearGradient colors={['#C9637E', '#A8475F']} style={styles.infoCardHeader}>
                  <Text style={styles.infoCardTitle}>About the Hotel</Text>
                  <Pressable onPress={() => setInfoVisible(false)} hitSlop={10}>
                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                      <Path d="M18 6L6 18M6 6l12 12" stroke="rgba(255,255,255,0.85)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </Pressable>
                </LinearGradient>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={styles.infoCardBody}>
                    <InfoSection
                      icon={require('../../assets/img/hotel.png')}
                      title="The Hotel"
                      text="The hotel is where your workers live when they're not assigned to a floor. They wait here until you send them to work."
                    />
                    <InfoSection
                      icon={require('../../assets/img/menu/myWorkers.png')}
                      title="Seats & Free"
                      text="Seats — total number of rooms available. Free — how many rooms are vacant. When the hotel is full, no new workers will appear."
                    />
                    <InfoSection
                      icon={require('../../assets/img/specialistWorker.png')}
                      title="Worker Level"
                      text="Level (1–9) determines how fast a worker produces goods on a floor. Higher level means faster production."
                    />
                    <InfoSection
                      icon={require('../../assets/img/happySmile.png')}
                      title="Dream Job"
                      text="Every worker has an ideal job. Assigning them to a floor with that production type gives a speed bonus."
                    />
                    <InfoSection
                      icon={require('../../assets/img/greenArrowUp.png')}
                      title="Green Arrow"
                      text="This worker is a better candidate for their floor than whoever is currently assigned there — either by type match or higher level."
                    />
                    <InfoSection
                      icon={require('../../assets/img/quicActions/findWorker.png')}
                      title="Find Job / Evict"
                      text="Find Job opens the floor picker to assign this worker. Evict permanently removes them from the hotel."
                    />
                  </View>
                </ScrollView>
              </View>
            </View>
          )}
        </Animated.View>

        <InsufficientResourcesModal asOverlay />

        {/* Onboarding overlay — dim + spotlight on first worker card + arrow pointing at Find Job */}
        {onboardingStep === 'assign_worker' && workerCardPos !== null && (() => {
          const PAD = 8; const R = 14;
          const sx = workerCardPos.x - PAD;
          const sy = workerCardPos.y - PAD;
          const sw = workerCardPos.width + PAD * 2;
          const sh = workerCardPos.height + PAD * 2;
          const cx = workerCardPos.x + workerCardPos.width / 2;

          // Arrow just below the Find Job button (pointing UP at it), fallback to below the card.
          const btnY = findJobBtnPos ? findJobBtnPos.y + findJobBtnPos.height : sy + sh - 10;
          const arrowTop = btnY + 4;
          const hintTop = arrowTop + 150;

          return (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT} style={StyleSheet.absoluteFill} pointerEvents="none">
                <Path
                  fillRule="evenodd"
                  d={[
                    `M0 0 H${SCREEN_WIDTH} V${SCREEN_HEIGHT} H0 Z`,
                    `M${sx + R} ${sy} H${sx + sw - R} Q${sx + sw} ${sy} ${sx + sw} ${sy + R}`,
                    `V${sy + sh - R} Q${sx + sw} ${sy + sh} ${sx + sw - R} ${sy + sh}`,
                    `H${sx + R} Q${sx} ${sy + sh} ${sx} ${sy + sh - R}`,
                    `V${sy + R} Q${sx} ${sy} ${sx + R} ${sy} Z`,
                  ].join(' ')}
                  fill="rgba(0,0,0,0.55)"
                />
              </Svg>
              <Animated.View style={[hotelArrowStyle, { position: 'absolute', left: cx - 24, top: arrowTop }]}>
                <Image
                  source={require('../../assets/img/greenArrowUp.png')}
                  style={{ width: 48, height: 48 }}
                  contentFit="contain"
                />
              </Animated.View>
              <View style={[hotelHintStyles.card, { position: 'absolute', left: 20, right: 20, top: hintTop }]}>
                <Image source={require('../../assets/img/happySmile.png')} style={hotelHintStyles.icon} />
                <Text style={hotelHintStyles.text}>
                  {'Tap «Find Job» to assign a worker to a floor'}
                </Text>
              </View>
            </View>
          );
        })()}
      </GestureHandlerRootView>}
    </Modal>
  );
}



function InfoSection({ icon, title, text }: { icon: number; title: string; text: string }) {
  const isDark = useColorScheme() === 'dark';
  return (
    <View style={infoStyles.section}>
      <Image source={icon} style={infoStyles.sectionIcon} contentFit="contain" />
      <View style={infoStyles.sectionBody}>
        <Text style={[infoStyles.sectionTitle, isDark && { color: '#DDE8D8' }]}>{title}</Text>
        <Text style={[infoStyles.sectionText, isDark && { color: '#8A9A80' }]}>{text}</Text>
      </View>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  section: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(201,99,126,0.35)',
  },
  sectionIcon: {
    width: 24,
    height: 24,
    marginTop: 1,
  },
  sectionBody: {
    flex: 1,
    gap: 2,
  },
  sectionTitle: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13.5,
    color: '#2A3344',
  },
  sectionText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 12.5,
    color: '#6A7485',
    lineHeight: 18,
  },
});

function EmptySlotCard({ t }: { t: (key: string) => string }) {
  const isDark = useColorScheme() === 'dark';
  return (
    <View style={[slotStyles.card, isDark && { backgroundColor: 'rgba(52,55,52,0.97)' }]}>
      <View style={[slotStyles.avatarPlaceholder, isDark && { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
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
  const isDark = useColorScheme() === 'dark';
  if (cost === null) {
    return (
      <View style={[buyStyles.card, isDark && { backgroundColor: 'rgba(52,55,52,0.97)' }]}>
        <Text style={buyStyles.maxedText}>{t('hotelPanel.expandCard.maxed')}</Text>
      </View>
    );
  }
  return (
    <View style={[buyStyles.card, isDark && { backgroundColor: 'rgba(52,55,52,0.97)' }]}>
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
        <Text style={[buyStyles.title, isDark && { color: '#DDE8D8' }]}>{t('hotelPanel.expandCard.title')}</Text>
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
  const isDark = useColorScheme() === 'dark';
  return (
    <View style={[buyStyles.card, { paddingVertical: 5 }, isDark && { backgroundColor: 'rgba(52,55,52,0.97)' }]}>
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
        <Text style={[buyStyles.title, { fontSize: 13 }, isDark && { color: '#DDE8D8' }]}>{t('hotelPanel.evictLowLevelCard.title')}</Text>
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
    backgroundColor: '#ffffff',
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
    backgroundColor: '#ffffff',
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
    alignItems: 'center',
    paddingHorizontal: 18,
    marginTop: 12,
  },
  statPills: {
    flexDirection: 'row',
    gap: 8,
  },
  titleNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoIcon: {
    width: 18,
    height: 18,
    opacity: 0.85,
  },
  infoOverlayScrim: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(18,26,44,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  infoCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    maxHeight: SCREEN_HEIGHT * 0.75,
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  infoCardTitle: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 17,
    color: '#fff',
    letterSpacing: 0.4,
  },
  infoCardBody: {
    padding: 18,
    paddingTop: 4,
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
  onboardingBanner: {
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 2,
    backgroundColor: '#FFF7E0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#F5C842',
  },
  onboardingBannerText: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 14,
    color: '#7A5A00',
  },
  listContent: {
    padding: 14,
    gap: 10,
    paddingBottom: 40,
  },
  elevatorHintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 4,
    marginBottom: 12,
    backgroundColor: 'rgba(82,166,226,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(82,166,226,0.22)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  elevatorHintIcon: { width: 42, height: 42 },
  elevatorHintText: {
    flex: 1,
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 13,
    color: '#4A6070',
    lineHeight: 18,
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

const hotelHintStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
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
    color: '#1a1a1a',
    lineHeight: 22,
  },
});
