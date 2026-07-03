import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect, Circle, Polygon } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useGameStore, useLobbyState, useBalance } from '../stores/gameStore';
import { useGameClock } from '../hooks/useGameClock';
import { calculateTip, calculateElevatorUpgradeCost, calculateLobbyUpgradeCost, getMaxElevatorLevel, getMaxLobbyCapacity } from '../../shared/engine/lobbyUtils';
import { gameConfig } from '../../shared/config/gameConfig';
import type { Visitor, VisitorRole, Worker } from '../../shared/types';
import { Image } from 'expo-image';
import DeliverAllModal, { type DeliverAllSummary } from './DeliverAllModal';
import WorkerAvatar from './WorkerAvatar';

type ToolKey = 'briks' | 'glass' | 'nails' | 'screw';
const TOOL_IMAGES: Record<ToolKey, ReturnType<typeof require>> = {
  briks: require('../../assets/img/tools/briks.png'),
  glass: require('../../assets/img/tools/glass.png'),
  nails: require('../../assets/img/tools/nails.png'),
  screw: require('../../assets/img/tools/screw.png'),
};

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = SCREEN_HEIGHT - 56;
const DISMISS_THRESHOLD = 120;
const SHEET_TIMING = { duration: 420, easing: Easing.bezier(0.4, 0, 0.2, 1) };
const SCRIM_TIMING = { duration: 400, easing: Easing.linear };

const ROLE_COLORS: Record<string, string> = {
  guest: '#7B52BC',
  businessman: '#C28A22',
  deliverer: '#2E78B5',
  seller: '#4E9A2E',
  builder: '#E67E22',
};

function computeDeliverAllSummary(
  visitors: Visitor[],
  elevatorLevel: number,
  dailyGemsCollected: number,
  playerLevel: number,
): DeliverAllSummary {
  let guestCount = 0, businessmanCount = 0, delivererCount = 0, sellerCount = 0;
  let totalCoins = 0, totalGems = 0, newWorkers = 0;
  let gemsCollected = dailyGemsCollected;
  const gemLimit = gameConfig.lobbyConfig.dailyGemLimitBase + playerLevel;

  for (const v of visitors) {
    // role/targetFloor are undefined for unlifted visitors — treat as guest for summary
    const role = v.role ?? 'guest';
    const targetFloor = v.targetFloor ?? 1;
    switch (role) {
      case 'guest':
        guestCount++;
        totalCoins += calculateTip('guest', targetFloor, elevatorLevel, gameConfig);
        if (targetFloor === 1) newWorkers++;
        break;
      case 'businessman':
        businessmanCount++;
        if (gemsCollected < gemLimit) {
          totalGems++;
          gemsCollected++;
        } else {
          totalCoins += calculateTip('businessman', targetFloor, elevatorLevel, gameConfig);
        }
        break;
      case 'deliverer':
        delivererCount++;
        totalCoins += calculateTip('deliverer', targetFloor, elevatorLevel, gameConfig);
        break;
      case 'seller':
        sellerCount++;
        totalCoins += calculateTip('seller', targetFloor, elevatorLevel, gameConfig);
        break;
    }
  }

  return { guestCount, businessmanCount, delivererCount, sellerCount, totalCoins, totalGems, newWorkers };
}

function formatCoins(n: number): string {
  if (n >= 1000) {
    const str = String(n);
    const parts: string[] = [];
    for (let i = str.length; i > 0; i -= 3) {
      parts.unshift(str.slice(Math.max(0, i - 3), i));
    }
    return parts.join("'");
  }
  return String(n);
}

/* ---------- Inline SVG Icons ---------- */

function ElevatorIcon({ size = 22, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={2} width={18} height={20} rx={2} stroke={color} strokeWidth={2} />
      <Path d="M12 2v20" stroke={color} strokeWidth={1.5} />
      <Path d="M8 8l-2 3h4L8 8z" fill={color} />
      <Path d="M16 16l2-3h-4l2 3z" fill={color} />
    </Svg>
  );
}

function PersonIcon({ size = 14, color = 'rgba(255,255,255,0.85)' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={7} r={4} fill={color} />
      <Path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" fill={color} />
    </Svg>
  );
}

function ClockIcon({ size = 14, color = 'rgba(255,255,255,0.85)' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={2} />
      <Path d="M12 6v6l4 2" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function UpArrowIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M12 19V5M5 12l7-7 7 7" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PeopleGroupIcon({ size = 20, color = '#5A6478' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={9} cy={7} r={3.5} fill={color} />
      <Path d="M2 20c0-3.9 3.1-7 7-7s7 3.1 7 7" fill={color} />
      <Circle cx={17} cy={8} r={2.5} fill={color} opacity={0.6} />
      <Path d="M15 20c0-2.5 1.2-4.7 3-6.1a5 5 0 014 6.1" fill={color} opacity={0.6} />
    </Svg>
  );
}

function GemIcon({ size = 14 }: { size?: number }) {
  const inner = Math.round(size * 0.72);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: inner,
        height: inner,
        backgroundColor: '#3FB8D6',
        borderRadius: Math.round(inner * 0.22),
        transform: [{ rotate: '45deg' }],
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.65)',
      }} />
    </View>
  );
}

function ChevronLeftIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke="#5A6478" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function UploadIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M12 15V3M5 10l7-7 7 7" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function CheckIcon({ size = 14, color = '#2592AB' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 13l4 4L19 7" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function GiftIcon({ size = 16, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={10} width={18} height={11} rx={2} stroke={color} strokeWidth={2} />
      <Path d="M12 10v11M3 14h18" stroke={color} strokeWidth={2} />
      <Path d="M12 10c-2-4-6-4-6-1s4 1 6 1c2 0 6 2 6-1s-4-3-6 1z" stroke={color} strokeWidth={2} fill="none" />
    </Svg>
  );
}

function HotelIcon({ size = 18, color = '#5A3D06' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={2} y={7} width={20} height={15} rx={2} stroke={color} strokeWidth={2} />
      <Path d="M16 22V12H8v10" stroke={color} strokeWidth={2} />
      <Path d="M2 11L12 3l10 8" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Rect x={10} y={14} width={4} height={4} rx={1} fill={color} />
    </Svg>
  );
}

function EmptyElevatorIcon() {
  return (
    <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={2} width={18} height={20} rx={2} stroke="#A6ACB8" strokeWidth={1.5} />
      <Path d="M12 2v20" stroke="#A6ACB8" strokeWidth={1} />
      <Path d="M8 9l-2 3h4L8 9z" fill="#A6ACB8" />
      <Path d="M16 15l2-3h-4l2 3z" fill="#A6ACB8" />
    </Svg>
  );
}

/* ---------- Visitor Avatar SVG ---------- */

function VisitorAvatar({ role, hairColor, female }: { role: VisitorRole; hairColor: string; female: boolean }) {
  const bodyColor = ROLE_COLORS[role] || '#7B52BC';
  return (
    <Svg width={38} height={42} viewBox="0 0 38 42">
      {/* Body */}
      <Rect x={5} y={20} width={28} height={18} rx={4} fill={bodyColor} />
      {/* Collar */}
      <Polygon points="14,20 19,26 24,20" fill="#fff" opacity={0.85} />
      {/* Face */}
      <Circle cx={19} cy={14} r={9} fill="#F0C49C" />
      {/* Hair */}
      <Path
        d={female
          ? 'M10 14c0-5 4-10 9-10s9 5 9 10c0 0-2-6-9-6s-9 6-9 6z'
          : 'M10 12c0-5 4-9 9-9s9 4 9 9H10z'}
        fill={hairColor}
      />
      {/* Eyes */}
      <Circle cx={15} cy={14} r={1.2} fill="#2A3344" />
      <Circle cx={23} cy={14} r={1.2} fill="#2A3344" />
      {/* Glasses (businessman) */}
      {role === 'businessman' && (
        <>
          <Rect x={12} y={12} width={5} height={4} rx={1.5} stroke="#4A3322" strokeWidth={1} fill="none" />
          <Rect x={21} y={12} width={5} height={4} rx={1.5} stroke="#4A3322" strokeWidth={1} fill="none" />
          <Path d="M17 14h4" stroke="#4A3322" strokeWidth={0.8} />
        </>
      )}
      {/* Name tag */}
      <Rect x={14} y={30} width={10} height={5} rx={1.5} fill="#FFD23E" />
    </Svg>
  );
}

/* ---------- Coin Dot ---------- */

function CoinDot({ size = 16 }: { size?: number }) {
  return (
    <View style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: '#F2B330',
      borderWidth: 1.5,
      borderColor: '#FFE69B',
    }} />
  );
}

/* ---------- Elevator Shaft ---------- */

function ElevatorShaft({
  targetFloor,
  currentFloor,
}: {
  targetFloor: number;
  currentFloor: number;
}) {
  // bottom range 6..102 → leaves 6px gap at top of shaft (shaft 148 - cabin 40 - top_pad 6)
  const cabinBottomTarget = currentFloor > 0 && targetFloor > 0
    ? 6 + (currentFloor / targetFloor) * 96
    : 6;

  const cabinBottom = useSharedValue(cabinBottomTarget);

  useEffect(() => {
    cabinBottom.value = withTiming(cabinBottomTarget, {
      duration: 500,
      easing: Easing.bezier(0.45, 0.05, 0.3, 1),
    });
  }, [cabinBottomTarget]);

  const cabinStyle = useAnimatedStyle(() => ({
    bottom: cabinBottom.value,
  }));

  return (
    <View style={shaftStyles.container}>
      <Text style={shaftStyles.targetLabel}>{targetFloor}</Text>
      <LinearGradient colors={['#3C4658', '#2C3445']} style={shaftStyles.shaft}>
        {/* Rails */}
        <View style={shaftStyles.railLeft} />
        <View style={shaftStyles.railRight} />
        {/* Cabin */}
        <Animated.View style={[shaftStyles.cabin, cabinStyle]}>
          <LinearGradient colors={['#EFF1F5', '#C9CFD9']} style={shaftStyles.cabinInner}>
            <View style={shaftStyles.doorLeft} />
            <View style={shaftStyles.doorRight} />
          </LinearGradient>
          <View style={shaftStyles.cabinBadgeWrapper}>
            <View style={shaftStyles.cabinBadge}>
              <Text style={shaftStyles.cabinBadgeText}>{currentFloor}</Text>
            </View>
          </View>
        </Animated.View>
      </LinearGradient>
      <Text style={shaftStyles.zeroLabel}>0</Text>
    </View>
  );
}

const shaftStyles = StyleSheet.create({
  container: {
    width: 62,
    alignItems: 'center',
  },
  targetLabel: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 11,
    color: '#7B52BC',
    marginBottom: 4,
  },
  shaft: {
    width: 48,
    height: 148,
    borderRadius: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  railLeft: {
    position: 'absolute',
    left: 8,
    top: 6,
    bottom: 6,
    width: 1.5,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  railRight: {
    position: 'absolute',
    right: 8,
    top: 6,
    bottom: 6,
    width: 1.5,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  cabin: {
    position: 'absolute',
    left: 4,
    right: 4,
    height: 40,
    borderRadius: 6,
    overflow: 'visible',
  },
  cabinInner: {
    flex: 1,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  doorLeft: {
    width: 8,
    height: 24,
    borderRadius: 2,
    backgroundColor: 'rgba(60,70,88,0.15)',
  },
  doorRight: {
    width: 8,
    height: 24,
    borderRadius: 2,
    backgroundColor: 'rgba(60,70,88,0.15)',
  },
  cabinBadgeWrapper: {
    position: 'absolute',
    top: -8,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  cabinBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#F2B330',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFE69B',
  },
  cabinBadgeText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 9,
    color: '#fff',
  },
  zeroLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 11,
    color: '#AEB4C0',
    marginTop: 4,
  },
});

/* ---------- Main Component ---------- */

interface LobbyPanelProps {
  visible: boolean;
  onClose: () => void;
  onOpenHotel?: () => void;
}

export default function LobbyPanel({ visible, onClose, onOpenHotel }: LobbyPanelProps) {
  const { t } = useTranslation('lobby');
  const { t: tContent } = useTranslation('gameContent');
  const [view, setView] = useState<'operate' | 'upgrade'>('operate');
  const [deliverSummary, setDeliverSummary] = useState<DeliverAllSummary | null>(null);
  const [newWorkerPopup, setNewWorkerPopup] = useState<Worker | null>(null);
  const [hotelFullNotice, setHotelFullNotice] = useState(false);

  const {
    lobbyVisitors,
    lobbyCapacity,
    elevatorLevel,
    elevatorFloor,
    dailyTips,
    dailyGemsCollected,
    dailyTipsRewardClaimed,
    nextVisitorAt,
    gems,
  } = useLobbyState();

  const balance = useBalance();
  const now = useGameClock(1000);
  const playerLevel = useGameStore((s) => s.playerLevel);

  const liftVisitor = useGameStore((s) => s.liftVisitor);
  const collectTip = useGameStore((s) => s.collectTip);
  const deliverAll = useGameStore((s) => s.deliverAll);
  const upgradeElevator = useGameStore((s) => s.upgradeElevator);
  const upgradeLobby = useGameStore((s) => s.upgradeLobby);
  const claimDailyReward = useGameStore((s) => s.claimDailyReward);
  const showInsufficientResources = useGameStore((s) => s.showInsufficientResources);
  const builderToolDrop = useGameStore((s) => s.builderToolDrop);
  const clearBuilderToolDrop = useGameStore((s) => s.clearBuilderToolDrop);

  const scrimOpacity = useSharedValue(0);
  const translateY = useSharedValue(SHEET_HEIGHT);

  const activeVisitor = lobbyVisitors.length > 0 ? lobbyVisitors[0] : null;
  // targetFloor is only set after first lift command; before that, visitor is not yet "on the way"
  const arrived = activeVisitor?.targetFloor != null
    ? elevatorFloor >= activeVisitor.targetFloor
    : false;

  // Timer
  const isFull = lobbyVisitors.length >= lobbyCapacity;
  const secondsLeft = Math.max(0, Math.ceil((nextVisitorAt - now) / 1000));
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timerText = isFull ? t('stats.full') : `${minutes}:${String(seconds).padStart(2, '0')}`;

  // Daily tips
  const dailyTipsTarget = gameConfig.lobbyConfig.dailyTipsTarget;
  const dailyTipsReward = gameConfig.lobbyConfig.dailyTipsReward;
  const dailyTipsProgress = Math.min(1, dailyTips / dailyTipsTarget);
  const rewardReady = dailyTips >= dailyTipsTarget && !dailyTipsRewardClaimed;

  // Upgrade costs
  const elevatorUpgradeCost = calculateElevatorUpgradeCost(elevatorLevel, gameConfig);
  const maxElevatorLevel = getMaxElevatorLevel(gameConfig);
  const elevatorMaxed = elevatorLevel >= maxElevatorLevel;

  const lobbyUpgradeCost = calculateLobbyUpgradeCost(lobbyCapacity, gameConfig);
  const maxLobbyCapacity = getMaxLobbyCapacity(playerLevel, gameConfig);
  const lobbyMaxed = lobbyCapacity >= maxLobbyCapacity;
  const lobbyUpgradeSeats = gameConfig.lobbyConfig.lobbyUpgradeSeats;

  // Gem limit for businessman
  const dailyGemLimit = gameConfig.lobbyConfig.dailyGemLimitBase + playerLevel;

  useEffect(() => {
    setView('operate');
    if (!visible) {
      setHotelFullNotice(false);
      setNewWorkerPopup(null);
      clearBuilderToolDrop();
    }
  }, [visible, clearBuilderToolDrop]);

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

  // Ref to suppress new-worker popup during deliverAll (which shows its own summary instead)
  const suppressNewWorkerPopup = useRef(false);

  // Detect when a worker is added to the store while lobby is open
  useEffect(() => {
    if (!visible) return;
    const unsubscribe = useGameStore.subscribe((state, prevState) => {
      if (suppressNewWorkerPopup.current) return;
      if (state.workers.length > prevState.workers.length) {
        const newWorker = state.workers.find((w) => !prevState.workers.some((p) => p.id === w.id));
        if (newWorker) setNewWorkerPopup(newWorker);
      }
    });
    return unsubscribe;
  }, [visible]);

  // Handle collect tip — hotel full check only; worker popup handled by subscribe above
  const handleCollectTip = useCallback(() => {
    const state = useGameStore.getState();
    const active = state.lobbyVisitors[0];
    const isHotelGuest = (active?.role ?? 'guest') === 'guest' && (active?.targetFloor ?? 1) === 1;
    const hotelOccupied = state.workers.filter((w) => w.assignedFloorId === null).length;
    const isHotelFull = isHotelGuest && hotelOccupied >= state.hotelCapacity;

    collectTip();

    if (isHotelFull) {
      setHotelFullNotice(true);
    }
  }, [collectTip]);

  // Determine action button for active visitor
  const getActionButton = useCallback(() => {
    if (!activeVisitor) return null;

    if (!arrived) {
      // Show the next intermediate floor the elevator will reach on this press
      const nextFloor = activeVisitor.targetFloor != null
        ? Math.min(elevatorFloor + elevatorLevel, activeVisitor.targetFloor)
        : elevatorFloor + elevatorLevel;
      return {
        label: t('actions.raiseToFloor', { floor: nextFloor }),
        colors: ['#72C24F', '#5BA63C'] as [string, string],
        shadowColor: '#4A8A2E',
        textColor: '#fff',
        icon: 'up-arrow' as const,
        onPress: liftVisitor,
      };
    }

    // Arrived — role/targetFloor are always set here (assigned on first lift)
    if (activeVisitor.role === 'guest' && activeVisitor.targetFloor === 1) {
      return {
        label: t('actions.checkIntoHotel'),
        amount: null as string | null,
        colors: ['#F6C642', '#E5A41C'] as [string, string],
        shadowColor: '#BC820F',
        textColor: '#5A3D06',
        icon: 'hotel' as const,
        onPress: handleCollectTip,
      };
    }

    if (activeVisitor.role === 'businessman' && dailyGemsCollected < dailyGemLimit) {
      return {
        label: t('actions.collect'),
        amount: '+1' as string | null,
        colors: ['#52A6E2', '#3B8BCB'] as [string, string],
        shadowColor: '#2E72A8',
        textColor: '#fff',
        icon: 'gem' as const,
        onPress: handleCollectTip,
      };
    }

    if (activeVisitor.role === 'builder') {
      return {
        label: t('actions.acceptMaterials'),
        amount: null as string | null,
        colors: ['#E67E22', '#C96A14'] as [string, string],
        shadowColor: '#A04000',
        textColor: '#fff',
        icon: 'none' as const,
        onPress: handleCollectTip,
      };
    }

    const tip = calculateTip(activeVisitor.role ?? 'guest', activeVisitor.targetFloor ?? 1, elevatorLevel, gameConfig);
    return {
      label: t('actions.collectTip'),
      amount: `+${tip}` as string | null,
      colors: ['#F6C642', '#E5A41C'] as [string, string],
      shadowColor: '#BC820F',
      textColor: '#fff',
      icon: 'coin' as const,
      onPress: handleCollectTip,
    };
  }, [activeVisitor, arrived, elevatorLevel, dailyGemsCollected, dailyGemLimit, liftVisitor, handleCollectTip]);

  const actionButton = getActionButton();

  return (
    <>
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.overlay}>

        {/* Scrim */}
        <Animated.View style={[styles.scrim, scrimStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* Sheet */}
        <Animated.View style={[styles.sheet, sheetStyle]}>
          {/* Header with pan gesture */}
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
                    <View style={styles.iconTile}>
                      <ElevatorIcon size={20} />
                    </View>
                    <View>
                      <Text style={styles.titleText}>{t('header.title')}</Text>
                      <Text style={styles.subtitleText}>{t('header.subtitle')}</Text>
                    </View>
                  </View>

                  <View style={styles.headerRight}>
                    {/* Coin chip */}
                    <View style={styles.coinChip}>
                      <CoinDot size={14} />
                      <Text style={styles.coinChipText}>{formatCoins(balance)}</Text>
                    </View>
                    {/* Close button */}
                    <Pressable onPress={onClose} style={styles.closeButton}>
                      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                        <Path
                          d="M18 6L6 18M6 6l12 12"
                          stroke="#fff"
                          strokeWidth={2.4}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </Svg>
                    </Pressable>
                  </View>
                </View>

                {/* Stat tiles */}
                <View style={styles.statsRow}>
                  <View style={styles.statTile}>
                    <PersonIcon size={14} />
                    <Text style={styles.statLabel}>{t('stats.waiting')}</Text>
                    <Text style={styles.statValue}>{lobbyVisitors.length} / {lobbyCapacity}</Text>
                  </View>
                  <View style={styles.statTile}>
                    <ClockIcon size={14} />
                    <Text style={styles.statLabel}>{t('stats.newGuest')}</Text>
                    <Text style={[styles.statValue, { fontVariant: ['tabular-nums'] as any }]}>{timerText}</Text>
                  </View>
                </View>
              </LinearGradient>
            </Animated.View>
          </GestureDetector>

          {/* Content */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {view === 'operate' ? (
              <>
                {/* Visitor + Shaft Card / Empty State */}
                <View style={styles.card}>
                  {activeVisitor ? (
                    <View style={styles.visitorShaftRow}>
                      {/* Left column */}
                      <View style={styles.visitorColumn}>
                        {/* Top row: avatar + speech bubble + status chip */}
                        <View style={styles.visitorInfoRow}>
                          <View style={styles.avatarTile}>
                            <VisitorAvatar
                              role={activeVisitor.role ?? 'guest'}
                              hairColor={activeVisitor.hairColor}
                              female={activeVisitor.female}
                            />
                          </View>
                          <View style={styles.visitorTextCol}>
                            <View style={styles.speechBubble}>
                              {arrived ? (
                                <Text style={styles.speechArrivedText}>{t('visitor.thankYou')}</Text>
                              ) : (
                                <Text style={styles.speechText}>
                                  <Text style={[styles.speechRoleLabel, { color: ROLE_COLORS[activeVisitor.role ?? 'guest'] }]}>
                                    {t(`roles.${activeVisitor.role ?? 'guest'}`)}
                                  </Text>
                                  {t('visitor.floorSuffix', { floor: activeVisitor.targetFloor ?? '?' })}
                                </Text>
                              )}
                            </View>
                            <View style={styles.statusChip}>
                              <View style={[
                                styles.statusDot,
                                { backgroundColor: arrived ? '#52B847' : '#F0B92A' },
                              ]} />
                              <Text style={styles.statusChipText}>
                                {arrived
                                  ? t('visitor.arrivedStatus', { floor: activeVisitor.targetFloor })
                                  : t('visitor.elevatorStatus', { floor: elevatorFloor })}
                              </Text>
                            </View>
                          </View>
                        </View>

                        {/* Action button */}
                        {actionButton && (
                          <Pressable
                            onPress={actionButton.onPress}
                            style={({ pressed }) => [
                              styles.actionButton,
                              pressed && { opacity: 0.85, transform: [{ translateY: 1 }] },
                            ]}
                          >
                            <LinearGradient
                              colors={actionButton.colors}
                              style={styles.actionButtonGradient}
                            >
                              {actionButton.icon === 'up-arrow' && <UpArrowIcon />}
                              {actionButton.icon === 'hotel' && <HotelIcon size={18} color={actionButton.textColor} />}
                              <Text style={[styles.actionButtonText, { color: actionButton.textColor }]}>
                                {actionButton.label}
                              </Text>
                              {actionButton.icon === 'coin' && <CoinDot size={14} />}
                              {actionButton.icon === 'gem' && <GemIcon size={14} />}
                              {actionButton.amount != null && (
                                <Text style={[styles.actionButtonText, { color: actionButton.textColor }]}>
                                  {actionButton.amount}
                                </Text>
                              )}
                            </LinearGradient>
                            <View style={[styles.actionButtonShadow, { backgroundColor: actionButton.shadowColor }]} />
                          </Pressable>
                        )}
                      </View>

                      {/* Right column — elevator shaft */}
                      <ElevatorShaft
                        targetFloor={activeVisitor.targetFloor}
                        currentFloor={elevatorFloor}
                      />
                    </View>
                  ) : (
                    /* Empty state */
                    <View style={styles.emptyState}>
                      <EmptyElevatorIcon />
                      <Text style={styles.emptyTitle}>{t('empty.title')}</Text>
                      <Text style={styles.emptySubtitle}>{t('empty.subtitle')}</Text>
                    </View>
                  )}
                </View>

                {/* Deliver all button */}
                {lobbyVisitors.length > 0 && (
                  <Pressable
                    onPress={() => {
                      if (gems < 1) {
                        showInsufficientResources({ currency: 'gems', need: 1, have: gems });
                        return;
                      }
                      const summary = computeDeliverAllSummary(lobbyVisitors, elevatorLevel, dailyGemsCollected, playerLevel);
                      suppressNewWorkerPopup.current = true;
                      deliverAll();
                      suppressNewWorkerPopup.current = false;
                      setDeliverSummary(summary);
                    }}
                    style={({ pressed }) => [styles.deliverAllCard, pressed && { opacity: 0.8 }]}
                  >
                    <PeopleGroupIcon size={20} color="#5A6478" />
                    <Text style={styles.deliverAllText}>{t('actions.deliverAll')}</Text>
                    <GemIcon size={14} />
                    <Text style={styles.deliverAllGemText}>1</Text>
                  </Pressable>
                )}

                {/* Daily tips card */}
                <View style={styles.dailyTipsCard}>
                  <View style={styles.dailyTipsHeader}>
                    <Text style={styles.dailyTipsLabel}>{t('dailyTips.label')}</Text>
                    <View style={styles.dailyTipsValue}>
                      <CoinDot size={12} />
                      <Text style={styles.dailyTipsAmount}>{formatCoins(dailyTips)}</Text>
                      <Text style={styles.dailyTipsTarget}>/ {formatCoins(dailyTipsTarget)}</Text>
                    </View>
                  </View>
                  {/* Progress bar */}
                  <View style={styles.progressTrack}>
                    <LinearGradient
                      colors={['#F6C642', '#E5A41C']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.progressFill, { width: `${dailyTipsProgress * 100}%` as any }]}
                    />
                  </View>

                  {/* Reward button or claimed state */}
                  {rewardReady && (
                    <Pressable
                      onPress={claimDailyReward}
                      style={({ pressed }) => [
                        styles.rewardButton,
                        pressed && { opacity: 0.85, transform: [{ translateY: 1 }] },
                      ]}
                    >
                      <LinearGradient
                        colors={['#52A6E2', '#3B8BCB']}
                        style={styles.rewardButtonGradient}
                      >
                        <GiftIcon size={16} color="#fff" />
                        <Text style={styles.rewardButtonText}>{t('dailyTips.claimReward')}</Text>
                        <GemIcon size={14} />
                        <Text style={styles.rewardGemCount}>{dailyTipsReward}</Text>
                      </LinearGradient>
                      <View style={styles.rewardButtonShadow} />
                    </Pressable>
                  )}

                  {dailyTipsRewardClaimed && (
                    <View style={styles.claimedStrip}>
                      <CheckIcon size={14} color="#2592AB" />
                      <Text style={styles.claimedText}>{t('dailyTips.claimed')}</Text>
                    </View>
                  )}
                </View>

                {/* Daily gems card */}
                <View style={styles.dailyGemsCard}>
                  <GemIcon size={14} />
                  <Text style={styles.dailyGemsLabel}>{t('dailyGems.label')}</Text>
                  <Text style={styles.dailyGemsValue}>
                    {dailyGemsCollected} / {dailyGemLimit}
                  </Text>
                </View>

                {/* Upgrade elevator entry button */}
                <Pressable
                  onPress={() => setView('upgrade')}
                  style={({ pressed }) => [
                    styles.upgradeEntryButton,
                    pressed && { opacity: 0.85, transform: [{ translateY: 1 }] },
                  ]}
                >
                  <LinearGradient
                    colors={['#C9637E', '#A8475F']}
                    style={styles.upgradeEntryGradient}
                  >
                    <UploadIcon />
                    <Text style={styles.upgradeEntryText}>{t('elevator.upgradeEntry')}</Text>
                  </LinearGradient>
                  <View style={styles.upgradeEntryShadow} />
                </Pressable>
                <Text style={styles.upgradeCaption}>
                  {t('elevator.upgradeCaption')}
                </Text>
              </>
            ) : (
              /* UPGRADE VIEW */
              <>
                {/* Back button */}
                <Pressable onPress={() => setView('operate')} style={styles.backButton}>
                  <ChevronLeftIcon />
                  <Text style={styles.backButtonText}>{t('elevator.backToElevator')}</Text>
                </Pressable>

                {/* Elevator upgrade card */}
                <View style={styles.card}>
                  <View style={styles.upgradeCardHeader}>
                    <View style={styles.upgradeCardTitleRow}>
                      <Text style={styles.upgradeCardTitle}>{t('elevator.cardTitle')}</Text>
                      <Text style={styles.upgradeCardLevel}>L-{elevatorLevel}</Text>
                    </View>
                    <Text style={styles.upgradeCardCapacity}>{t('elevator.capacityPerTrip', { level: elevatorLevel })}</Text>
                  </View>

                  {/* Progress */}
                  <View style={styles.upgradeProgressTrack}>
                    <LinearGradient
                      colors={['#72C24F', '#5BA63C']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        styles.upgradeProgressFill,
                        { width: `${Math.min(100, elevatorLevel * 12)}%` as any },
                      ]}
                    />
                  </View>

                  <View style={styles.upgradeDescRow}>
                    <View style={[styles.upgradeIconTile, { backgroundColor: 'rgba(91,166,60,0.15)' }]}>
                      <ElevatorIcon size={22} color="#5BA63C" />
                    </View>
                    <Text style={styles.upgradeDesc}>
                      {t('elevator.description')}
                    </Text>
                  </View>

                  {!elevatorMaxed ? (
                    <Pressable
                      onPress={() => {
                        if (gems < elevatorUpgradeCost) {
                          showInsufficientResources({ currency: 'gems', need: elevatorUpgradeCost, have: gems });
                        } else {
                          upgradeElevator();
                        }
                      }}
                      style={({ pressed }) => [
                        styles.upgradeButton,
                        pressed && gems >= elevatorUpgradeCost && { opacity: 0.85, transform: [{ translateY: 1 }] },
                      ]}
                    >
                      <LinearGradient
                        colors={gems >= elevatorUpgradeCost ? ['#72C24F', '#5BA63C'] : ['#B7BDC8', '#A2A9B6']}
                        style={styles.upgradeButtonGradient}
                      >
                        <Text style={styles.upgradeButtonText}>{t('elevator.upgradeFor')}</Text>
                        <GemIcon size={14} />
                        <Text style={styles.upgradeGemCount}>{elevatorUpgradeCost}</Text>
                      </LinearGradient>
                      <View style={[
                        styles.upgradeButtonShadow,
                        { backgroundColor: gems >= elevatorUpgradeCost ? '#4A8A2E' : '#8A909C' },
                      ]} />
                    </Pressable>
                  ) : (
                    <View style={styles.maxLevelStrip}>
                      <CheckIcon size={14} color="#5BA63C" />
                      <Text style={[styles.claimedText, { color: '#5BA63C' }]}>{t('elevator.maxLevel')}</Text>
                    </View>
                  )}
                </View>

                {/* Lobby upgrade card */}
                <View style={styles.card}>
                  <View style={styles.upgradeCardHeader}>
                    <Text style={styles.upgradeCardTitle}>{t('lobbyUpgrade.cardTitle')}</Text>
                    <Text style={[styles.upgradeCardCapacity, { color: '#2592AB' }]}>{t('lobbyUpgrade.seats', { count: lobbyCapacity })}</Text>
                  </View>

                  {/* Progress */}
                  <View style={styles.upgradeProgressTrack}>
                    <LinearGradient
                      colors={['#52A6E2', '#3B8BCB']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        styles.upgradeProgressFill,
                        { width: `${Math.min(100, (lobbyCapacity / 100) * 100)}%` as any },
                      ]}
                    />
                  </View>

                  <View style={styles.upgradeDescRow}>
                    <View style={[styles.upgradeIconTile, { backgroundColor: 'rgba(59,139,203,0.15)' }]}>
                      <PersonIcon size={22} color="#3B8BCB" />
                    </View>
                    <Text style={styles.upgradeDesc}>
                      {t('lobbyUpgrade.description')}
                    </Text>
                  </View>

                  {!lobbyMaxed ? (
                    <Pressable
                      onPress={() => {
                        if (gems < lobbyUpgradeCost) {
                          showInsufficientResources({ currency: 'gems', need: lobbyUpgradeCost, have: gems });
                        } else {
                          upgradeLobby();
                        }
                      }}
                      style={({ pressed }) => [
                        styles.upgradeButton,
                        pressed && gems >= lobbyUpgradeCost && { opacity: 0.85, transform: [{ translateY: 1 }] },
                      ]}
                    >
                      <LinearGradient
                        colors={gems >= lobbyUpgradeCost ? ['#52A6E2', '#3B8BCB'] : ['#B7BDC8', '#A2A9B6']}
                        style={styles.upgradeButtonGradient}
                      >
                        <Text style={styles.upgradeButtonText}>{t('lobbyUpgrade.upgradeForSeats', { count: lobbyUpgradeSeats })}</Text>
                        <GemIcon size={14} />
                        <Text style={styles.upgradeGemCount}>{lobbyUpgradeCost}</Text>
                      </LinearGradient>
                      <View style={[
                        styles.upgradeButtonShadow,
                        { backgroundColor: gems >= lobbyUpgradeCost ? '#2E72A8' : '#8A909C' },
                      ]} />
                    </Pressable>
                  ) : (
                    <View style={styles.maxLevelStrip}>
                      <CheckIcon size={14} color="#2592AB" />
                      <Text style={[styles.claimedText, { color: '#2592AB' }]}>{t('lobbyUpgrade.maxLevel')}</Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </ScrollView>
        </Animated.View>

        {/* Hotel full notice — View overlay inside Modal (no nested Modal = no navigation freeze) */}
        {hotelFullNotice && (
          <Pressable style={[StyleSheet.absoluteFill, popupStyles.scrim]} onPress={() => setHotelFullNotice(false)}>
            <Pressable style={popupStyles.card} onPress={() => {}}>
              <View style={popupStyles.avatarWrap}>
                <HotelIcon size={32} color="#A8475F" />
              </View>
              <View style={popupStyles.info}>
                <Text style={popupStyles.title}>{t('hotelFullPopup.title')}</Text>
                <Text style={popupStyles.subtitle}>{t('hotelFullPopup.subtitle')}</Text>
              </View>
              <Pressable
                onPress={() => {
                  setHotelFullNotice(false);
                  onClose();
                  onOpenHotel?.();
                }}
                style={({ pressed }) => [popupStyles.findJobBtn, pressed && { opacity: 0.85 }]}
              >
                <LinearGradient colors={['#C9637E', '#A8475F']} style={popupStyles.findJobGradient}>
                  <HotelIcon size={16} color="#fff" />
                  <Text style={popupStyles.findJobText}>{t('hotelFullPopup.goToHotel')}</Text>
                </LinearGradient>
              </Pressable>
              <Pressable onPress={() => setHotelFullNotice(false)} style={popupStyles.dismissBtn}>
                <Text style={popupStyles.dismissText}>{t('hotelFullPopup.dismiss')}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        )}

        {/* New worker popup — View overlay inside Modal */}
        {newWorkerPopup && (
          <Pressable style={[StyleSheet.absoluteFill, popupStyles.scrim]} onPress={() => setNewWorkerPopup(null)}>
            <Pressable style={popupStyles.card} onPress={() => {}}>
              <View style={popupStyles.avatarWrap}>
                <WorkerAvatar worker={newWorkerPopup} size={56} />
              </View>
              <View style={popupStyles.info}>
                <Text style={popupStyles.title}>{t('newWorkerPopup.title')}</Text>
                <Text style={[popupStyles.name, { color: gameConfig.floorTypes[newWorkerPopup.floorType]?.shirtColor ?? '#3B8BCB' }]}>{newWorkerPopup.name}</Text>
                <Text style={popupStyles.meta}>
                  {t('newWorkerPopup.meta', {
                    level: newWorkerPopup.level,
                    job: tContent(`productionTypes.${newWorkerPopup.dreamJob}.displayName`, { defaultValue: newWorkerPopup.dreamJob }),
                  })}
                </Text>
                <Text style={popupStyles.subtitle}>{t('newWorkerPopup.waitingInHotel')}</Text>
              </View>
              <Pressable
                onPress={() => {
                  setNewWorkerPopup(null);
                  onClose();
                  onOpenHotel?.();
                }}
                style={({ pressed }) => [popupStyles.findJobBtn, pressed && { opacity: 0.85 }]}
              >
                <LinearGradient colors={['#72C24F', '#5BA63C']} style={popupStyles.findJobGradient}>
                  <Text style={popupStyles.findJobText}>{t('newWorkerPopup.findJobNow')}</Text>
                </LinearGradient>
              </Pressable>
              <Pressable onPress={() => setNewWorkerPopup(null)} style={popupStyles.dismissBtn}>
                <Text style={popupStyles.dismissText}>{t('newWorkerPopup.later')}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        )}

        {/* Builder tool drop popup */}
        {builderToolDrop && (
          <Pressable style={[StyleSheet.absoluteFill, popupStyles.scrim]} onPress={clearBuilderToolDrop}>
            <Pressable style={popupStyles.card} onPress={() => {}}>
              <View style={popupStyles.avatarWrap}>
                <Image
                  source={TOOL_IMAGES[builderToolDrop]}
                  style={{ width: 48, height: 48 }}
                  contentFit="contain"
                />
              </View>
              <View style={popupStyles.info}>
                <Text style={popupStyles.title}>{t('builderPopup.title')}</Text>
                <Text style={[popupStyles.name, { color: '#E67E22' }]}>{t(`tools.${builderToolDrop}`)}</Text>
                <Text style={popupStyles.subtitle}>{t('builderPopup.subtitle')}</Text>
              </View>
              <Pressable onPress={clearBuilderToolDrop} style={popupStyles.dismissBtn}>
                <Text style={popupStyles.dismissText}>{t('builderPopup.dismiss')}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        )}
      </GestureHandlerRootView>
    </Modal>

    <DeliverAllModal
      visible={deliverSummary !== null}
      summary={deliverSummary}
      onDismiss={() => setDeliverSummary(null)}
    />
    </>
  );
}

/* ---------- New Worker Popup Styles ---------- */

const popupStyles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 20,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EEF1F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  info: {
    alignItems: 'center',
    gap: 3,
  },
  title: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 18,
    color: '#2A3344',
  },
  name: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
    color: '#3B8BCB',
  },
  meta: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 14,
    color: '#5A6478',
  },
  subtitle: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
    color: '#9BA3B0',
    marginTop: 2,
  },
  findJobBtn: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 12,
  },
  findJobGradient: {
    paddingVertical: 13,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  findJobText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 16,
    color: '#fff',
  },
  dismissBtn: {
    paddingVertical: 8,
  },
  dismissText: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 14,
    color: '#9BA3B0',
  },
});

/* ---------- Styles ---------- */

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
    shadowColor: 'rgba(20,30,50,1)',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.28,
    shadowRadius: 30,
    elevation: 10,
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
    borderRadius: 3,
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
  iconTile: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 17,
    color: '#fff',
    letterSpacing: 0.8,
    textShadowColor: 'rgba(40,50,60,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  subtitleText: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.78)',
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coinChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 13,
  },
  coinChipText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 13,
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
  statsRow: {
    flexDirection: 'row',
    gap: 9,
    paddingHorizontal: 18,
    marginTop: 12,
  },
  statTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.13)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  statLabel: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
  },
  statValue: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 15,
    color: '#fff',
    marginLeft: 'auto',
  },

  /* Scrollable content */
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 13,
    gap: 12,
    paddingBottom: 40,
  },

  /* Cards */
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    shadowColor: 'rgba(40,60,90,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.13,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(40,60,90,0.06)',
  },

  /* Visitor + Shaft */
  visitorShaftRow: {
    flexDirection: 'row',
    gap: 13,
  },
  visitorColumn: {
    flex: 1,
    gap: 12,
  },
  visitorInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
  },
  avatarTile: {
    width: 58,
    height: 58,
    borderRadius: 15,
    backgroundColor: '#EEF0F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  visitorTextCol: {
    flex: 1,
    gap: 8,
  },
  speechBubble: {
    backgroundColor: '#F1F3F7',
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  speechText: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 13.5,
    color: '#2A3344',
  },
  speechRoleLabel: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 13.5,
  },
  speechArrivedText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: '#2A3344',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF1F6',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusChipText: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 12,
    color: '#5A6478',
  },

  /* Action button */
  actionButton: {
    borderRadius: 13,
    overflow: 'hidden',
    position: 'relative',
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 13,
    zIndex: 1,
  },
  actionButtonText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 14.5,
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  actionButtonShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    borderBottomLeftRadius: 13,
    borderBottomRightRadius: 13,
  },

  /* Empty state */
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: '#7C8494',
    marginTop: 4,
  },
  emptySubtitle: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 12,
    color: '#A6ACB8',
  },

  /* Deliver All */
  deliverAllCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: 'rgba(40,60,90,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.13,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(40,60,90,0.06)',
  },
  deliverAllText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: '#2A3344',
  },
  deliverAllGemText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 14,
    color: '#2592AB',
  },

  /* Daily Tips */
  dailyGemsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 11,
    shadowColor: 'rgba(40,60,90,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  dailyGemsLabel: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 14,
    color: '#5A6478',
    flex: 1,
  },
  dailyGemsValue: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 14,
    color: '#2592AB',
  },

  dailyTipsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 15,
    gap: 10,
    shadowColor: 'rgba(40,60,90,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.13,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(40,60,90,0.06)',
  },
  dailyTipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dailyTipsLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12.5,
    color: '#6E7686',
  },
  dailyTipsValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dailyTipsAmount: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 13,
    color: '#C28A22',
  },
  dailyTipsTarget: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 12,
    color: '#A6ACB8',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EAEDF2',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },

  /* Reward button */
  rewardButton: {
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  rewardButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    zIndex: 1,
  },
  rewardButtonText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 14,
    color: '#fff',
  },
  rewardGemCount: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 14,
    color: '#2592AB',
  },
  rewardButtonShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#2E72A8',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },

  /* Claimed state */
  claimedStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EAF4FB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  claimedText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12,
    color: '#2592AB',
  },

  /* Upgrade entry button */
  upgradeEntryButton: {
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  upgradeEntryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    zIndex: 1,
  },
  upgradeEntryText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 14.5,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  upgradeEntryShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#8A3A50',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  upgradeCaption: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 11.5,
    color: '#9098A6',
    textAlign: 'center',
    marginTop: -4,
  },

  /* Back button */
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    shadowColor: 'rgba(40,60,90,1)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  backButtonText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
    color: '#5A6478',
  },

  /* Upgrade cards */
  upgradeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  upgradeCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  upgradeCardTitle: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 17,
    color: '#2A3344',
  },
  upgradeCardLevel: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 17,
    color: '#5BA63C',
  },
  upgradeCardCapacity: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
    color: '#6E7686',
  },
  upgradeProgressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EAEDF2',
    overflow: 'hidden',
    marginBottom: 14,
  },
  upgradeProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  upgradeDescRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  upgradeIconTile: {
    width: 54,
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeDesc: {
    flex: 1,
    fontFamily: 'Fredoka_500Medium',
    fontSize: 12.5,
    color: '#6E7686',
    lineHeight: 17,
  },

  /* Upgrade button */
  upgradeButton: {
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  upgradeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 14,
    zIndex: 1,
  },
  upgradeButtonText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 14.5,
    color: '#fff',
  },
  upgradeGemCount: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 14.5,
    color: '#2592AB',
  },
  upgradeButtonShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  maxLevelStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EAF4FB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
  },
});
