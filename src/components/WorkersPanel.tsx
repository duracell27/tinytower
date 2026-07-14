import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, Pressable, FlatList, Alert, Modal,
  StyleSheet, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Polygon } from 'react-native-svg';
import Animated, {
  useAnimatedStyle, useSharedValue, withTiming, withSpring, runOnJS, Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../stores/gameStore';
import { gameConfig } from '../../shared/config/gameConfig';
import { getWorkerMood, SPECIALIST_UPGRADE_COST } from '../../shared/engine/workerUtils';
import { clock } from '../services/clock';
import WorkerCard from './WorkerCard';
import WorkerJobCard, { getProductionTimeRemaining } from './WorkerJobCard';
import JobPickerSheet from './JobPickerSheet';
import InsufficientResourcesModal from './InsufficientResourcesModal';
import type { Worker, Floor } from '../../shared/types';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = SCREEN_HEIGHT - 56;
const DISMISS_THRESHOLD = 120;
const SHEET_TIMING = { duration: 420, easing: Easing.bezier(0.4, 0, 0.2, 1) };
const SCRIM_TIMING = { duration: 400, easing: Easing.linear };

type Tab = 'unsatisfied' | 'mid' | 'happy' | 'specialists';
const TABS: Tab[] = ['unsatisfied', 'mid', 'happy', 'specialists'];

const TAB_COLORS: Record<Tab, string> = {
  unsatisfied: '#E05A4A',
  mid: '#E5A72E',
  happy: '#49AA38',
  specialists: '#B0B6C2',
};

interface WorkersPanelProps {
  visible: boolean;
  onClose: () => void;
}

interface CategorizedWorkers {
  unsatisfied: Worker[];
  mid: Worker[];
  happy: Worker[];
  specialists: Worker[];
}

function resolveFloorType(openedFloorTypes: Record<string, string>, floorId: number): string {
  const staticConfig = gameConfig.floors.find((f) => f.id === floorId);
  if (staticConfig) return staticConfig.floorType;
  return openedFloorTypes[String(floorId)] ?? '';
}

function resolveFloorName(
  openedFloorTypes: Record<string, string>,
  floors: Floor[],
  floorId: number,
  tContent: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const floorType = resolveFloorType(openedFloorTypes, floorId);
  const floor = floors.find((f) => f.id === floorId);
  const availableTypes = floor?.productions.map((p) => p.typeId).filter((id): id is string => id !== null) ?? [];
  const business = gameConfig.floorTypes[floorType]?.businesses.find((b) => b.dreamJobs.includes(availableTypes[0]));
  return business?.name ?? tContent(`floors.${floorId}.name`, { defaultValue: `Floor ${floorId}` });
}

function categorizeWorkers(
  workers: Worker[],
  floors: Floor[],
  openedFloorTypes: Record<string, string>,
): CategorizedWorkers {
  const result: CategorizedWorkers = { unsatisfied: [], mid: [], happy: [], specialists: [] };

  for (const worker of workers) {
    if (worker.assignedFloorId === null) {
      result.unsatisfied.push(worker);
      continue;
    }
    const floorType = resolveFloorType(openedFloorTypes, worker.assignedFloorId);
    const floor = floors.find((f) => f.id === worker.assignedFloorId);
    const production = floor?.productions[worker.assignedSlotIdx!];
    const mood = getWorkerMood(worker, floorType, production?.typeId ?? null);

    if (mood === 'good' && worker.level === 9) {
      result.specialists.push(worker);
    } else if (mood === 'good') {
      result.happy.push(worker);
    } else {
      result.mid.push(worker);
    }
  }

  return result;
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

export default function WorkersPanel({ visible, onClose }: WorkersPanelProps) {
  const { t } = useTranslation('hotel');
  const { t: tContent } = useTranslation('gameContent');
  const [activeTab, setActiveTab] = useState<Tab>('unsatisfied');
  const [expandedWorkerId, setExpandedWorkerId] = useState<string | null>(null);
  const [pickerWorker, setPickerWorker] = useState<Worker | null>(null);

  const scrimOpacity = useSharedValue(0);
  const translateY = useSharedValue(SHEET_HEIGHT);

  const workers = useGameStore((s) => s.workers);
  const floors = useGameStore((s) => s.floors);
  const openedFloorTypes = useGameStore((s) => s.openedFloorTypes ?? {});
  const hotelCapacity = useGameStore((s) => s.hotelCapacity);
  const gems = useGameStore((s) => s.gems);
  const fireWorker = useGameStore((s) => s.fireWorker);
  const fireAndEvictWorker = useGameStore((s) => s.fireAndEvictWorker);
  const upgradeToSpecialist = useGameStore((s) => s.upgradeToSpecialist);
  const showInsufficientResources = useGameStore((s) => s.showInsufficientResources);
  const clearInsufficientResources = useGameStore((s) => s.clearInsufficientResources);

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

  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrimOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  const categorized = React.useMemo(
    () => categorizeWorkers(workers, floors, openedFloorTypes),
    [workers, floors, openedFloorTypes],
  );

  const handleFireFromJob = useCallback(
    (worker: Worker) => {
      const floor = floors.find((f) => f.id === worker.assignedFloorId);
      if (!floor) return;
      const now = clock.now();
      const production = floor.productions[worker.assignedSlotIdx!];
      const stage = production?.stage;

      if (stage === 'DELIVERING' || stage === 'SELLING') {
        const active = getProductionTimeRemaining(floor, worker.assignedSlotIdx!, now);
        if (active && active.remainingMs > 0) {
          const stageLabel = active.stage === 'DELIVERING'
            ? t('workersPanel.fireBlockedDelivering', { name: worker.name, time: formatTimeShort(active.remainingMs) })
            : t('workersPanel.fireBlockedSelling', { name: worker.name, time: formatTimeShort(active.remainingMs) });
          Alert.alert(t('workersPanel.fireBlockedTitle'), stageLabel, [{ text: 'OK' }]);
          return;
        }
      }

      const hotelOccupied = workers.filter((w) => w.assignedFloorId === null).length;
      if (hotelOccupied < hotelCapacity) {
        fireWorker(worker.id);
      } else {
        Alert.alert(
          t('workersPanel.fireHotelFullTitle'),
          t('workersPanel.fireHotelFullMessage', { name: worker.name }),
          [
            { text: t('workersPanel.fireHotelFullCancel'), style: 'cancel' },
            {
              text: t('workersPanel.fireHotelFullConfirm'),
              style: 'destructive',
              onPress: () => fireAndEvictWorker(worker.id),
            },
          ],
        );
      }
    },
    [floors, workers, hotelCapacity, fireWorker, fireAndEvictWorker, t],
  );

  const handleTrain = useCallback(
    (worker: Worker) => {
      if (gems < SPECIALIST_UPGRADE_COST) {
        showInsufficientResources({ currency: 'gems', need: SPECIALIST_UPGRADE_COST, have: gems });
        return;
      }
      upgradeToSpecialist(worker.id);
    },
    [gems, upgradeToSpecialist, showInsufficientResources],
  );

  const currentWorkers =
    activeTab === 'happy'
      ? [...categorized.happy, ...categorized.specialists]
      : categorized[activeTab];

  const renderItem = useCallback(
    ({ item: worker }: { item: Worker }) => {
      if (activeTab === 'unsatisfied') {
        return (
          <WorkerCard
            worker={worker}
            expanded={expandedWorkerId === worker.id}
            dreamFloorName={(() => {
              for (const ft of Object.values(gameConfig.floorTypes)) {
                const biz = ft.businesses.find((b) => b.dreamJobs.includes(worker.dreamJob));
                if (biz) return biz.name;
              }
              return undefined;
            })()}
            onToggle={() => setExpandedWorkerId((p) => (p === worker.id ? null : worker.id))}
            onFindJob={() => setPickerWorker(worker)}
            onEvict={() => {
              Alert.alert(
                t('hotelPanel.evictConfirm.title'),
                t('hotelPanel.evictConfirm.message', { name: worker.name }),
                [
                  { text: t('hotelPanel.evictConfirm.cancel'), style: 'cancel' },
                  { text: t('hotelPanel.evictConfirm.confirm'), style: 'destructive',
                    onPress: () => useGameStore.getState().evictWorker(worker.id) },
                ],
              );
            }}
          />
        );
      }

      const floor = floors.find((f) => f.id === worker.assignedFloorId);
      if (!floor) return null;
      const floorType = resolveFloorType(openedFloorTypes, worker.assignedFloorId!);
      const floorName = resolveFloorName(openedFloorTypes, floors, worker.assignedFloorId!, tContent);
      let dreamFloorName = tContent(`floorTypes.${worker.floorType}.category`, { defaultValue: worker.floorType });
      for (const ft of Object.values(gameConfig.floorTypes)) {
        const biz = ft.businesses.find((b) => b.dreamJobs.includes(worker.dreamJob));
        if (biz) { dreamFloorName = biz.name; break; }
      }
      const now = clock.now();

      return (
        <WorkerJobCard
          worker={worker}
          floor={floor}
          floorType={floorType}
          floorName={floorName}
          dreamFloorName={dreamFloorName}
          now={now}
          expanded={expandedWorkerId === worker.id}
          isSpecialistTab={activeTab === 'specialists'}
          isMidTab={activeTab === 'mid'}
          onToggle={() => setExpandedWorkerId((p) => (p === worker.id ? null : worker.id))}
          onFire={() => handleFireFromJob(worker)}
          onTrain={() => handleTrain(worker)}
        />
      );
    },
    [activeTab, expandedWorkerId, floors, openedFloorTypes, handleFireFromJob, handleTrain, t, tContent],
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.overlay}>
        <Animated.View style={[styles.scrim, scrimStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View style={[styles.sheet, sheetStyle]}>
          <GestureDetector gesture={panGesture}>
            <Animated.View>
              <LinearGradient colors={['#5B8DD9', '#3A6BBF']} style={styles.header}>
                <View style={styles.handleRow}>
                  <View style={styles.handle} />
                </View>
                <View style={styles.titleRow}>
                  <View style={styles.titleLeft}>
                    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                      <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      <Path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      <Path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <View>
                      <Text style={styles.titleText}>{t('workersPanel.title')}</Text>
                      <Text style={styles.subtitleText}>{t('workersPanel.subtitle')}</Text>
                    </View>
                  </View>
                  <Pressable onPress={onClose} style={styles.closeButton}>
                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                      <Path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </Pressable>
                </View>

                <View style={styles.tabBar}>
                  {TABS.map((tab) => {
                    const isActive = activeTab === tab;
                    const color = TAB_COLORS[tab];
                    const count = tab === 'happy'
                      ? categorized.happy.length + categorized.specialists.length
                      : categorized[tab].length;
                    return (
                      <Pressable
                        key={tab}
                        onPress={() => { setActiveTab(tab); setExpandedWorkerId(null); }}
                        style={[styles.tabButton, isActive && styles.tabButtonActive]}
                      >
                        <Text style={[styles.tabLabel, { color: isActive ? color : 'rgba(255,255,255,0.75)' }]}>
                          {t(`workersPanel.tabs.${tab}`)}
                        </Text>
                        {tab === 'specialists' ? (
                          <View style={[styles.tabStarWrap, isActive && { borderColor: '#F5C842' }]}>
                            <Svg width={14} height={14} viewBox="0 0 24 24">
                              <Polygon
                                points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
                                fill={isActive ? '#F5C842' : '#B0B6C2'}
                                stroke={isActive ? '#E0A800' : '#9098A6'}
                                strokeWidth={1.5}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </Svg>
                            <Text style={[styles.tabCountText, { color: isActive ? '#7A5A00' : 'rgba(255,255,255,0.9)' }]}>
                              {count}
                            </Text>
                          </View>
                        ) : (
                          <View style={[styles.tabCount, { backgroundColor: isActive ? color : 'rgba(255,255,255,0.2)' }]}>
                            <Text style={styles.tabCountText}>{count}</Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </LinearGradient>
            </Animated.View>
          </GestureDetector>

          <FlatList
            data={currentWorkers}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            style={styles.list}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>—</Text>
              </View>
            }
          />

          <JobPickerSheet
            visible={!!pickerWorker}
            worker={pickerWorker}
            onClose={() => setPickerWorker(null)}
          />

          <InsufficientResourcesModal asOverlay />
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1 },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18,26,44,0.5)',
  },
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0, top: 56,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: '#EEF2F8',
    overflow: 'hidden',
  },
  header: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingBottom: 0,
  },
  handleRow: { alignItems: 'center', paddingTop: 10, paddingBottom: 8 },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.55)' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  titleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleText: { fontFamily: 'Fredoka_700Bold', fontSize: 17, color: '#fff', letterSpacing: 0.5 },
  subtitleText: { fontFamily: 'Fredoka_500Medium', fontSize: 11.5, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  closeButton: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 0,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  tabButtonActive: {
    backgroundColor: '#EEF2F8',
  },
  tabLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 10,
  },
  tabCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabCountText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
  },
  tabStarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 9,
    paddingHorizontal: 5,
    paddingVertical: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  list: { flex: 1 },
  listContent: { padding: 14, gap: 10, paddingBottom: 40 },
  emptyWrap: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontFamily: 'Fredoka_500Medium', fontSize: 16, color: '#B0B6C2' },
});
