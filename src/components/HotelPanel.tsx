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
import Svg, { Path, Rect } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useGameStore } from '../stores/gameStore';
import WorkerCard from './WorkerCard';
import JobPickerSheet from './JobPickerSheet';
import type { Worker } from '../../shared/types';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = SCREEN_HEIGHT - 56;
const DISMISS_THRESHOLD = 120;
const SHEET_TIMING = { duration: 420, easing: Easing.bezier(0.4, 0, 0.2, 1) };
const SCRIM_TIMING = { duration: 400, easing: Easing.linear };

interface HotelPanelProps {
  visible: boolean;
  onClose: () => void;
}

export default function HotelPanel({ visible, onClose }: HotelPanelProps) {
  const [expandedWorkerId, setExpandedWorkerId] = useState<string | null>(null);
  const [pickerWorker, setPickerWorker] = useState<Worker | null>(null);

  const scrimOpacity = useSharedValue(0);
  const translateY = useSharedValue(SHEET_HEIGHT);

  const workers = useGameStore((s) => s.workers);
  const hotelCapacity = useGameStore((s) => s.hotelCapacity);

  const unemployedWorkers = workers.filter(
    (w: Worker) => w.assignedFloorId === null,
  );
  const occupiedSeats = unemployedWorkers.length;
  const freeSeats = hotelCapacity - occupiedSeats;

  useEffect(() => {
    setExpandedWorkerId(null);
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
        'Виселити працівника?',
        `${workerName} буде виселений з готелю`,
        [
          { text: 'Скасувати', style: 'cancel' },
          {
            text: 'Виселити',
            style: 'destructive',
            onPress: () => {
              useGameStore.getState().evictWorker(workerId);
            },
          },
        ],
      );
    },
    [],
  );

  const handleFindJob = useCallback((worker: Worker) => {
    setPickerWorker(worker);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Worker }) => (
      <WorkerCard
        worker={item}
        expanded={expandedWorkerId === item.id}
        onToggle={() =>
          setExpandedWorkerId((prev) => (prev === item.id ? null : item.id))
        }
        onFindJob={() => handleFindJob(item)}
        onEvict={() => handleEvict(item.id, item.name)}
      />
    ),
    [expandedWorkerId, handleEvict, handleFindJob],
  );

  const keyExtractor = useCallback((item: Worker) => item.id, []);

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
                      <Text style={styles.titleText}>Готель</Text>
                      <Text style={styles.subtitleText}>Мешканці · пошук роботи</Text>
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
                    <Text style={styles.statLabel}>Місць</Text>
                    <Text style={styles.statValue}>{hotelCapacity}</Text>
                  </View>
                  <View style={styles.statPill}>
                    <Text style={styles.statLabel}>Вільно</Text>
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
            data={unemployedWorkers}
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
      </GestureHandlerRootView>
    </Modal>
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
});
