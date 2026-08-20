import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ImageBackground, ScrollView, LayoutChangeEvent, useColorScheme, LayoutAnimation, Platform, UIManager } from 'react-native';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}
import { useNavigation, router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { formatNum } from '../../src/utils/format';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing as ReanimatedEasing,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import TopBar from '../../src/components/TopBar';
import FloorCard from '../../src/components/FloorCard';
import BuyFloorBanner from '../../src/components/BuyFloorBanner';
import UnderConstructionBanner from '../../src/components/UnderConstructionBanner';
import BusinessTypePickerSheet from '../../src/components/BusinessTypePickerSheet';
import { HotelFloor, LobbyFloor } from '../../src/components/TechnicalFloor';
import HotelPanel from '../../src/components/HotelPanel';
import LobbyPanel from '../../src/components/LobbyPanel';
import { useGameStore, useBalance } from '../../src/stores/gameStore';
import { useAuthStore } from '../../src/stores/authStore';
import { useMailStore } from '../../src/stores/mailStore';
import { useFriendStore } from '../../src/stores/friendStore';
import { useOnboardingStore, SEQUENCE } from '../../src/stores/onboardingStore';
import { useGameClock } from '../../src/hooks/useGameClock';
import { gameConfig } from '../../shared/config/gameConfig';
import { getExhaustedFloorTypes } from '../../shared/engine/floorTypeUtils';
import { syncService } from '../../src/services/sync';
import { xpForLevel } from '../../shared/engine/xp';
import { calcRevenuePerMin } from '../../shared/engine/ratingUtils';
import type { UnderConstructionState } from '../../shared/types';
import QuickActionFAB from '../../src/components/QuickActionFAB';
import QuickActionBar from '../../src/components/QuickActionBar';
import QaAnimatedFloor from '../../src/components/QaAnimatedFloor';
import DailyTasksFAB from '../../src/components/DailyTasksFAB';
import NotificationFAB from '../../src/components/NotificationFAB';
import { DAILY_TASKS, getTaskProgress } from '../../shared/config/dailyTasksConfig';
import {
  getAvailableMode,
  getFloorsForMode,
  getFloorActionInfo,
  type QuickActionMode,
} from '../../src/utils/quickAction';
import { getProductionStatus } from '../../shared/engine/productionStatus';
import { FLOOR_STAR_MULTIPLIERS } from '../../shared/config/floorUpgradeConfig';
import { hasAnyBetterCandidate } from '../../src/utils/workerCandidate';
import { getWorkerForSlot } from '../../shared/engine/workerUtils';

type FloorItem =
  | { type: 'production'; id: number }
  | { type: 'hotel' }
  | { type: 'lobby' }
  | { type: 'buyFloor' }
  | { type: 'underConstruction'; floorId: number; uc: UnderConstructionState }
  | { type: 'collapseDivider'; hiddenCount: number }
  | { type: 'bottomAnchor' };

function keyExtractor(item: FloorItem): string {
  if (item.type === 'production') return `prod-${item.id}`;
  if (item.type === 'underConstruction') return `uc-${item.floorId}`;
  return item.type; // 'hotel' | 'lobby' | 'buyFloor' | 'collapseDivider' | 'bottomAnchor' — all unique
}

const BG_LIGHT       = require('../../assets/img/backgroung/bgWhite.png');
const BG_DARK        = require('../../assets/img/backgroung/bgBlack.png');
const MAIL_FAB_ICON  = require('../../assets/img/mail.png');
const FRIEND_FAB_ICON = require('../../assets/img/users.png');

export default function GameScreen() {
  const scheme = useColorScheme();
  const bgSource = scheme === 'dark' ? BG_DARK : BG_LIGHT;
  const { t } = useTranslation('tabs');
  const { t: tContent } = useTranslation('gameContent');
  const balance = useBalance();
  const now = useGameClock(1000);
  const revenueNow = useGameClock(10_000);
  const playerLevel = useGameStore((s) => s.playerLevel);
  const playerXp = useGameStore((s) => s.playerXp);
  const unclaimedDailyTasksCount = useGameStore((s) =>
    DAILY_TASKS.filter((task) => {
      const progress = getTaskProgress(s, task);
      return progress >= task.threshold && !s.dailyTasks.claimed.includes(task.key);
    }).length,
  );
  const gems = useGameStore((s) => s.gems);
  const storeCollect = useGameStore((s) => s.collect);
  const storeList = useGameStore((s) => s.list);
  const storeBuy = useGameStore((s) => s.buy);
  const collectAll = useGameStore((s) => s.collectAll);
  const listAll = useGameStore((s) => s.listAll);
  const buyAll = useGameStore((s) => s.buyAll);
  const lastSyncAt = useGameStore((s) => s.lastSyncAt);
  const isHydrated = useGameStore((s) => s.isHydrated);
  const pendingOpenHotel = useGameStore((s) => s.pendingOpenHotel);
  const clearPendingOpenHotel = useGameStore((s) => s.clearPendingOpenHotel);
  const showInsufficientResources = useGameStore((s) => s.showInsufficientResources);
  const hotelCapacity = useGameStore((s) => s.hotelCapacity);
  const hotelOccupied = useGameStore((s) => s.workers.filter(w => w.assignedFloorId === null).length);
  const hotelTotal = hotelCapacity;
  const lobbyVisitors = useGameStore((s) => s.lobbyVisitors);
  const nextVisitorAt = useGameStore((s) => s.nextVisitorAt);
  const lobbyCapacity = useGameStore((s) => s.lobbyCapacity);
  const spawnVisitor = useGameStore((s) => s.spawnVisitor);
  const player = useAuthStore((s) => s.player);
  const playerName = player?.playerName ?? t('profile.guestFallbackName');
  const isTemporary = player?.isTemporary ?? false;

  const isOnboarding = useOnboardingStore((s) => s.isActive);
  const onboardingStep = useOnboardingStore((s) => s.step);

  const unreadMailCount = useMailStore((s) => s.unreadCount);
  const incomingFriendCount = useFriendStore((s) => s.incomingRequests.length);

  const underConstruction = useGameStore((s) => s.underConstruction);
  const buyFloor = useGameStore((s) => s.buyFloor);
  const selectFloorType = useGameStore((s) => s.selectFloorType);
  const openFloor = useGameStore((s) => s.openFloor);
  const [pickerOpenFor, setPickerOpenFor] = useState<number | null>(null);

  const floors = useGameStore((s) => s.floors);

  // Ensure tutorial floors show READY_TO_COLLECT regardless of server state or
  // stale bundle cache. Re-runs whenever floors or step change so a sync that
  // sends IDLE can't quietly revert the tutorial state before the user collects.
  useEffect(() => {
    if (onboardingStep === 'collect_slot_1') {
      const floor2 = floors.find((f) => f.id === 2);
      if (floor2?.productions[0]?.stage !== 'SELLING') {
        useGameStore.getState().initOnboardingProductions();
      }
    } else if (onboardingStep === 'collect_slot_2') {
      const floor3 = floors.find((f) => f.id === 3);
      if (floor3?.productions[0]?.stage !== 'SELLING') {
        useGameStore.getState().initOnboardingProductions();
      }
    }
  }, [floors, onboardingStep]);

  const workers = useGameStore((s) => s.workers);
  const openedFloorTypes  = useGameStore((s) => s.openedFloorTypes);
  const coinBonusPercent  = useGameStore((s) => s.coinBonusPercent);
  const businessUpgrades  = useGameStore((s) => s.businessUpgrades);
  const floorStars        = useGameStore((s) => s.floorStars);

  const revenuePerMin = React.useMemo(
    () => calcRevenuePerMin(floors, workers, openedFloorTypes ?? {}, gameConfig, revenueNow, businessUpgrades, coinBonusPercent, floorStars),
    [floors, workers, openedFloorTypes, revenueNow, businessUpgrades, coinBonusPercent, floorStars],
  );

  const hasBetterWorker = React.useMemo(
    () => hasAnyBetterCandidate(workers, floors, openedFloorTypes ?? {}),
    [workers, floors, openedFloorTypes],
  );

  const builtFloorCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    const oft = openedFloorTypes ?? {};
    for (const f of floors) {
      const ft = gameConfig.floors.find((cf) => cf.id === f.id)?.floorType ?? oft[String(f.id)];
      if (ft) counts[ft] = (counts[ft] ?? 0) + 1;
    }
    return counts;
  }, [floors, openedFloorTypes]);

  const hotelWorkerCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const w of workers) {
      if (w.assignedFloorId === null) {
        counts[w.floorType] = (counts[w.floorType] ?? 0) + 1;
      }
    }
    return counts;
  }, [workers]);

  const exhaustedByFloor = React.useMemo(() => {
    const map = new Map<number, Set<string>>();
    for (const uc of underConstruction) {
      map.set(
        uc.floorId,
        getExhaustedFloorTypes(
          uc.floorId,
          floors,
          openedFloorTypes ?? {},
          underConstruction,
          gameConfig,
        ),
      );
    }
    return map;
  }, [underConstruction, floors, openedFloorTypes]);

  const { nextFloorId, nextFloorUnlock } = React.useMemo(() => {
    const highestFloorId = Math.max(
      ...floors.map((f) => f.id),
      ...gameConfig.floors.map((f) => f.id),
      ...underConstruction.map((uc) => uc.floorId),
    );
    const nfId = highestFloorId + 1;
    return {
      nextFloorId: nfId,
      nextFloorUnlock: gameConfig.floorUnlocks.find((f) => f.floorId === nfId) ?? null,
    };
  }, [floors, underConstruction]);

  const [towerCollapsed, setTowerCollapsed] = useState(true);

  const floorList: FloorItem[] = React.useMemo(() => {
    const items: FloorItem[] = [];
    if (nextFloorUnlock && (isHydrated || lastSyncAt > 0)) {
      items.push({ type: 'buyFloor' });
    }

    const ucById = new Map(underConstruction.map((uc) => [uc.floorId, uc]));
    const allIds = new Set([
      ...floors.map((f) => f.id),
      ...underConstruction.map((uc) => uc.floorId),
    ]);
    const sortedIds = [...allIds].sort((a, b) => b - a);

    // Only count open-business (production) floors for the collapse threshold
    const productionIds = floors.map((f) => f.id).sort((a, b) => b - a);
    const canCollapse = productionIds.length >= 10;

    if (canCollapse) {
      const topId = productionIds[0]; // highest open-business floor
      const aboveTopIds = sortedIds.filter((id) => id > topId);
      const belowIds = sortedIds.filter((id) => id < topId);

      if (towerCollapsed) {
        // Collapsed: UC floors above topId → topId → divider
        for (const id of aboveTopIds) {
          const uc = ucById.get(id);
          if (uc) {
            items.push({ type: 'underConstruction', floorId: id, uc });
          } else {
            items.push({ type: 'production', id });
          }
        }
        items.push({ type: 'production', id: topId });
        items.push({ type: 'collapseDivider', hiddenCount: productionIds.length });
      } else {
        // Expanded: UC floors above topId → divider → topId → all remaining floors
        for (const id of aboveTopIds) {
          const uc = ucById.get(id);
          if (uc) {
            items.push({ type: 'underConstruction', floorId: id, uc });
          } else {
            items.push({ type: 'production', id });
          }
        }
        items.push({ type: 'collapseDivider', hiddenCount: 0 });
        items.push({ type: 'production', id: topId });
        for (const id of belowIds) {
          const uc = ucById.get(id);
          if (uc) {
            items.push({ type: 'underConstruction', floorId: id, uc });
          } else {
            items.push({ type: 'production', id });
          }
        }
      }
    } else {
      for (const id of sortedIds) {
        const uc = ucById.get(id);
        if (uc) {
          items.push({ type: 'underConstruction', floorId: id, uc });
        } else {
          items.push({ type: 'production', id });
        }
      }
    }

    items.push({ type: 'hotel' });
    items.push({ type: 'lobby' });
    items.push({ type: 'bottomAnchor' });
    return items;
  }, [underConstruction, floors, nextFloorUnlock, isHydrated, lastSyncAt, towerCollapsed]);

  const [hotelOpen, setHotelOpen] = useState(false);
  const [lobbyOpen, setLobbyOpen] = useState(false);
  const listRef = useRef<FlashListRef<FloorItem>>(null);
  const qaListRef = useRef<FlashListRef<FloorItem>>(null);
  const lobbyCardRef = useRef<View>(null);
  const buyFloorRef = useRef<View>(null);
  const collapsedScrollRef = useRef<ScrollView>(null);
  const hotelCardYRef = useRef(0);
  const lastTabPressRef = useRef(0);
  const quickActionModeRef = useRef<QuickActionMode | null>(null);
  const viewHeightRef = useRef(0);
  const hasRevealedRef = useRef(false);
  const floorListRef = useRef(floorList);
  floorListRef.current = floorList;
  const towerOpacity = useSharedValue(0);
  const towerStyle = useAnimatedStyle(() => ({ opacity: towerOpacity.value }));
  const qaOverlayOpacity = useSharedValue(0);
  const qaOverlayStyle = useAnimatedStyle(() => ({ opacity: qaOverlayOpacity.value }));

  const scrollToBottom = useCallback(() => {
    listRef.current?.scrollToIndex({
      index: floorListRef.current.length - 1, // bottomAnchor
      animated: false,
      viewPosition: 1, // anchor's bottom edge = viewport bottom
    });
  }, []);


  // When advancing to collect_slot_2, scroll back to offset 0 so floor3 is visible.
  // Only depends on step (not floorList) — avoids oscillation from data updates.
  useEffect(() => {
    if (onboardingStep !== 'collect_slot_2') return;
    const handle = requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
    return () => cancelAnimationFrame(handle);
  }, [onboardingStep]);

  // For elevator/delivery steps: scroll to lobby so it's always reachable.
  useEffect(() => {
    const elevatorSteps = ['open_elevator_1', 'deliver_visitor'];
    if (!elevatorSteps.includes(onboardingStep ?? '')) return;
    // Scroll on next frame — lobby card may not be rendered yet but FlashList can still position
    const scrollFrame = requestAnimationFrame(() => {
      const idx = floorListRef.current.findIndex((i) => i.type === 'lobby');
      if (idx >= 0) {
        listRef.current?.scrollToIndex({ index: idx, animated: false, viewPosition: 0.5 });
      }
    });
    // Spotlight measurement only for steps where user needs to find and tap the lobby card
    const needsSpotlight = onboardingStep === 'open_elevator_1';
    const measureTimer = setTimeout(() => {
      const idx = floorListRef.current.findIndex((i) => i.type === 'lobby');
      if (idx >= 0) {
        listRef.current?.scrollToIndex({ index: idx, animated: false, viewPosition: 0.5 });
      }
      if (!needsSpotlight) return;
      requestAnimationFrame(() => {
        lobbyCardRef.current?.measureInWindow((x, y, width, height) => {
          if (width > 0 && height > 0) {
            useOnboardingStore.getState().setTargetRect({ x, y, width, height });
          }
        });
      });
    }, 700);
    return () => {
      cancelAnimationFrame(scrollFrame);
      clearTimeout(measureTimer);
    };
  }, [onboardingStep]);

  // On delivery steps: spotlight lobby card when lobby is closed (so user knows to reopen it).
  useEffect(() => {
    const deliverySteps = ['deliver_visitor'];
    if (!deliverySteps.includes(onboardingStep ?? '')) return;
    if (lobbyOpen) {
      // Lobby is open — clear spotlight (overlay not visible inside Modal anyway)
      useOnboardingStore.getState().setTargetRect(null);
      return;
    }
    // Lobby closed — measure and spotlight the lobby card
    const timer = setTimeout(() => {
      const idx = floorListRef.current.findIndex((i) => i.type === 'lobby');
      if (idx >= 0) {
        listRef.current?.scrollToIndex({ index: idx, animated: false, viewPosition: 0.5 });
      }
      requestAnimationFrame(() => {
        lobbyCardRef.current?.measureInWindow((x, y, width, height) => {
          if (width > 0 && height > 0) {
            useOnboardingStore.getState().setTargetRect({ x, y, width, height });
          }
        });
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [lobbyOpen, onboardingStep]);

  // When assign_worker step starts, close the lobby and scroll to top so production floors are visible.
  useEffect(() => {
    if (onboardingStep !== 'assign_worker') return;
    setLobbyOpen(false);
    const scrollTimer = setTimeout(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, 300);
    // Auto-open the hotel so the user sees the worker slot spotlight.
    const hotelTimer = setTimeout(() => {
      setHotelOpen(true);
    }, 500);
    return () => { clearTimeout(scrollTimer); clearTimeout(hotelTimer); };
  }, [onboardingStep]);

  // When buy_floor step starts, close hotel, scroll to BuyFloorBanner, then measure for spotlight.
  useEffect(() => {
    if (onboardingStep !== 'buy_floor') return;
    setHotelOpen(false);
    useOnboardingStore.getState().setTargetRect(null);
    const scrollTimer = setTimeout(() => {
      // buyFloor is always index 0 — scroll to top is simpler and more reliable.
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, 300);
    const measureTimer = setTimeout(() => {
      buyFloorRef.current?.measureInWindow((x, y, width, height) => {
        if (height > 0) useOnboardingStore.getState().setTargetRect({ x, y, width, height });
      });
    }, 700);
    return () => { clearTimeout(scrollTimer); clearTimeout(measureTimer); };
  }, [onboardingStep]);

  // When speed_up_construction / expand_floor_card / open_business steps start,
  // scroll to the under-construction banner so it's visible and measurable.
  useEffect(() => {
    const ucSteps = ['speed_up_construction', 'expand_floor_card', 'open_business'] as const;
    if (!ucSteps.includes(onboardingStep as typeof ucSteps[number])) return;
    const scrollTimer = setTimeout(() => {
      const idx = floorListRef.current.findIndex((i) => i.type === 'underConstruction');
      if (idx >= 0) {
        listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
      }
    }, 300);
    return () => clearTimeout(scrollTimer);
  }, [onboardingStep]);

  // When choose_floor_type is reached, ensure the picker is open for the under-construction floor.
  // This is a safety net for cases where setPickerOpenFor in onPress didn't produce a visible picker.
  useEffect(() => {
    if (onboardingStep !== 'choose_floor_type') return;
    setPickerOpenFor((cur) => {
      if (cur !== null) return cur;
      const uc = useGameStore.getState().underConstruction;
      return uc.length > 0 ? uc[uc.length - 1].floorId : null;
    });
  }, [onboardingStep]);

  // Ensure hotel guest (floor 1) is present for elevator onboarding steps so collectTip creates a worker.
  useEffect(() => {
    const state = useGameStore.getState();
    const firstVisitor = state.lobbyVisitors[0];
    if (onboardingStep === 'open_elevator_1' || onboardingStep === 'deliver_visitor') {
      if (firstVisitor?.targetFloor !== 1) state.spawnOnboardingVisitor('guest', 1);
    }
  }, [onboardingStep, lobbyVisitors.length]);

  const scrollToHotel = useCallback(() => {
    if (towerCollapsed && floors.length >= 10) {
      collapsedScrollRef.current?.scrollTo({ y: hotelCardYRef.current, animated: true });
    } else {
      const idx = floorListRef.current.findIndex((i) => i.type === 'hotel');
      if (idx >= 0) {
        listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0 });
      }
    }
  }, [towerCollapsed, floors.length]);


  const [quickActionMode, setQuickActionMode] = useState<QuickActionMode | null>(null);
  const [qaBarVisible, setQaBarVisible] = useState(false);
  const [leavingFloorId, setLeavingFloorId] = useState<number | null>(null);
  const pendingActionRef = useRef<(() => void) | null>(null);
  quickActionModeRef.current = quickActionMode;
  const qaBarVisibleRef = useRef(false);
  qaBarVisibleRef.current = qaBarVisible;
  // Tracks intentional ✕ exits so the defensive restore effect doesn't override them.
  const qaExitRequestedRef = useRef(false);

  const navigation = useNavigation();
  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress' as any, () => {
      const now = Date.now();
      if (now - lastTabPressRef.current < 400) {
        scrollToHotel();
      }
      lastTabPressRef.current = now;
    });
    return unsubscribe;
  }, [navigation, scrollToHotel]);

  // Highest-priority mode currently available — only computed when not already in a mode
  const availableMode = React.useMemo(
    () => (quickActionMode !== null || isOnboarding ? null : getAvailableMode(floors, workers, now, floorStars ?? {})),
    [quickActionMode, isOnboarding, floors, workers, now, floorStars],
  );

  // Count of floors for the FAB badge (only when not yet in a mode)
  const availableFloorCount = React.useMemo(
    () => (availableMode !== null ? getFloorsForMode(availableMode, floors, workers, now, floorStars ?? {}).length : 0),
    [availableMode, floors, workers, now, floorStars],
  );

  // Always compute QA floors — even before the mode is activated — so the overlay
  // is pre-rendered and pre-scrolled in the background before the user opens it.
  const precomputedMode = quickActionMode ?? availableMode;
  const filteredFloors = React.useMemo(
    () => (precomputedMode !== null ? getFloorsForMode(precomputedMode, floors, workers, now, floorStars ?? {}) : []),
    [precomputedMode, floors, workers, now, floorStars],
  );

  const qaItems = React.useMemo(
    (): FloorItem[] => filteredFloors.map((f) => ({ type: 'production' as const, id: f.id })),
    [filteredFloors],
  );

  const listExtraData = React.useMemo(
    () => ({ nextFloorUnlock, towerCollapsed, onboardingStep }),
    [nextFloorUnlock, towerCollapsed, onboardingStep],
  );

  // The bottom-most floor (last in sorted-descending list = lowest ID = nearest the bar)
  const bottomFloor = filteredFloors.length > 0 ? filteredFloors[filteredFloors.length - 1] : null;

  // Action info for the bottom floor — drives the QuickActionBar label
  const bottomFloorInfo = React.useMemo(
    () =>
      bottomFloor !== null && quickActionMode !== null
        ? getFloorActionInfo(quickActionMode, bottomFloor, now, workers, coinBonusPercent, openedFloorTypes ?? {}, businessUpgrades ?? {}, floorStars ?? {})
        : null,
    [bottomFloor, quickActionMode, now, workers, coinBonusPercent, openedFloorTypes, businessUpgrades, floorStars],
  );

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;
    syncService.start();
    return () => syncService.stop();
  }, [isAuthenticated]);

  // When starting in collapsed mode, FlashList never fires onContentSizeChange,
  // so we reveal the tower here instead.
  useEffect(() => {
    if (towerCollapsed && floors.length >= 10 && (!hasRevealedRef.current || towerOpacity.value === 0)) {
      hasRevealedRef.current = true;
      towerOpacity.value = withTiming(1, {
        duration: 350,
        easing: ReanimatedEasing.out(ReanimatedEasing.quad),
      });
    }
  }, [towerCollapsed, floors.length, towerOpacity]);

  useEffect(() => {
    if (now <= 0) return;
    // During onboarding elevator steps the correct visitor is managed by the spawn effect below.
    const elevatorOnboardingSteps = ['open_elevator_1', 'deliver_visitor'];
    if (elevatorOnboardingSteps.includes(onboardingStep ?? '')) return;
    let s = useGameStore.getState();
    while (
      (s.nextVisitorAt === 0 || now >= s.nextVisitorAt) &&
      s.lobbyVisitors.length < s.lobbyCapacity
    ) {
      const prevNextAt = s.nextVisitorAt;
      spawnVisitor();
      s = useGameStore.getState();
      if (s.nextVisitorAt === prevNextAt) break;
    }
  }, [now, nextVisitorAt, lobbyVisitors.length, lobbyCapacity, spawnVisitor, onboardingStep]);

  // Auto-exit when the filtered list empties after the last action
  useEffect(() => {
    if (quickActionMode !== null && filteredFloors.length === 0) {
      setQaBarVisible(false);
    }
  }, [quickActionMode, filteredFloors.length]);

  // Show bar when QA mode activates
  useEffect(() => {
    if (quickActionMode !== null) {
      setQaBarVisible(true);
    }
  }, [quickActionMode]);

  // Defensive restore: if the bar was spuriously hidden (not by ✕ and not by
  // auto-exit) while QA mode is active and floors remain — bring it back.
  useEffect(() => {
    if (qaBarVisible) {
      qaExitRequestedRef.current = false; // reset on any re-show
      return;
    }
    if (quickActionMode !== null && filteredFloors.length > 0 && !qaExitRequestedRef.current) {
      setQaBarVisible(true);
    }
  }, [quickActionMode, filteredFloors.length, qaBarVisible]);

  // Stable key: only changes when the set of floor IDs changes, not on every `now` tick.
  const qaItemKey = qaItems.map((i) => (i.type === 'production' ? i.id : i.type)).join(',');

  // Keep the QA overlay pre-scrolled to the bottom at all times — even while hidden —
  // so it is already in the correct position when it becomes visible.
  useEffect(() => {
    if (qaItems.length === 0) return;
    const handle = requestAnimationFrame(() => {
      qaListRef.current?.scrollToEnd({ animated: false });
    });
    return () => cancelAnimationFrame(handle);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qaItemKey]);

  // Fade the QA overlay in/out in sync with the bar animation.
  useEffect(() => {
    if (qaBarVisible) {
      qaOverlayOpacity.value = withTiming(1, { duration: 220, easing: ReanimatedEasing.out(ReanimatedEasing.quad) });
    } else {
      qaOverlayOpacity.value = withTiming(0, { duration: 380, easing: ReanimatedEasing.in(ReanimatedEasing.quad) });
    }
  }, [qaBarVisible, qaOverlayOpacity]);

  useEffect(() => {
    if (pendingOpenHotel) {
      setLobbyOpen(false);
      setHotelOpen(true);
      clearPendingOpenHotel();
    }
  }, [pendingOpenHotel, clearPendingOpenHotel]);

  const resolveFloorName = useCallback(
    (floorId: number, floor: { productions: { typeId: string | null }[] }): string => {
      const dynamicType = openedFloorTypes?.[String(floorId)];
      if (dynamicType) {
        const firstTypeId = floor.productions[0]?.typeId;
        if (firstTypeId) {
          const biz = gameConfig.floorTypes[dynamicType]?.businesses.find((b) =>
            b.dreamJobs.includes(firstTypeId),
          );
          if (biz?.name) return biz.name;
        }
      }
      return tContent(`floors.${floorId}.name`, { defaultValue: `Floor ${floorId}` });
    },
    [openedFloorTypes, tContent],
  );

  const handleFABPress = useCallback(() => {
    if (quickActionMode !== null) {
      setQaBarVisible(false);
    } else if (availableMode !== null) {
      setQuickActionMode(availableMode);
    }
  }, [quickActionMode, availableMode]);

  const handleQaExit = useCallback(() => {
    qaExitRequestedRef.current = true;
    setQaBarVisible(false);
  }, []);

  const handleQaHidden = useCallback(() => {
    // Guard against stale animation callbacks firing during a new QA session.
    // If qaBarVisible is true, the user re-entered QA mode before the old
    // slide-out animation finished — don't reset the active mode.
    if (!qaBarVisibleRef.current) {
      setQuickActionMode(null);
    }
  }, []);

  const handleBulkAll = useCallback(() => {
    if (!quickActionMode) return;
    switch (quickActionMode) {
      case 'collect': collectAll(); break;
      case 'list':    listAll();    break;
      case 'buy':     buyAll();     break;
      // hire: no bulk action
    }
  }, [quickActionMode, collectAll, listAll, buyAll]);

  const executeQaAction = useCallback(() => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    if (action) {
      LayoutAnimation.configureNext({
        duration: 120,
        update: { type: LayoutAnimation.Types.spring, springDamping: 0.85 },
      });
      action();
    }
    setLeavingFloorId(null);
  }, []);

  const handleQuickAction = useCallback(() => {
    if (!quickActionMode || leavingFloorId !== null) return;

    // Read live state to avoid stale-closure issues during rapid clicking.
    // The 1-second game clock can lag real time by up to 999ms, causing floors
    // that are actually ready to be missed. Date.now() + fresh store data fix both.
    const liveNow = Date.now();
    const { floors: liveFloors, workers: liveWorkers, balance: liveBalance,
      coinBonusPercent: liveCoinBonus, openedFloorTypes: liveOpenedTypes,
      businessUpgrades: liveUpgrades, floorStars: liveFloorStars } = useGameStore.getState();

    const liveFilteredFloors = getFloorsForMode(quickActionMode, liveFloors, liveWorkers, liveNow, liveFloorStars ?? {});
    const liveBottomFloor = liveFilteredFloors.length > 0
      ? liveFilteredFloors[liveFilteredFloors.length - 1]
      : null;

    if (!liveBottomFloor) return;

    if (quickActionMode === 'hire') {
      setHotelOpen(true);
      return;
    }

    // Build the action closure from live state now; execute it after the slide-out animation.
    let pendingAction: (() => void) | null = null;

    if (quickActionMode === 'collect') {
      const collectStars = liveFloorStars?.[String(liveBottomFloor.id)] ?? 0;
      const collectStarMult = FLOOR_STAR_MULTIPLIERS[collectStars] ?? FLOOR_STAR_MULTIPLIERS[0];
      const slots: [number, number][] = [];
      liveBottomFloor.productions.forEach((prod, slotIdx) => {
        if (!prod.typeId) return;
        const tc = gameConfig.productionTypes[prod.typeId];
        if (!tc) return;
        if (!getWorkerForSlot(liveWorkers, liveBottomFloor.id, slotIdx)) return;
        if (getProductionStatus(prod, tc, liveNow, liveBalance, tc.sellDuration * collectStarMult.time).effectiveStage === 'READY_TO_COLLECT') {
          slots.push([liveBottomFloor.id, slotIdx]);
        }
      });
      if (slots.length > 0) pendingAction = () => slots.forEach(([fId, sIdx]) => storeCollect(fId, sIdx));
    }

    if (quickActionMode === 'list') {
      const slots: [number, number][] = [];
      liveBottomFloor.productions.forEach((prod, slotIdx) => {
        if (!prod.typeId) return;
        const tc = gameConfig.productionTypes[prod.typeId];
        if (!tc) return;
        if (getProductionStatus(prod, tc, liveNow, liveBalance).effectiveStage === 'READY_TO_LIST') {
          slots.push([liveBottomFloor.id, slotIdx]);
        }
      });
      if (slots.length > 0) pendingAction = () => slots.forEach(([fId, sIdx]) => storeList(fId, sIdx));
    }

    if (quickActionMode === 'buy') {
      const liveBuyInfo = getFloorActionInfo(
        'buy', liveBottomFloor, liveNow, liveWorkers,
        liveCoinBonus, liveOpenedTypes ?? {}, liveUpgrades ?? {}, liveFloorStars ?? {},
      );
      if (!liveBuyInfo || liveBuyInfo.mode !== 'buy') return;
      if (liveBalance < liveBuyInfo.buyCost) {
        showInsufficientResources({ currency: 'coins', need: liveBuyInfo.buyCost, have: liveBalance });
        return;
      }
      const { slotIdx, typeId, buyCost: _cost } = liveBuyInfo;
      pendingAction = () => storeBuy(liveBottomFloor.id, slotIdx, typeId);
    }

    if (pendingAction) {
      pendingActionRef.current = pendingAction;
      setLeavingFloorId(liveBottomFloor.id);
    }
  }, [quickActionMode, leavingFloorId, storeCollect, storeList, storeBuy, showInsufficientResources]);

  const renderItem = useCallback(({ item }: { item: FloorItem }) => {
    if (item.type === 'collapseDivider') {
      return (
        <TowerCollapseDiv
          hiddenCount={item.hiddenCount}
          collapsed={towerCollapsed}
          onToggle={() => setTowerCollapsed((c) => !c)}
        />
      );
    }
    if (item.type === 'underConstruction') {
      const { uc } = item;
      const selType = uc.selectedFloorType ?? null;
      return (
        <View style={styles.floorWrapper}>
          <UnderConstructionBanner
            floorId={uc.floorId}
            endsAt={uc.startedAt + uc.durationMs}
            requiredTools={uc.requiredTools}
            selectedFloorType={selType}
            onOpenPicker={() => setPickerOpenFor(uc.floorId)}
            onStartBusiness={() => {
              if (selType) openFloor(uc.floorId, selType);
            }}
          />
        </View>
      );
    }
    if (item.type === 'buyFloor' && nextFloorUnlock && (!isOnboarding || onboardingStep === 'buy_floor')) {
      return (
        <View
          style={styles.floorWrapper}
          ref={(node) => {
            if (onboardingStep === 'buy_floor') {
              (buyFloorRef as React.MutableRefObject<View | null>).current = node;
            }
          }}
          collapsable={false}
        >
          <BuyFloorBanner
            nextFloorNumber={nextFloorId}
            price={nextFloorUnlock.price}
            currency={nextFloorUnlock.currency}
            onPress={() => {
              const liveStep = useOnboardingStore.getState().step;
              if (liveStep !== 'buy_floor') {
                const currentAmount = nextFloorUnlock.currency === 'gems' ? gems : balance;
                if (currentAmount < nextFloorUnlock.price) {
                  showInsufficientResources({
                    currency: nextFloorUnlock.currency,
                    need: nextFloorUnlock.price,
                    have: currentAmount,
                  });
                  return;
                }
              }
              buyFloor(nextFloorId);
              if (liveStep === 'buy_floor') {
                useOnboardingStore.getState().advance();
                setPickerOpenFor(nextFloorId);
              }
            }}
          />
        </View>
      );
    }
    if (item.type === 'hotel') {
      return (
        <View style={styles.floorWrapper}>
          <HotelFloor hotelOccupied={hotelOccupied} hotelTotal={hotelTotal} hasBetterWorker={hasBetterWorker} onPress={() => setHotelOpen(true)} />
        </View>
      );
    }
    if (item.type === 'lobby') {
      const showForElevator = onboardingStep === 'open_elevator_1';
      const showForDelivery = onboardingStep === 'deliver_visitor';
      if (isOnboarding && !showForElevator && !showForDelivery) return null;
      return (
        <View
          style={styles.floorWrapper}
          ref={(showForElevator || showForDelivery) ? lobbyCardRef : undefined}
          collapsable={false}
        >
          <LobbyFloor
            visitorCount={lobbyVisitors.length}
            lobbyCapacity={lobbyCapacity}
            nextVisitorAt={nextVisitorAt}
            onPress={() => {
              if (isOnboarding) {
                const step = useOnboardingStore.getState().step;
                const gs = useGameStore.getState();
                const firstVisitor = gs.lobbyVisitors[0];
                if (step === 'open_elevator_1' || step === 'deliver_visitor') {
                  if (firstVisitor?.targetFloor == null) gs.spawnOnboardingVisitor('guest', 1);
                } else if (gs.lobbyVisitors.length === 0) {
                  gs.spawnVisitor();
                }
              }
              setLobbyOpen(true);
              useOnboardingStore.getState().notifyElevatorOpened();
            }}
          />
          {isTemporary && !isOnboarding && (
            <Pressable
              onPress={() => router.navigate('/(tabs)/profile')}
              style={({ pressed }) => [styles.registerBanner, pressed && { opacity: 0.82 }]}
            >
              <Text style={styles.registerBannerText}>{t('game.registerBanner')}</Text>
            </Pressable>
          )}
        </View>
      );
    }
    if (item.type === 'production') {
      return (
        <View style={styles.floorWrapper}>
          <FloorCard floorId={item.id} balance={balance} onHireSlot={() => setHotelOpen(true)} />
        </View>
      );
    }
    if (item.type === 'bottomAnchor') {
      return <View style={styles.bottomAnchor} />;
    }
    return null;
  }, [balance, hotelOccupied, hotelTotal, hasBetterWorker, lobbyVisitors.length, nextVisitorAt,
      buyFloor, openFloor, nextFloorId, nextFloorUnlock, gems,
      showInsufficientResources, towerCollapsed, isTemporary, isOnboarding, onboardingStep]);

  const renderQaItem = useCallback(({ item }: { item: FloorItem }) => {
    if (item.type === 'production') {
      return (
        <QaAnimatedFloor isLeaving={item.id === leavingFloorId} onAnimationDone={executeQaAction}>
          <View style={styles.floorWrapper}>
            <FloorCard floorId={item.id} balance={balance} onHireSlot={() => setHotelOpen(true)} />
          </View>
        </QaAnimatedFloor>
      );
    }
    return renderItem({ item });
  }, [leavingFloorId, balance, executeQaAction, renderItem]);

  return (
    <View style={styles.container}>
      <ImageBackground
        source={bgSource}
        style={styles.background}
        resizeMode="cover"
      >
        <View style={styles.gameArea}>
          <View style={styles.sideLeft} />
          <Animated.View style={[styles.towerColumn, towerStyle]}>
            {towerCollapsed && floors.length >= 10 ? (
              <ScrollView
                ref={collapsedScrollRef}
                style={styles.collapsedScroll}
                contentContainerStyle={styles.collapsedContainer}
                alwaysBounceVertical
                showsVerticalScrollIndicator={false}
              >
                {floorList
                  .filter((item) => item.type !== 'bottomAnchor')
                  .map((item) => (
                    <View
                      key={keyExtractor(item)}
                      onLayout={item.type === 'hotel' ? (e: LayoutChangeEvent) => { hotelCardYRef.current = e.nativeEvent.layout.y; } : undefined}
                    >
                      {renderItem({ item })}
                    </View>
                  ))}
              </ScrollView>
            ) : (
              <FlashList
                ref={listRef as any}
                data={floorList}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                estimatedItemSize={216}
                getItemType={(item) => item.type}
                drawDistance={1500}
                extraData={listExtraData}
                contentContainerStyle={[
                  styles.listContent,
                  // Extra space so content exceeds viewport and onboarding targets are reachable.
                  (onboardingStep === 'collect_slot_1' || onboardingStep === 'collect_slot_2')
                    && { paddingBottom: 280 },
                  (['open_elevator_1', 'deliver_visitor'].includes(onboardingStep ?? ''))
                    && { paddingBottom: 160 },
                  onboardingStep === 'assign_worker' && { paddingBottom: 280 },
                ]}
                showsVerticalScrollIndicator={false}
                scrollEnabled={!isOnboarding || onboardingStep === 'assign_worker' || onboardingStep === 'buy_floor'}
                onContentSizeChange={(_w, h) => {
                  if (!hasRevealedRef.current && h > 0 && viewHeightRef.current > 0) {
                    hasRevealedRef.current = true;
                    requestAnimationFrame(() => {
                      const onbStep = useOnboardingStore.getState().step;
                      if (onbStep === 'collect_slot_1') {
                        // Scroll floor2 toward top; paddingBottom makes this possible.
                        const idx = floorListRef.current.findIndex(
                          (item) => item.type === 'production' && item.id === 2,
                        );
                        if (idx >= 0) {
                          listRef.current?.scrollToIndex({ index: idx, animated: false, viewPosition: 0 });
                        }
                      } else if (onbStep !== 'collect_slot_2') {
                        scrollToBottom();
                      }
                      // collect_slot_2 offset handled by the step-transition useEffect above.
                      towerOpacity.value = withTiming(1, {
                        duration: 350,
                        easing: ReanimatedEasing.out(ReanimatedEasing.quad),
                      });
                    });
                  }
                }}
                onLayout={(e) => { viewHeightRef.current = e.nativeEvent.layout.height; }}
              />
            )}

            {/* QA overlay — always mounted so floors are pre-rendered in the background.
                Fades in/out over the tower; the list is kept scrolled to bottom at all times. */}
            <Animated.View
              style={[styles.qaOverlay, qaOverlayStyle]}
              pointerEvents={quickActionMode !== null ? 'box-none' : 'none'}
            >
              <ImageBackground
                source={bgSource}
                style={{ flex: 1 }}
                resizeMode="cover"
              >
                <FlashList
                  ref={qaListRef as any}
                  data={qaItems}
                  renderItem={renderQaItem}
                  keyExtractor={keyExtractor}
                  estimatedItemSize={216}
                  getItemType={(item) => item.type}
                  contentContainerStyle={styles.listContentQA}
                  showsVerticalScrollIndicator={false}
                  extraData={leavingFloorId}
                />
              </ImageBackground>
            </Animated.View>
          </Animated.View>
          <View style={styles.sideRight} />
        </View>

        <TopBar
          name={playerName}
          level={playerLevel}
          xp={playerXp}
          xpForNextLevel={xpForLevel(playerLevel)}
          coins={formatNum(balance)}
          gems={formatNum(gems)}
          revenuePerMin={revenuePerMin}
        />

        {!isOnboarding && <QuickActionFAB
          availableMode={availableMode}
          activeMode={quickActionMode}
          count={availableFloorCount}
          onPress={handleFABPress}
        />}
        {!isOnboarding && quickActionMode === null && !qaBarVisible && (() => {
          const qaSlot = availableMode !== null ? 1 : 0;
          const hasDaily = unclaimedDailyTasksCount > 0;
          const hasMail  = unreadMailCount > 0;
          return (
            <>
              <DailyTasksFAB unclaimedCount={unclaimedDailyTasksCount} slot={qaSlot} />
              <NotificationFAB
                icon={MAIL_FAB_ICON}
                count={unreadMailCount}
                slot={qaSlot + (hasDaily ? 1 : 0)}
                badgeColor="#3FA535"
                onPress={() => router.push('/my-mail')}
              />
              <NotificationFAB
                icon={FRIEND_FAB_ICON}
                count={incomingFriendCount}
                slot={qaSlot + (hasDaily ? 1 : 0) + (hasMail ? 1 : 0)}
                badgeColor="#3376E5"
                onPress={() => router.push('/(tabs)/profile')}
              />
            </>
          );
        })()}

        {(quickActionMode !== null || qaBarVisible) && (
          <QuickActionBar
            mode={quickActionMode ?? 'collect'}
            info={bottomFloorInfo}
            visible={qaBarVisible}
            onHidden={handleQaHidden}
            onPress={handleQuickAction}
            onExit={handleQaExit}
            onBulkAll={handleBulkAll}
          />
        )}
      </ImageBackground>

      {__DEV__ && (() => {
        const curIdx = onboardingStep ? SEQUENCE.indexOf(onboardingStep) : -1;
        const hasPrev = curIdx > 0;
        const hasNext = curIdx >= 0 && curIdx < SEQUENCE.length - 1;
        const btnBase: object = { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, alignItems: 'center', justifyContent: 'center' };
        return (
          <View style={{ position: 'absolute', top: 55, right: 6, zIndex: 9999, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 10, padding: 4 }}>
            <Pressable
              onPress={() => hasPrev && useOnboardingStore.getState().goToStep(SEQUENCE[curIdx - 1])}
              style={[btnBase, { backgroundColor: hasPrev ? '#555' : '#333', opacity: hasPrev ? 1 : 0.4 }]}
            >
              <Text style={{ color: '#fff', fontSize: 14 }}>{'←'}</Text>
            </Pressable>
            <Pressable
              onPress={() => useOnboardingStore.getState().goToStep(SEQUENCE[0])}
              style={[btnBase, { backgroundColor: '#c0392b' }]}
            >
              <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>{onboardingStep ?? 'off'}</Text>
            </Pressable>
            <Pressable
              onPress={() => hasNext && useOnboardingStore.getState().goToStep(SEQUENCE[curIdx + 1])}
              style={[btnBase, { backgroundColor: hasNext ? '#555' : '#333', opacity: hasNext ? 1 : 0.4 }]}
            >
              <Text style={{ color: '#fff', fontSize: 14 }}>{'→'}</Text>
            </Pressable>
          </View>
        );
      })()}

      <HotelPanel visible={hotelOpen} onClose={() => setHotelOpen(false)} />
      <LobbyPanel
        visible={lobbyOpen}
        onClose={() => setLobbyOpen(false)}
        onOpenHotel={() => { setLobbyOpen(false); setHotelOpen(true); }}
      />
      {underConstruction.map((uc) => (
        <BusinessTypePickerSheet
          key={uc.floorId}
          visible={pickerOpenFor === uc.floorId}
          underConstruction={uc}
          onClose={() => setPickerOpenFor(null)}
          onSelectType={(floorType) => {
            selectFloorType(uc.floorId, floorType);
            setPickerOpenFor(null);
          }}
          exhaustedTypes={exhaustedByFloor.get(uc.floorId)}
          builtFloorCounts={builtFloorCounts}
          hotelWorkerCounts={hotelWorkerCounts}
        />
      ))}
    </View>
  );
}

function Chevron({ collapsed }: { collapsed: boolean }) {
  return (
    <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
      <Path
        d={collapsed ? 'M6 9l6 6 6-6' : 'M18 15l-6-6-6 6'}
        stroke="#7A8EAA"
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function TowerCollapseDiv({
  hiddenCount,
  collapsed,
  onToggle,
}: {
  hiddenCount: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={divStyles.container}>
      <View style={divStyles.line} />
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [divStyles.pill, pressed && divStyles.pillPressed]}
        hitSlop={10}
      >
        <Chevron collapsed={collapsed} />
        <Text style={divStyles.label}>
          {collapsed ? `show all ${hiddenCount}` : 'show less'}
        </Text>
        <Chevron collapsed={collapsed} />
      </Pressable>
      <View style={divStyles.line} />
    </View>
  );
}

const divStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -7,
    marginBottom: 6,
    paddingHorizontal: 6,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(80,110,160,0.15)',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(80,110,160,0.09)',
    marginHorizontal: 8,
  },
  pillPressed: {
    backgroundColor: 'rgba(80,110,160,0.18)',
  },
  label: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 12,
    color: '#7A8EAA',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
    backgroundColor: '#DCEFF6',
  },
  gameArea: {
    flex: 1,
    flexDirection: 'row',
  },
  sideLeft: {
    width: 0,
  },
  towerColumn: {
    flex: 1,
  },
  sideRight: {
    width: 0,
  },
  listContent: {
    paddingTop: 150,
    paddingHorizontal: 14,
  },
  bottomAnchor: {
    height: 85,
  },
  listContentQA: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingBottom: 140,
    paddingHorizontal: 14,
  },
  collapsedScroll: {
    flex: 1,
  },
  collapsedContainer: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingTop: 150,
    paddingHorizontal: 14,
    paddingBottom: 90,
  },
  qaOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  floorWrapper: {
    marginBottom: 13,
  },
  registerBanner: {
    marginTop: 8,
    marginHorizontal: 4,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 16,
    backgroundColor: '#3FA535',
    alignItems: 'center',
  },
  registerBannerText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
    color: '#fff',
  },
});
