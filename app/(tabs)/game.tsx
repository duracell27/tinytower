import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ImageBackground, ScrollView, LayoutChangeEvent, useColorScheme } from 'react-native';
import { useNavigation } from 'expo-router';
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
import { useGameClock } from '../../src/hooks/useGameClock';
import { gameConfig } from '../../shared/config/gameConfig';
import { getExhaustedFloorTypes } from '../../shared/engine/floorTypeUtils';
import { syncService } from '../../src/services/sync';
import { xpForLevel } from '../../shared/engine/xp';
import { calcRevenuePerMin } from '../../shared/engine/ratingUtils';
import type { UnderConstructionState } from '../../shared/types';
import QuickActionFAB from '../../src/components/QuickActionFAB';
import QuickActionBar from '../../src/components/QuickActionBar';
import DailyTasksFAB from '../../src/components/DailyTasksFAB';
import { DAILY_TASKS, getTaskProgress } from '../../shared/config/dailyTasksConfig';
import {
  getAvailableMode,
  getFloorsForMode,
  getFloorActionInfo,
  type QuickActionMode,
} from '../../src/utils/quickAction';
import { getProductionStatus } from '../../shared/engine/productionStatus';
import { hasAnyBetterCandidate } from '../../src/utils/workerCandidate';

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

const BG_LIGHT = require('../../assets/img/backgroung/bg15.png');
const BG_DARK  = require('../../assets/img/backgroung/bgBlack.png');

export default function GameScreen() {
  const scheme = useColorScheme();
  const bgSource = scheme === 'dark' ? BG_DARK : BG_LIGHT;
  const { t } = useTranslation('tabs');
  const { t: tContent } = useTranslation('gameContent');
  const balance = useBalance();
  const now = useGameClock(1000);
  const playerLevel = useGameStore((s) => s.playerLevel);
  const playerXp = useGameStore((s) => s.playerXp);
  const unclaimedDailyTasksCount = useGameStore((s) =>
    DAILY_TASKS.filter((task) => {
      const progress = getTaskProgress(s, task);
      return progress >= task.threshold && !s.dailyTasks.claimed.includes(task.key);
    }).length,
  );
  const gems = useGameStore((s) => s.gems);
  const devAddGems = useGameStore((s) => s.devAddGems);
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

  const underConstruction = useGameStore((s) => s.underConstruction);
  const buyFloor = useGameStore((s) => s.buyFloor);
  const selectFloorType = useGameStore((s) => s.selectFloorType);
  const openFloor = useGameStore((s) => s.openFloor);
  const [pickerOpenFor, setPickerOpenFor] = useState<number | null>(null);

  const floors = useGameStore((s) => s.floors);
  const workers = useGameStore((s) => s.workers);
  const openedFloorTypes  = useGameStore((s) => s.openedFloorTypes);
  const coinBonusPercent  = useGameStore((s) => s.coinBonusPercent);
  const businessUpgrades  = useGameStore((s) => s.businessUpgrades);
  const floorStars        = useGameStore((s) => s.floorStars);

  const revenuePerMin = React.useMemo(
    () => calcRevenuePerMin(floors, workers, openedFloorTypes ?? {}, gameConfig, now, businessUpgrades, coinBonusPercent, floorStars),
    [floors, workers, openedFloorTypes, now, businessUpgrades, coinBonusPercent, floorStars],
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
    () => (quickActionMode !== null ? null : getAvailableMode(floors, workers, now, floorStars ?? {})),
    [quickActionMode, floors, workers, now, floorStars],
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
    () => ({ nextFloorUnlock, towerCollapsed }),
    [nextFloorUnlock, towerCollapsed],
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
  }, [now, nextVisitorAt, lobbyVisitors.length, lobbyCapacity, spawnVisitor]);

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

  const handleQuickAction = useCallback(() => {
    if (!quickActionMode) return;

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

    if (quickActionMode === 'collect') {
      liveBottomFloor.productions.forEach((prod, slotIdx) => {
        if (!prod.typeId) return;
        const tc = gameConfig.productionTypes[prod.typeId];
        if (!tc) return;
        if (getProductionStatus(prod, tc, liveNow, liveBalance).effectiveStage === 'READY_TO_COLLECT') {
          storeCollect(liveBottomFloor.id, slotIdx);
        }
      });
      return;
    }

    if (quickActionMode === 'list') {
      liveBottomFloor.productions.forEach((prod, slotIdx) => {
        if (!prod.typeId) return;
        const tc = gameConfig.productionTypes[prod.typeId];
        if (!tc) return;
        if (getProductionStatus(prod, tc, liveNow, liveBalance).effectiveStage === 'READY_TO_LIST') {
          storeList(liveBottomFloor.id, slotIdx);
        }
      });
      return;
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
      storeBuy(liveBottomFloor.id, liveBuyInfo.slotIdx, liveBuyInfo.typeId);
      return;
    }

    if (quickActionMode === 'hire') {
      setHotelOpen(true);
    }
  }, [quickActionMode, storeCollect, storeList, storeBuy, showInsufficientResources]);

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
    if (item.type === 'buyFloor' && nextFloorUnlock) {
      return (
        <View style={styles.floorWrapper}>
          <BuyFloorBanner
            nextFloorNumber={nextFloorId}
            price={nextFloorUnlock.price}
            currency={nextFloorUnlock.currency}
            onPress={() => {
              const currentAmount = nextFloorUnlock.currency === 'gems' ? gems : balance;
              if (currentAmount < nextFloorUnlock.price) {
                showInsufficientResources({
                  currency: nextFloorUnlock.currency,
                  need: nextFloorUnlock.price,
                  have: currentAmount,
                });
                return;
              }
              buyFloor(nextFloorId);
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
      return (
        <View style={styles.floorWrapper}>
          <LobbyFloor
            visitorCount={lobbyVisitors.length}
            lobbyCapacity={lobbyCapacity}
            nextVisitorAt={nextVisitorAt}
            onPress={() => setLobbyOpen(true)}
          />
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
      showInsufficientResources, towerCollapsed]);

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
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={(_w, h) => {
                  if (!hasRevealedRef.current && h > 0 && viewHeightRef.current > 0) {
                    hasRevealedRef.current = true;
                    requestAnimationFrame(() => {
                      scrollToBottom();
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
                  renderItem={renderItem}
                  keyExtractor={keyExtractor}
                  estimatedItemSize={216}
                  getItemType={(item) => item.type}
                  contentContainerStyle={styles.listContentQA}
                  showsVerticalScrollIndicator={false}
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
          gems={String(gems)}
          revenuePerMin={revenuePerMin}
          onDevAddGems={__DEV__ ? () => devAddGems(100) : undefined}
        />

        <QuickActionFAB
          availableMode={availableMode}
          activeMode={quickActionMode}
          count={availableFloorCount}
          onPress={handleFABPress}
        />
        {quickActionMode === null && !qaBarVisible && (
          <DailyTasksFAB unclaimedCount={unclaimedDailyTasksCount} hasQuickAction={availableMode !== null} />
        )}

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
});
