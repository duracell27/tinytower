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
  useColorScheme,
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
import { useGameStore, useLobbyState, useBalance } from '../stores/gameStore';
import { useSettingsStore } from '../stores/settingsStore';
import { WORKER_NAME_POOLS } from '../../shared/config/workerNames';
import { useGameClock } from '../hooks/useGameClock';
import { calculateTip, calculateElevatorUpgradeCost, calculateLobbyUpgradeCost, getMaxElevatorLevel, getMaxLobbyCapacity, getFillLobbyCost, getDailyTipsTargets } from '../../shared/engine/lobbyUtils';
import { gameConfig } from '../../shared/config/gameConfig';
import type { Visitor, VisitorRole, Worker } from '../../shared/types';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import WorkerAvatar from './WorkerAvatar';
import { CoinIcon, GemIcon } from './CurrencyIcons';
import { formatNum } from '../utils/format';
import InsufficientResourcesModal from './InsufficientResourcesModal';
import DeliverAllModal from './DeliverAllModal';

type ToolKey = 'briks' | 'glass' | 'nails' | 'screw' | 'wood' | 'cement';

type InlineRewardPayload =
  | { kind: 'worker_in'; worker: Worker }
  | { kind: 'hotel_full'; pendingFloorType: string | undefined; female: boolean | undefined; name: string }
  | { kind: 'vip_fill'; count: number }
  | { kind: 'tool'; tool: ToolKey }
  | { kind: 'warehouse_full' };

const TOOL_IMAGES: Record<ToolKey, ReturnType<typeof require>> = {
  briks:  require('../../assets/img/tools/briks.png'),
  glass:  require('../../assets/img/tools/glass.png'),
  nails:  require('../../assets/img/tools/nails.png'),
  screw:  require('../../assets/img/tools/screw.png'),
  wood:   require('../../assets/img/tools/wood.png'),
  cement: require('../../assets/img/tools/cement.png'),
};

const VISITOR_IMAGES: Record<VisitorRole, ReturnType<typeof require>> = {
  guest:       require('../../assets/img/lift/visitor.png'),
  businessman: require('../../assets/img/lift/businessman.png'),
  deliverer:   require('../../assets/img/lift/delivery.png'),
  seller:      require('../../assets/img/lift/seller.png'),
  builder:     require('../../assets/img/lift/builder.png'),
};

const WORKER_IMAGES: Record<string, { male: ReturnType<typeof require>; female: ReturnType<typeof require> }> = {
  green:  { male: require('../../assets/img/workers/man-green.png'),  female: require('../../assets/img/workers/woman-green.png') },
  blue:   { male: require('../../assets/img/workers/man-blue.png'),   female: require('../../assets/img/workers/woman-blue.png') },
  yellow: { male: require('../../assets/img/workers/man-yellow.png'), female: require('../../assets/img/workers/woman-yellow.png') },
  purple: { male: require('../../assets/img/workers/man-violet.png'), female: require('../../assets/img/workers/woman-violet.png') },
  red:    { male: require('../../assets/img/workers/man-red.png'),    female: require('../../assets/img/workers/woman-red.png') },
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

const VIP_ICON_BACKGROUND = 'rgba(255, 200, 0, 0.30)';

function formatShortCoins(n: number): string {
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
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

/* ---------- Visitor Avatar ---------- */

function VisitorAvatar({ role, targetFloor, pendingFloorType, female }: { role: string; targetFloor?: number; pendingFloorType?: string; female: boolean }) {
  const isHotelGuest = role === 'guest' && targetFloor === 1;
  if (isHotelGuest) {
    const floorType = pendingFloorType ?? 'green';
    const src = WORKER_IMAGES[floorType]?.[female ? 'female' : 'male'] ?? VISITOR_IMAGES.guest;
    return <Image source={src} style={{ width: 48, height: 48 }} contentFit="contain" />;
  }
  const src = VISITOR_IMAGES[(role as VisitorRole)] ?? VISITOR_IMAGES.guest;
  return <Image source={src} style={{ width: 48, height: 48 }} contentFit="contain" />;
}

/* ---------- Elevator Shaft ---------- */

function ElevatorShaft({
  targetFloor,
  currentFloor,
}: {
  targetFloor?: number;
  currentFloor: number;
}) {
  // bottom range 6..102 → leaves 6px gap at top of shaft (shaft 148 - cabin 40 - top_pad 6)
  // targetFloor may be undefined before first liftVisitor; fall back to 0 so cabin stays at bottom
  const resolvedTarget = targetFloor ?? 0;
  const cabinBottomTarget = currentFloor > 0 && resolvedTarget > 0
    ? 6 + (currentFloor / resolvedTarget) * 96
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
      <Text style={shaftStyles.targetLabel}>{targetFloor ?? '?'}</Text>
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

function InfoSection({ icon, title, text }: { icon: ReturnType<typeof require>; title: string; text: string }) {
  const isDark = useColorScheme() === 'dark';
  return (
    <View style={infoStyles.section}>
      <Image source={icon} style={infoStyles.icon} contentFit="contain" />
      <View style={infoStyles.textCol}>
        <Text style={[infoStyles.sectionTitle, isDark && { color: '#DDE8D8' }]}>{title}</Text>
        <Text style={[infoStyles.sectionText, isDark && { color: '#8A9A80' }]}>{text}</Text>
      </View>
    </View>
  );
}


export default function LobbyPanel({ visible, onClose, onOpenHotel }: LobbyPanelProps) {
  const { t } = useTranslation('lobby');
  const { t: tContent } = useTranslation('gameContent');
  const [view, setView] = useState<'operate' | 'upgrade'>('operate');
  const [newWorkerPopup, setNewWorkerPopup] = useState<Worker | null>(null);
  const [vipHotelFillCount, setVipHotelFillCount] = useState<number | null>(null);
  const [hotelFullPopup, setHotelFullPopup] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const [inlineReward, setInlineReward] = useState<InlineRewardPayload | null>(null);
  const [showBuyGemsConfirm, setShowBuyGemsConfirm] = useState(false);
  const liftSimplifiedRewards = useSettingsStore((s) => s.liftSimplifiedRewards);
  const liftSimplifiedRewardsRef = useRef(liftSimplifiedRewards);
  useEffect(() => { liftSimplifiedRewardsRef.current = liftSimplifiedRewards; }, [liftSimplifiedRewards]);

  const showInlineReward = useCallback((payload: InlineRewardPayload) => {
    setInlineReward(payload);
  }, []);

  useEffect(() => {
    if (!lobbyVisitors?.length) setInlineReward(null);
  }, [lobbyVisitors]);

  const isDark = useColorScheme() === 'dark';

  const {
    lobbyVisitors,
    lobbyCapacity,
    elevatorLevel,
    elevatorFloor,
    dailyTips,
    dailyGemsCollected,
    dailyTipsStage1Claimed,
    dailyTipsStage2Claimed,
    nextVisitorAt,
    gems,
    dailyFillLobbyUses,
    floorsCount,
  } = useLobbyState();

  const balance = useBalance();
  const now = useGameClock(1000);
  const playerLevel = useGameStore((s) => s.playerLevel);

  const fillLobby = useGameStore((s) => s.fillLobby);
  const liftVisitor = useGameStore((s) => s.liftVisitor);
  const collectTip = useGameStore((s) => s.collectTip);
  const deliverAll = useGameStore((s) => s.deliverAll);
  const upgradeElevator = useGameStore((s) => s.upgradeElevator);
  const upgradeLobby = useGameStore((s) => s.upgradeLobby);
  const claimDailyReward = useGameStore((s) => s.claimDailyReward);
  const showInsufficientResources = useGameStore((s) => s.showInsufficientResources);
  const clearInsufficientResources = useGameStore((s) => s.clearInsufficientResources);
  const insufficientResources = useGameStore((s) => s.insufficientResources);
  const builderToolDrop = useGameStore((s) => s.builderToolDrop);
  const clearBuilderToolDrop = useGameStore((s) => s.clearBuilderToolDrop);
  const builderWarehouseFull = useGameStore((s) => s.builderWarehouseFull);
  const clearBuilderWarehouseFull = useGameStore((s) => s.clearBuilderWarehouseFull);
  const pendingDeliverAll = useGameStore((s) => s.pendingDeliverAll);
  const clearPendingDeliverAll = useGameStore((s) => s.clearPendingDeliverAll);
  const buyAllDailyGems = useGameStore((s) => s.buyAllDailyGems);

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
  const lastDailyReset = useGameStore((s) => s.lastDailyReset);
  const resetPending = now >= lastDailyReset + 24 * 60 * 60 * 1000;
  const { stage1: stage1Target, stage2: stage2Target } = getDailyTipsTargets(elevatorLevel, gameConfig);
  const stage1Reward = gameConfig.lobbyConfig.dailyTipsStage1Reward;
  const stage2Reward = gameConfig.lobbyConfig.dailyTipsStage2Reward;
  const effectiveDailyTips = resetPending ? 0 : dailyTips;
  const effectiveDailyGemsCollected = resetPending ? 0 : dailyGemsCollected;
  const tipsProgress = Math.min(1, effectiveDailyTips / stage2Target);
  const stage1Pct = `${(stage1Target / stage2Target) * 100}%`;
  const stage1Ready = effectiveDailyTips >= stage1Target && !dailyTipsStage1Claimed;
  const stage2Ready = effectiveDailyTips >= stage2Target && !dailyTipsStage2Claimed;

  // Upgrade costs
  const elevatorUpgradeCost = calculateElevatorUpgradeCost(elevatorLevel);
  const maxElevatorLevel = getMaxElevatorLevel(floorsCount);
  const elevatorMaxed = elevatorLevel >= maxElevatorLevel;

  const lobbyUpgradeCost = calculateLobbyUpgradeCost();
  const maxLobbyCapacity = getMaxLobbyCapacity();
  const lobbyMaxed = lobbyCapacity >= maxLobbyCapacity;

  // Gem limit for businessman
  const dailyGemLimit = gameConfig.lobbyConfig.dailyGemLimitBase + playerLevel;
  const gemsRemaining = Math.max(0, dailyGemLimit - effectiveDailyGemsCollected);
  const buyAllGemsCost = 100 * gemsRemaining * playerLevel;

  useEffect(() => {
    setView('operate');
    if (!visible) {
      setNewWorkerPopup(null);
      setHotelFullPopup(false);
      setInlineReward(null);
      setShowBuyGemsConfirm(false);
      clearBuilderToolDrop();
      clearBuilderWarehouseFull();
      clearPendingDeliverAll();
    }
  }, [visible, clearBuilderToolDrop, clearBuilderWarehouseFull, clearPendingDeliverAll]);

  useEffect(() => {
    if (!visible || !liftSimplifiedRewards || !builderToolDrop) return;
    showInlineReward({ kind: 'tool', tool: builderToolDrop });
    clearBuilderToolDrop();
  }, [visible, liftSimplifiedRewards, builderToolDrop, showInlineReward, clearBuilderToolDrop]);

  useEffect(() => {
    if (!visible || !liftSimplifiedRewards || !builderWarehouseFull) return;
    showInlineReward({ kind: 'warehouse_full' });
    clearBuilderWarehouseFull();
  }, [visible, liftSimplifiedRewards, builderWarehouseFull, showInlineReward, clearBuilderWarehouseFull]);

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

  // Disable pan-to-dismiss while any overlay popup is active; otherwise the pan
  // gesture competes with the popup's Pressable scrim and produces unpredictable
  // touch behaviour on iOS (feels like "interface blocked").
  const hasActivePopup =
    !!newWorkerPopup || !!builderToolDrop || builderWarehouseFull || !!vipHotelFillCount || hotelFullPopup ||
    !!pendingDeliverAll || infoVisible || !!insufficientResources || showBuyGemsConfirm;

  const panGesture = Gesture.Pan()
    .enabled(visible && !hasActivePopup)
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
        scrimOpacity.value = 1 - (e.translationY / SHEET_HEIGHT);
      }
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_THRESHOLD || e.velocityY > 500) {
        translateY.value = withTiming(SHEET_HEIGHT, { duration: 300 }, () => {
          runOnJS(onClose)();
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

  useEffect(() => {
    // Clear stale insufficientResources on both open and close — prevents a stale
    // overlay set outside the panel from appearing when the panel is opened.
    clearInsufficientResources();
  }, [visible, clearInsufficientResources]);

  // Ref to suppress new-worker popup during deliverAll (which shows its own summary instead)
  const suppressNewWorkerPopup = useRef(false);

  // Detect when a worker is added to the store while lobby is open
  useEffect(() => {
    if (!visible) return;
    const unsubscribe = useGameStore.subscribe((state, prevState) => {
      if (suppressNewWorkerPopup.current) return;
      const added = state.workers.length - prevState.workers.length;
      if (added > 1) {
        if (liftSimplifiedRewardsRef.current) {
          showInlineReward({ kind: 'vip_fill', count: added });
        } else {
          setVipHotelFillCount(added);
        }
      } else if (added === 1) {
        const newWorker = state.workers.find((w) => !prevState.workers.some((p) => p.id === w.id));
        if (newWorker) {
          if (liftSimplifiedRewardsRef.current) {
            showInlineReward({ kind: 'worker_in', worker: newWorker });
          } else {
            setNewWorkerPopup(newWorker);
          }
        }
      }
    });
    return unsubscribe;
  }, [visible, showInlineReward]);

  // Handle collect tip — hotel full check only; worker popup handled by subscribe above
  const handleCollectTip = useCallback(() => {
    const state = useGameStore.getState();
    const active = state.lobbyVisitors[0];
    const isHotelGuest = (active?.role ?? 'guest') === 'guest' && (active?.targetFloor ?? 1) === 1;
    const hotelOccupied = state.workers.filter((w) => w.assignedFloorId === null).length;
    const isHotelFull = isHotelGuest && hotelOccupied >= state.hotelCapacity;

    collectTip();

    if (isHotelFull) {
      if (liftSimplifiedRewards) {
        const isFemale = active?.female ?? false;
        const namePool = WORKER_NAME_POOLS.en[isFemale ? 'female' : 'male'];
        const fakeName = namePool[Math.floor(Math.random() * namePool.length)];
        showInlineReward({
          kind: 'hotel_full',
          pendingFloorType: active?.pendingFloorType,
          female: isFemale,
          name: fakeName,
        });
      } else {
        setHotelFullPopup(true);
      }
    }
  }, [collectTip, liftSimplifiedRewards, showInlineReward]);

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

    if (activeVisitor.role === 'businessman' && effectiveDailyGemsCollected < dailyGemLimit) {
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

    const tip = calculateTip(activeVisitor.role ?? 'guest', activeVisitor.targetFloor ?? 1, elevatorLevel, gameConfig) * (activeVisitor.isVip ? 10 : 1);
    return {
      label: t('actions.collectTip'),
      amount: `+${tip}` as string | null,
      colors: ['#F6C642', '#E5A41C'] as [string, string],
      shadowColor: '#BC820F',
      textColor: '#fff',
      icon: 'coin' as const,
      onPress: handleCollectTip,
    };
  }, [activeVisitor, arrived, elevatorLevel, effectiveDailyGemsCollected, dailyGemLimit, liftVisitor, handleCollectTip]);

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
        <Animated.View style={[styles.sheet, sheetStyle, isDark && { backgroundColor: 'rgba(28,32,28,0.97)' }]}>
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
                      <Pressable onPress={() => setInfoVisible(true)} style={styles.titleNameRow}>
                        <Text style={styles.titleText}>{t('header.title')}</Text>
                        <Image
                          source={require('../../assets/img/InformationIcon.png')}
                          style={styles.infoIcon}
                          contentFit="contain"
                        />
                      </Pressable>
                      <Text style={styles.subtitleText}>{t('header.subtitle')}</Text>
                    </View>
                  </View>

                  <View style={styles.headerRight}>
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
                  {/* Left: coins + gems */}
                  <View style={styles.statCol}>
                    <View style={styles.statPill}>
                      <CoinIcon size={13} />
                      <Text style={styles.statLabel}>{t('stats.coins')}</Text>
                      <Text style={styles.statValue}>{formatNum(balance)}</Text>
                    </View>
                    <View style={styles.statPill}>
                      <GemIcon size={13} />
                      <Text style={styles.statLabel}>{t('stats.gems')}</Text>
                      <Text style={styles.statValue}>{gems}</Text>
                    </View>
                  </View>
                  {/* Right: next guest + waiting */}
                  <View style={styles.statCol}>
                    <View style={styles.statPill}>
                      <ClockIcon size={13} />
                      <Text style={styles.statLabel}>{t('stats.newGuest')}</Text>
                      <Text style={[styles.statValue, { fontVariant: ['tabular-nums'] as any }]}>{timerText}</Text>
                    </View>
                    <View style={styles.statPill}>
                      <PersonIcon size={13} />
                      <Text style={styles.statLabel}>{t('stats.waiting')}</Text>
                      <Text style={styles.statValue}>{lobbyVisitors.length}/{lobbyCapacity}</Text>
                    </View>
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
                <View style={[styles.card, isDark && { backgroundColor: 'rgba(52,55,52,0.97)' }]}>
                  {activeVisitor ? (
                    <View style={styles.visitorShaftRow}>
                      {/* Left column */}
                      <View style={styles.visitorColumn}>
                        {/* Top row: avatar + speech bubble + status chip */}
                        <View style={styles.visitorInfoRow}>
                          <View style={[styles.avatarTile, isDark && { backgroundColor: 'rgba(255,255,255,0.08)' }, activeVisitor.isVip && { backgroundColor: VIP_ICON_BACKGROUND }]}>
                            <VisitorAvatar
                              role={activeVisitor.role ?? 'guest'}
                              targetFloor={activeVisitor.targetFloor}
                              pendingFloorType={activeVisitor.pendingFloorType}
                              female={activeVisitor.female ?? false}
                            />
                          </View>
                          <View style={styles.visitorTextCol}>
                            <View style={[styles.speechBubble, isDark && { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                              {arrived ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                  <Text style={[styles.speechArrivedText, isDark && { color: '#DDE8D8' }]}>{t('visitor.thankYou')}</Text>
                                  <CoinIcon size={14} />
                                </View>
                              ) : (
                                <Text style={[styles.speechText, isDark && { color: '#DDE8D8' }]}>
                                  <Text style={[styles.speechRoleLabel, { color: ROLE_COLORS[activeVisitor.role ?? 'guest'] }]}>
                                    {t(`roles.${activeVisitor.isVip ? `vip_${activeVisitor.role ?? 'guest'}` : (activeVisitor.role ?? 'guest')}`)}
                                  </Text>
                                  {activeVisitor.targetFloor != null ? t('visitor.floorSuffix', { floor: activeVisitor.targetFloor }) : ''}
                                </Text>
                              )}
                            </View>
                            <View style={[styles.statusChip, isDark && { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                              <View style={[
                                styles.statusDot,
                                { backgroundColor: arrived ? '#52B847' : '#F0B92A' },
                              ]} />
                              <Text style={[styles.statusChipText, isDark && { color: '#8A9A80' }]}>
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
                            onPress={() => {
                              const style = activeVisitor?.isVip
                                ? Haptics.ImpactFeedbackStyle.Heavy
                                : Haptics.ImpactFeedbackStyle.Medium;
                              Haptics.impactAsync(style);

                              actionButton.onPress();
                            }}
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
                              {actionButton.icon === 'coin' && <CoinIcon size={14} />}
                              {actionButton.icon === 'gem' && <GemIcon size={14} />}
                              {actionButton.amount != null && (
                                <Text style={[styles.actionButtonText, { color: actionButton.textColor }]}>
                                  {actionButton.amount}
                                </Text>
                              )}
                            </LinearGradient>
                            {!isDark && <View style={[styles.actionButtonShadow, { backgroundColor: actionButton.shadowColor }]} />}
                          </Pressable>
                        )}

                        {/* Inline reward strip — fixed height keeps card stable when simplified mode is ON */}
                        {liftSimplifiedRewards && (
                          <View style={styles.inlineRewardStrip}>
                            {inlineReward && (
                              <View style={[styles.inlineRewardContent, isDark && { backgroundColor: 'rgba(255,255,255,0.10)' }]}>
                                {inlineReward.kind === 'worker_in' && (() => {
                                  const workerColor = gameConfig.floorTypes[inlineReward.worker.floorType]?.shirtColor ?? '#3B8BCB';
                                  return (
                                    <>
                                      <WorkerAvatar worker={inlineReward.worker} size={22} />
                                      <Text numberOfLines={1} style={{ flex: 1 }}>
                                        <Text style={[styles.inlineRewardText, { color: workerColor }]}>
                                          {inlineReward.worker.name} Lv.{inlineReward.worker.level}
                                        </Text>
                                        <Text style={[styles.inlineRewardText, isDark && { color: '#DDE8D8' }]}> · {t('inlineReward.checkedIn')}</Text>
                                      </Text>
                                    </>
                                  );
                                })()}
                                {inlineReward.kind === 'hotel_full' && (() => {
                                  const floorType = inlineReward.pendingFloorType ?? 'green';
                                  const workerColor = gameConfig.floorTypes[floorType]?.shirtColor ?? '#3B8BCB';
                                  const avatarSrc = WORKER_IMAGES[floorType]?.[inlineReward.female ? 'female' : 'male']
                                    ?? VISITOR_IMAGES.guest;
                                  return (
                                    <>
                                      <Image source={require('../../assets/img/warningIcon.png')} style={{ width: 18, height: 18 }} contentFit="contain" />
                                      <Image source={avatarSrc} style={{ width: 22, height: 22 }} contentFit="contain" />
                                      <Text style={[styles.inlineRewardText, { color: workerColor, flex: 1 }]} numberOfLines={1}>
                                        {inlineReward.name}
                                        <Text style={[styles.inlineRewardText, { color: '#C9637E' }]}>
                                          {' · '}{t('inlineReward.noRoom')}
                                        </Text>
                                      </Text>
                                    </>
                                  );
                                })()}
                                {inlineReward.kind === 'vip_fill' && (
                                  <>
                                    <Text style={styles.inlineRewardEmoji}>🏨</Text>
                                    <Text style={[styles.inlineRewardText, isDark && { color: '#DDE8D8' }]}>
                                      {t('inlineReward.vipFill', { count: inlineReward.count })}
                                    </Text>
                                  </>
                                )}
                                {inlineReward.kind === 'tool' && (
                                  <>
                                    <Image
                                      source={TOOL_IMAGES[inlineReward.tool]}
                                      style={{ width: 20, height: 20 }}
                                      contentFit="contain"
                                    />
                                    <Text style={[styles.inlineRewardText, isDark && { color: '#DDE8D8' }]}>
                                      {t('inlineReward.builderDelivered', { tool: t(`tools.${inlineReward.tool}`) })}
                                    </Text>
                                  </>
                                )}
                                {inlineReward.kind === 'warehouse_full' && (
                                  <>
                                    <Image source={require('../../assets/img/warningIcon.png')} style={{ width: 18, height: 18 }} contentFit="contain" />
                                    <Text style={[styles.inlineRewardText, { color: '#E53E3E', flex: 1 }]} numberOfLines={1}>
                                      {t('inlineReward.warehouseFull')}
                                    </Text>
                                  </>
                                )}
                              </View>
                            )}
                          </View>
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
                      <Pressable
                        onPress={fillLobby}
                        style={({ pressed }) => [
                          styles.fillLobbyButton,
                          pressed && { opacity: 0.85, transform: [{ translateY: 1 }] },
                        ]}
                      >
                        <LinearGradient
                          colors={['#52A6E2', '#3B8BCB']}
                          style={styles.fillLobbyGradient}
                        >
                          <Text style={styles.fillLobbyText}>{t('actions.fillLobby')}</Text>
                          <GemIcon size={14} />
                          <Text style={styles.fillLobbyGemCount}>{getFillLobbyCost(dailyFillLobbyUses)}</Text>
                        </LinearGradient>
                        <View style={styles.fillLobbyButtonShadow} />
                      </Pressable>
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
                      suppressNewWorkerPopup.current = true;
                      deliverAll();
                      suppressNewWorkerPopup.current = false;
                    }}
                    style={({ pressed }) => [styles.deliverAllCard, isDark && { backgroundColor: 'rgba(52,55,52,0.97)' }, pressed && { opacity: 0.8 }]}
                  >
                    <PeopleGroupIcon size={20} color={isDark ? '#8A9A80' : '#5A6478'} />
                    <Text style={[styles.deliverAllText, isDark && { color: '#DDE8D8' }]}>{t('actions.deliverAll')}</Text>
                    <GemIcon size={14} />
                    <Text style={styles.deliverAllGemText}>1</Text>
                  </Pressable>
                )}

                {/* Daily tips card */}
                <View style={[styles.dailyTipsCard, isDark && { backgroundColor: 'rgba(52,55,52,0.97)' }]}>
                  <Text style={[styles.dailyTipsLabel, isDark && { color: '#8A9A80' }]}>{t('dailyTips.label')}</Text>

                  {/* Labels above bar */}
                  <View style={styles.milestoneAboveRow}>
                    {/* Current amount — left */}
                    <View style={styles.milestone0}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                        <CoinIcon size={11} />
                        <Text style={[styles.milestoneAmount, isDark && { color: '#8A9A80' }]}>{formatNum(effectiveDailyTips)}</Text>
                      </View>
                    </View>
                    {/* Stage 1: centered at stage1/stage2 position */}
                    <View style={[styles.milestone50, { left: stage1Pct as any }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                        <CoinIcon size={11} />
                        <Text style={[styles.milestoneAmount, isDark && { color: '#8A9A80' }]}>
                          {dailyTipsStage1Claimed ? t('dailyTips.received') : formatShortCoins(stage1Target)}
                        </Text>
                      </View>
                    </View>
                    {/* Stage 2: at right edge */}
                    <View style={styles.milestone100}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                        <CoinIcon size={11} />
                        <Text style={[styles.milestoneAmount, isDark && { color: '#8A9A80' }]}>
                          {dailyTipsStage2Claimed ? t('dailyTips.received') : formatShortCoins(stage2Target)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Progress bar with mid divider */}
                  <View style={[styles.progressTrack, isDark && { backgroundColor: 'rgba(255,255,255,0.10)' }]}>
                    <LinearGradient
                      colors={['#F6C642', '#E5A41C']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.progressFill, { width: `${tipsProgress * 100}%` as any }]}
                    />
                    <View style={[styles.stageDivider, { left: stage1Pct as any }]} pointerEvents="none" />
                  </View>

                  {/* Labels below bar */}
                  <View style={styles.milestoneBelowRow}>
                    <View style={[styles.milestone50, { left: stage1Pct as any }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                        <Text style={styles.milestoneReward}>+{stage1Reward}</Text>
                        <GemIcon size={10} />
                      </View>
                    </View>
                    <View style={styles.milestone100}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                        <Text style={styles.milestoneReward}>+{stage2Reward}</Text>
                        <GemIcon size={10} />
                      </View>
                    </View>
                  </View>

                  {/* Claim button(s) */}
                  {stage1Ready && (
                    <Pressable
                      onPress={() => claimDailyReward(1)}
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
                        <Text style={styles.rewardGemCount}>+{stage1Reward}</Text>
                      </LinearGradient>
                      <View style={styles.rewardButtonShadow} />
                    </Pressable>
                  )}
                  {stage2Ready && (
                    <Pressable
                      onPress={() => claimDailyReward(2)}
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
                        <Text style={styles.rewardGemCount}>+{stage2Reward}</Text>
                      </LinearGradient>
                      <View style={styles.rewardButtonShadow} />
                    </Pressable>
                  )}
                </View>

                {/* Daily gems card */}
                <View style={[styles.dailyGemsCard, isDark && { backgroundColor: 'rgba(52,55,52,0.97)' }]}>
                  <GemIcon size={14} />
                  <Text style={[styles.dailyGemsLabel, isDark && { color: '#8A9A80' }]}>{t('dailyGems.label')}</Text>
                  <Text style={styles.dailyGemsValue}>
                    {effectiveDailyGemsCollected} / {dailyGemLimit}
                  </Text>
                  {gemsRemaining > 0 && (
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setShowBuyGemsConfirm(true);
                      }}
                      style={({ pressed }) => [styles.buyGemsChip, isDark && { backgroundColor: 'rgba(82,166,226,0.18)' }, pressed && { opacity: 0.7 }]}
                    >
                      <Text style={styles.buyGemsChipText}>{t('dailyGems.buyAll')}</Text>
                      <GemIcon size={11} />
                      <Text style={styles.buyGemsChipText}>+{gemsRemaining}</Text>
                    </Pressable>
                  )}
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
                  {!isDark && <View style={styles.upgradeEntryShadow} />}
                </Pressable>
                <Text style={[styles.upgradeCaption, isDark && { color: '#8A9A80' }]}>
                  {t('elevator.upgradeCaption')}
                </Text>
              </>
            ) : (
              /* UPGRADE VIEW */
              <>
                {/* Back button */}
                <Pressable onPress={() => setView('operate')} style={[styles.backButton, isDark && { backgroundColor: 'rgba(52,55,52,0.97)' }]}>
                  <ChevronLeftIcon />
                  <Text style={[styles.backButtonText, isDark && { color: '#8A9A80' }]}>{t('elevator.backToElevator')}</Text>
                </Pressable>

                {/* Elevator upgrade card */}
                <View style={[styles.card, isDark && { backgroundColor: 'rgba(52,55,52,0.97)' }]}>
                  <View style={styles.upgradeCardHeader}>
                    <View style={styles.upgradeCardTitleRow}>
                      <Text style={[styles.upgradeCardTitle, isDark && { color: '#DDE8D8' }]}>{t('elevator.cardTitle')}</Text>
                      <Text style={styles.upgradeCardLevel}>L-{elevatorLevel}</Text>
                    </View>
                    <Text style={[styles.upgradeCardCapacity, isDark && { color: '#8A9A80' }]}>{t('elevator.capacityPerTrip', { level: elevatorLevel })}</Text>
                  </View>

                  {/* Progress */}
                  <View style={[styles.upgradeProgressTrack, isDark && { backgroundColor: 'rgba(255,255,255,0.10)' }]}>
                    <LinearGradient
                      colors={['#72C24F', '#5BA63C']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        styles.upgradeProgressFill,
                        { width: `${Math.min(100, (elevatorLevel / maxElevatorLevel) * 100)}%` as any },
                      ]}
                    />
                  </View>

                  <View style={styles.upgradeDescRow}>
                    <View style={[styles.upgradeIconTile, { backgroundColor: 'rgba(91,166,60,0.15)' }]}>
                      <ElevatorIcon size={22} color="#5BA63C" />
                    </View>
                    <Text style={[styles.upgradeDesc, isDark && { color: '#8A9A80' }]}>
                      {t('elevator.description')}
                    </Text>
                  </View>

                  {!elevatorMaxed ? (
                    <Pressable
                      onPress={() => {
                        if (gems < elevatorUpgradeCost) {
                          showInsufficientResources({ currency: 'gems', need: elevatorUpgradeCost, have: gems });
                          return;
                        }
                        upgradeElevator();
                      }}
                      style={({ pressed }) => [
                        styles.upgradeButton,
                        pressed && { opacity: 0.85, transform: [{ translateY: 1 }] },
                      ]}
                    >
                      <LinearGradient
                        colors={['#72C24F', '#5BA63C']}
                        style={styles.upgradeButtonGradient}
                      >
                        <Text style={styles.upgradeButtonText}>{t('elevator.upgradeFor')}</Text>
                        <GemIcon size={14} />
                        <Text style={styles.upgradeGemCount}>{elevatorUpgradeCost}</Text>
                      </LinearGradient>
                      {!isDark && <View style={[styles.upgradeButtonShadow, { backgroundColor: '#4A8A2E' }]} />}
                    </Pressable>
                  ) : (
                    <View style={[styles.maxLevelStrip, isDark && { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                      <CheckIcon size={14} color="#5BA63C" />
                      <Text style={[styles.claimedText, { color: '#5BA63C' }]}>{t('elevator.maxLevel')}</Text>
                    </View>
                  )}
                </View>

                {/* Lobby upgrade card */}
                <View style={[styles.card, isDark && { backgroundColor: 'rgba(52,55,52,0.97)' }]}>
                  <View style={styles.upgradeCardHeader}>
                    <Text style={[styles.upgradeCardTitle, isDark && { color: '#DDE8D8' }]}>{t('lobbyUpgrade.cardTitle')}</Text>
                    <Text style={[styles.upgradeCardCapacity, { color: '#2592AB' }]}>{t('lobbyUpgrade.seats', { count: lobbyCapacity })}</Text>
                  </View>

                  {/* Progress */}
                  <View style={[styles.upgradeProgressTrack, isDark && { backgroundColor: 'rgba(255,255,255,0.10)' }]}>
                    <LinearGradient
                      colors={['#52A6E2', '#3B8BCB']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        styles.upgradeProgressFill,
                        { width: `${Math.min(100, (lobbyCapacity / maxLobbyCapacity) * 100)}%` as any },
                      ]}
                    />
                  </View>

                  <View style={styles.upgradeDescRow}>
                    <View style={[styles.upgradeIconTile, { backgroundColor: 'rgba(59,139,203,0.15)' }]}>
                      <PersonIcon size={22} color="#3B8BCB" />
                    </View>
                    <Text style={[styles.upgradeDesc, isDark && { color: '#8A9A80' }]}>
                      {t('lobbyUpgrade.description')}
                    </Text>
                  </View>

                  {!lobbyMaxed ? (
                    <Pressable
                      onPress={() => {
                        if (gems < lobbyUpgradeCost) {
                          showInsufficientResources({ currency: 'gems', need: lobbyUpgradeCost, have: gems });
                          return;
                        }
                        upgradeLobby();
                      }}
                      style={({ pressed }) => [
                        styles.upgradeButton,
                        pressed && { opacity: 0.85, transform: [{ translateY: 1 }] },
                      ]}
                    >
                      <LinearGradient
                        colors={['#52A6E2', '#3B8BCB']}
                        style={styles.upgradeButtonGradient}
                      >
                        <Text style={styles.upgradeButtonText}>{t('lobbyUpgrade.upgradeForSeats')}</Text>
                        <GemIcon size={14} />
                        <Text style={styles.upgradeGemCount}>{lobbyUpgradeCost}</Text>
                      </LinearGradient>
                      {!isDark && <View style={[styles.upgradeButtonShadow, { backgroundColor: '#2E72A8' }]} />}
                    </Pressable>
                  ) : (
                    <View style={[styles.maxLevelStrip, isDark && { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                      <CheckIcon size={14} color="#2592AB" />
                      <Text style={[styles.claimedText, { color: '#2592AB' }]}>{t('lobbyUpgrade.maxLevel')}</Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </ScrollView>
        </Animated.View>

        {/* New worker popup — View overlay inside Modal */}
        {!liftSimplifiedRewards && newWorkerPopup && (
          <Pressable style={[StyleSheet.absoluteFill, popupStyles.scrim]} onPress={() => setNewWorkerPopup(null)}>
            <Pressable style={[popupStyles.card, isDark && { backgroundColor: 'rgba(52,55,52,0.97)' }]} onPress={() => {}}>
              <View style={popupStyles.avatarWrap}>
                <WorkerAvatar worker={newWorkerPopup} size={56} />
              </View>
              <View style={popupStyles.info}>
                <Text style={[popupStyles.title, isDark && { color: '#DDE8D8' }]}>{t('newWorkerPopup.title')}</Text>
                <Text style={[popupStyles.name, { color: gameConfig.floorTypes[newWorkerPopup.floorType]?.shirtColor ?? '#3B8BCB' }]}>{newWorkerPopup.name}</Text>
                <Text style={[popupStyles.meta, isDark && { color: '#8A9A80' }]}>
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
                <Text style={[popupStyles.dismissText, isDark && { color: '#8A9A80' }]}>{t('newWorkerPopup.later')}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        )}

        {/* VIP hotel fill popup */}
        {!liftSimplifiedRewards && vipHotelFillCount && (
          <Pressable style={[StyleSheet.absoluteFill, popupStyles.scrim]} onPress={() => setVipHotelFillCount(null)}>
            <Pressable style={[popupStyles.card, isDark && { backgroundColor: 'rgba(52,55,52,0.97)' }]} onPress={() => {}}>
              <View style={[popupStyles.avatarWrap, { backgroundColor: '#FFF9E6' }]}>
                <Text style={{ fontSize: 32 }}>🏨</Text>
              </View>
              <View style={popupStyles.info}>
                <Text style={[popupStyles.title, isDark && { color: '#DDE8D8' }]}>{t('vipHotelFillPopup.title')}</Text>
                <Text style={popupStyles.subtitle}>{t('vipHotelFillPopup.subtitle', { count: vipHotelFillCount })}</Text>
              </View>
              <Pressable onPress={() => setVipHotelFillCount(null)} style={popupStyles.dismissBtn}>
                <Text style={[popupStyles.dismissText, isDark && { color: '#8A9A80' }]}>{t('vipHotelFillPopup.dismiss')}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        )}

        {/* Hotel full popup */}
        {!liftSimplifiedRewards && hotelFullPopup && (
          <Pressable style={[StyleSheet.absoluteFill, popupStyles.scrim]} onPress={() => setHotelFullPopup(false)}>
            <Pressable style={[popupStyles.card, isDark && { backgroundColor: 'rgba(52,55,52,0.97)' }]} onPress={() => {}}>
              <View style={[popupStyles.avatarWrap, { backgroundColor: '#FDEEF2' }]}>
                <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                  <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="#A8475F" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M9 22V12h6v10" stroke="#A8475F" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <View style={popupStyles.info}>
                <Text style={[popupStyles.title, isDark && { color: '#DDE8D8' }]}>{t('hotelFullPopup.title')}</Text>
                <Text style={popupStyles.subtitle}>{t('hotelFullPopup.subtitle')}</Text>
              </View>
              <Pressable
                onPress={() => { setHotelFullPopup(false); onClose(); onOpenHotel?.(); }}
                style={({ pressed }) => [popupStyles.findJobBtn, pressed && { opacity: 0.85 }]}
              >
                <LinearGradient colors={['#C9637E', '#A8475F']} style={popupStyles.findJobGradient}>
                  <Text style={popupStyles.findJobText}>{t('hotelFullPopup.goToHotel')}</Text>
                </LinearGradient>
              </Pressable>
              <Pressable onPress={() => setHotelFullPopup(false)} style={popupStyles.dismissBtn}>
                <Text style={[popupStyles.dismissText, isDark && { color: '#8A9A80' }]}>{t('hotelFullPopup.dismiss')}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        )}

        {/* Builder tool drop popup */}
        {!liftSimplifiedRewards && builderToolDrop && (
          <Pressable style={[StyleSheet.absoluteFill, popupStyles.scrim]} onPress={clearBuilderToolDrop}>
            <Pressable style={[popupStyles.card, isDark && { backgroundColor: 'rgba(52,55,52,0.97)' }]} onPress={() => {}}>
              <View style={popupStyles.avatarWrap}>
                <Image
                  source={TOOL_IMAGES[builderToolDrop]}
                  style={{ width: 48, height: 48 }}
                  contentFit="contain"
                />
              </View>
              <View style={popupStyles.info}>
                <Text style={[popupStyles.title, isDark && { color: '#DDE8D8' }]}>{t('builderPopup.title')}</Text>
                <Text style={[popupStyles.name, { color: '#E67E22' }]}>{t(`tools.${builderToolDrop}`)}</Text>
                <Text style={popupStyles.subtitle}>{t('builderPopup.subtitle')}</Text>
              </View>
              <Pressable onPress={clearBuilderToolDrop} style={popupStyles.dismissBtn}>
                <Text style={[popupStyles.dismissText, isDark && { color: '#8A9A80' }]}>{t('builderPopup.dismiss')}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        )}

        {/* Builder warehouse full popup */}
        {!liftSimplifiedRewards && builderWarehouseFull && (
          <Pressable style={[StyleSheet.absoluteFill, popupStyles.scrim]} onPress={clearBuilderWarehouseFull}>
            <Pressable style={[popupStyles.card, isDark && { backgroundColor: 'rgba(52,55,52,0.97)' }]} onPress={() => {}}>
              <View style={[popupStyles.avatarWrap, { backgroundColor: 'rgba(229,82,82,0.12)' }]}>
                <Image source={require('../../assets/img/warningIcon.png')} style={{ width: 40, height: 40 }} contentFit="contain" />
              </View>
              <View style={popupStyles.info}>
                <Text style={[popupStyles.title, isDark && { color: '#DDE8D8' }]}>{t('builderPopup.warehouseFullTitle')}</Text>
                <Text style={popupStyles.subtitle}>{t('builderPopup.warehouseFullSubtitle')}</Text>
              </View>
              <Pressable onPress={clearBuilderWarehouseFull} style={popupStyles.dismissBtn}>
                <Text style={[popupStyles.dismissText, isDark && { color: '#8A9A80' }]}>{t('builderPopup.dismiss')}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        )}

        {/* Deliver All summary popup — View overlay inside this Modal (original design) */}
        <DeliverAllModal
          asOverlay
          visible={!!pendingDeliverAll}
          summary={pendingDeliverAll}
          onDismiss={clearPendingDeliverAll}
        />

        {/* Lobby info popup */}
        {infoVisible && (
          <View style={infoStyles.scrim}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setInfoVisible(false)} />
            <View style={[infoStyles.card, isDark && { backgroundColor: 'rgba(52,55,52,0.97)' }]}>
              <LinearGradient colors={['#C9637E', '#A8475F']} style={infoStyles.cardHeader}>
                <Text style={infoStyles.cardTitle}>About the Lobby</Text>
                <Pressable onPress={() => setInfoVisible(false)} hitSlop={10}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path d="M18 6L6 18M6 6l12 12" stroke="rgba(255,255,255,0.85)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </Pressable>
              </LinearGradient>
              <ScrollView style={infoStyles.scroll} showsVerticalScrollIndicator={false}>
                <View style={infoStyles.cardBody}>
                  <InfoSection
                    icon={require('../../assets/img/reception.png')}
                    title="Lobby"
                    text="The lobby is your tower's entrance. Visitors arrive here and you use the elevator to guide them to their destinations."
                  />
                  <InfoSection
                    icon={require('../../assets/img/lift/visitor.png')}
                    title="Guests"
                    text="Guests head to floor 1 (Hotel) and check in as new workers. Guide them up to grow your team."
                  />
                  <InfoSection
                    icon={require('../../assets/img/lift/businessman.png')}
                    title="Businessmen"
                    text="Businessmen pay in gems — one gem per visit, up to your daily limit. Lift them to any floor to collect."
                  />
                  <InfoSection
                    icon={require('../../assets/img/lift/delivery.png')}
                    title="Deliverers & Sellers"
                    text="Deliverers and sellers visit production floors to bring supplies or buyers. Lift them to earn coin tips."
                  />
                  <InfoSection
                    icon={require('../../assets/img/coin.png')}
                    title="Daily Tips"
                    text="Every coin tip you collect counts toward your daily tip goal. Reach the two milestones to earn gem rewards."
                  />
                  <InfoSection
                    icon={require('../../assets/img/quicActions/deliver.png')}
                    title="Deliver All"
                    text="Spend 1 gem to instantly deliver all waiting visitors at once — great when the lobby is packed."
                  />
                </View>
              </ScrollView>
            </View>
          </View>
        )}
        {/* Buy all gems confirmation popup */}
        {showBuyGemsConfirm && (
          <Pressable style={[StyleSheet.absoluteFill, popupStyles.scrim]} onPress={() => setShowBuyGemsConfirm(false)}>
            <Pressable style={[popupStyles.card, isDark && { backgroundColor: 'rgba(52,55,52,0.97)' }]} onPress={() => {}}>
              <View style={[popupStyles.avatarWrap, { backgroundColor: 'rgba(82,166,226,0.12)' }]}>
                <GemIcon size={36} />
              </View>
              <View style={popupStyles.info}>
                <Text style={[popupStyles.title, isDark && { color: '#DDE8D8' }]}>{t('dailyGems.confirmTitle')}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                  <Text style={[popupStyles.confirmAmount, { color: '#2592AB' }]}>+{gemsRemaining}</Text>
                  <GemIcon size={20} />
                  <Text style={[popupStyles.confirmFor, isDark && { color: '#8A9A80' }]}>{t('dailyGems.confirmFor')}</Text>
                  <CoinIcon size={20} />
                  <Text style={[popupStyles.confirmAmount, { color: '#E5A41C' }]}>{formatNum(buyAllGemsCost)}</Text>
                </View>
              </View>
              <Pressable
                onPress={() => {
                  setShowBuyGemsConfirm(false);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  buyAllDailyGems();
                }}
                style={({ pressed }) => [popupStyles.findJobBtn, pressed && { opacity: 0.85 }]}
              >
                <LinearGradient colors={['#52A6E2', '#3B8BCB']} style={popupStyles.findJobGradient}>
                  <Text style={popupStyles.findJobText}>{t('dailyGems.confirmBuy')}</Text>
                </LinearGradient>
              </Pressable>
              <Pressable onPress={() => setShowBuyGemsConfirm(false)} style={popupStyles.dismissBtn}>
                <Text style={[popupStyles.dismissText, isDark && { color: '#8A9A80' }]}>{t('dailyGems.confirmCancel')}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        )}

        <InsufficientResourcesModal asOverlay />
      </GestureHandlerRootView>
    </Modal>
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
    backgroundColor: '#ffffff',
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
  confirmAmount: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 22,
  },
  confirmFor: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 16,
    color: '#5A6478',
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
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(155,163,176,0.35)',
    marginTop: 2,
  },
  dismissText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: '#6E7686',
  },
});

/* ---------- Styles ---------- */

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
  statCol: {
    flex: 1,
    flexDirection: 'column',
    gap: 5,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.13)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  statLabel: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
  },
  statValue: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 14,
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
    backgroundColor: '#ffffff',
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
  fillLobbyButton: {
    borderRadius: 13,
    overflow: 'hidden',
    position: 'relative',
    marginTop: 8,
    alignSelf: 'stretch',
  },
  fillLobbyGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 13,
    zIndex: 1,
  },
  fillLobbyText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 14.5,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  fillLobbyGemCount: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 14.5,
    color: '#fff',
  },
  fillLobbyButtonShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#2E72A8',
    borderBottomLeftRadius: 13,
    borderBottomRightRadius: 13,
  },

  /* Deliver All */
  deliverAllCard: {
    backgroundColor: '#ffffff',
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
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 11,
    shadowColor: 'rgba(40,60,90,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  dailyGemsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  buyGemsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(82,166,226,0.13)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  buyGemsChipText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 12,
    color: '#3B8BCB',
  },

  dailyTipsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 10,
    shadowColor: 'rgba(40,60,90,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.13,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(40,60,90,0.06)',
  },
  dailyTipsLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
    color: '#5A6478',
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
  stageDivider: {
    position: 'absolute',
    left: '50%' as any,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 1,
  },
  milestoneAboveRow: {
    position: 'relative',
    height: 16,
    marginBottom: 1,
  },
  milestoneBelowRow: {
    position: 'relative',
    height: 14,
    marginTop: 1,
  },
  milestone0: {
    position: 'absolute',
    left: 0,
    top: 0,
    alignItems: 'center',
  },
  milestone50: {
    position: 'absolute',
    left: '50%' as any,
    width: 64,
    marginLeft: -32,
    alignItems: 'center',
    top: 0,
  },
  milestone100: {
    position: 'absolute',
    right: 0,
    alignItems: 'center',
    top: 0,
  },
  milestoneAmount: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12,
    color: '#5A6070',
  },
  milestoneReward: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 11,
    color: '#3B8BCB',
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
    color: '#fff',
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
    backgroundColor: '#ffffff',
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
    color: '#fff',
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
  inlineRewardStrip: {
    height: 34,
    justifyContent: 'center',
  },
  inlineRewardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  inlineRewardText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
    color: '#2A3344',
  },
  inlineRewardWarning: {
    fontSize: 14,
    color: '#E8A020',
  },
  inlineRewardEmoji: {
    fontSize: 16,
  },
});

const infoStyles = StyleSheet.create({
  scrim: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(18,26,44,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    maxHeight: SCREEN_HEIGHT * 0.75,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  cardTitle: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 17,
    color: '#fff',
    letterSpacing: 0.4,
  },
  scroll: {},
  cardBody: {
    padding: 18,
    paddingTop: 4,
  },
  section: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(201,99,126,0.35)',
  },
  icon: {
    width: 24,
    height: 24,
    marginTop: 1,
  },
  textCol: {
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
