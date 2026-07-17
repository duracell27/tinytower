import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ImageBackground } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { formatNum } from '../../src/utils/format';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing as ReanimatedEasing,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useTranslation } from 'react-i18next';
import { FlashList } from '@shopify/flash-list';
import TopBar from '../../src/components/TopBar';
import FloorCard from '../../src/components/FloorCard';
import BuyFloorBanner from '../../src/components/BuyFloorBanner';
import UnderConstructionBanner from '../../src/components/UnderConstructionBanner';
import BusinessTypePickerSheet from '../../src/components/BusinessTypePickerSheet';
import { HotelFloor, LobbyFloor } from '../../src/components/TechnicalFloor';
import HotelPanel from '../../src/components/HotelPanel';
import LobbyPanel from '../../src/components/LobbyPanel';
import LevelUpModal from '../../src/components/LevelUpModal';
import AchievementModal from '../../src/components/AchievementModal';
import ReferralNotificationModal from '../../src/components/ReferralNotificationModal';
import InsufficientResourcesModal from '../../src/components/InsufficientResourcesModal';
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
import {
  getAvailableMode,
  getFloorsForMode,
  getFloorActionInfo,
  type QuickActionMode,
} from '../../src/utils/quickAction';
import { getProductionStatus } from '../../shared/engine/productionStatus';

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

export default function GameScreen() {
  const { t } = useTranslation('tabs');
  const { t: tContent } = useTranslation('gameContent');
  const balance = useBalance();
  const now = useGameClock(1000);
  const playerLevel = useGameStore((s) => s.playerLevel);
  const playerXp = useGameStore((s) => s.playerXp);
  const gems = useGameStore((s) => s.gems);
  const devAddGems = useGameStore((s) => s.devAddGems);
  const storeCollect = useGameStore((s) => s.collect);
  const storeList = useGameStore((s) => s.list);
  const storeBuy = useGameStore((s) => s.buy);
  const collectAll = useGameStore((s) => s.collectAll);
  const listAll = useGameStore((s) => s.listAll);
  const buyAll = useGameStore((s) => s.buyAll);
  const lastSyncAt = useGameStore((s) => s.lastSyncAt);
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
  const openedFloorTypes = useGameStore((s) => s.openedFloorTypes);
  const coinBonusPercent = useGameStore((s) => s.coinBonusPercent);

  const revenuePerMin = React.useMemo(
    () => calcRevenuePerMin(floors, workers, openedFloorTypes ?? {}, gameConfig, now),
    [floors, workers, openedFloorTypes, now],
  );

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
    if (nextFloorUnlock && lastSyncAt > 0) {
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
  }, [underConstruction, floors, nextFloorUnlock, lastSyncAt, towerCollapsed]);

  const [hotelOpen, setHotelOpen] = useState(false);
  const [lobbyOpen, setLobbyOpen] = useState(false);
  const listRef = useRef<FlashList<FloorItem>>(null);
  const savedScrollOffsetRef = useRef(Number.MAX_SAFE_INTEGER);
  const qaEnteredRef = useRef(false);
  const quickActionModeRef = useRef<QuickActionMode | null>(null);
  const contentHeightRef = useRef(0);
  const viewHeightRef = useRef(0);
  const hasRevealedRef = useRef(false);
  const pendingRestoreRef = useRef<number | null>(null);
  const floorListRef = useRef(floorList);
  floorListRef.current = floorList;
  const towerOpacity = useSharedValue(0);
  const towerStyle = useAnimatedStyle(() => ({ opacity: towerOpacity.value }));

  const scrollToBottom = useCallback(() => {
    listRef.current?.scrollToIndex({
      index: floorListRef.current.length - 1, // bottomAnchor
      animated: false,
      viewPosition: 1, // anchor's bottom edge = viewport bottom
    });
  }, []);

  const [quickActionMode, setQuickActionMode] = useState<QuickActionMode | null>(null);
  const [qaBarVisible, setQaBarVisible] = useState(false);
  quickActionModeRef.current = quickActionMode;

  // Highest-priority mode currently available — only computed when not already in a mode
  const availableMode = React.useMemo(
    () => (quickActionMode !== null ? null : getAvailableMode(floors, workers, now)),
    [quickActionMode, floors, workers, now],
  );

  // Count of floors for the FAB badge (only when not yet in a mode)
  const availableFloorCount = React.useMemo(
    () => (availableMode !== null ? getFloorsForMode(availableMode, floors, workers, now).length : 0),
    [availableMode, floors, workers, now],
  );

  // Floors matching the active mode, sorted highest ID first
  const filteredFloors = React.useMemo(
    () => (quickActionMode !== null ? getFloorsForMode(quickActionMode, floors, workers, now) : []),
    [quickActionMode, floors, workers, now],
  );

  const qaItems = React.useMemo(
    () => filteredFloors.map((f) => ({ type: 'production' as const, id: f.id })),
    [filteredFloors],
  );

  const listExtraData = React.useMemo(
    () => ({ quickActionMode, nextFloorUnlock, towerCollapsed }),
    [quickActionMode, nextFloorUnlock, towerCollapsed],
  );

  // The bottom-most floor (last in sorted-descending list = lowest ID = nearest the bar)
  const bottomFloor = filteredFloors.length > 0 ? filteredFloors[filteredFloors.length - 1] : null;

  // Action info for the bottom floor — drives the QuickActionBar label
  const bottomFloorInfo = React.useMemo(
    () =>
      bottomFloor !== null && quickActionMode !== null
        ? getFloorActionInfo(quickActionMode, bottomFloor, now, workers, coinBonusPercent, openedFloorTypes ?? {})
        : null,
    [bottomFloor, quickActionMode, now, workers, coinBonusPercent, openedFloorTypes],
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
    if (towerCollapsed && floors.length >= 10 && !hasRevealedRef.current) {
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
      // Restore scroll immediately so floorList appears at the right position
      // while the bar animates out. Clear qaEnteredRef so the quickActionMode
      // effect doesn't overwrite pendingRestoreRef 280ms later.
      pendingRestoreRef.current = savedScrollOffsetRef.current;
      qaEnteredRef.current = false;
      setQaBarVisible(false);
    }
  }, [quickActionMode, filteredFloors.length]);

  // Show bar when QA mode activates
  useEffect(() => {
    if (quickActionMode !== null) {
      setQaBarVisible(true);
    }
  }, [quickActionMode]);

  useEffect(() => {
    if (quickActionMode !== null) {
      qaEnteredRef.current = true;
      const id = setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 0);
      return () => clearTimeout(id);
    } else if (qaEnteredRef.current) {
      pendingRestoreRef.current = savedScrollOffsetRef.current;
    }
  }, [quickActionMode]);

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
    setQaBarVisible(false);
  }, []);

  const handleQaHidden = useCallback(() => {
    setQuickActionMode(null);
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
    if (!quickActionMode || !bottomFloor) return;

    if (quickActionMode === 'collect') {
      bottomFloor.productions.forEach((prod, slotIdx) => {
        if (!prod.typeId) return;
        const tc = gameConfig.productionTypes[prod.typeId];
        if (!tc) return;
        if (getProductionStatus(prod, tc, now, balance).effectiveStage === 'READY_TO_COLLECT') {
          storeCollect(bottomFloor.id, slotIdx);
        }
      });
      return;
    }

    if (quickActionMode === 'list') {
      bottomFloor.productions.forEach((prod, slotIdx) => {
        if (!prod.typeId) return;
        const tc = gameConfig.productionTypes[prod.typeId];
        if (!tc) return;
        if (getProductionStatus(prod, tc, now, balance).effectiveStage === 'READY_TO_LIST') {
          storeList(bottomFloor.id, slotIdx);
        }
      });
      return;
    }

    if (quickActionMode === 'buy') {
      if (!bottomFloorInfo || bottomFloorInfo.mode !== 'buy') return;
      if (balance < bottomFloorInfo.buyCost) {
        showInsufficientResources({ currency: 'coins', need: bottomFloorInfo.buyCost, have: balance });
        return;
      }
      storeBuy(bottomFloor.id, bottomFloorInfo.slotIdx, bottomFloorInfo.typeId);
      return;
    }

    if (quickActionMode === 'hire') {
      setHotelOpen(true);
    }
  }, [
    quickActionMode, bottomFloor, bottomFloorInfo, now, balance,
    storeCollect, storeList, storeBuy, showInsufficientResources,
  ]);

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
          <HotelFloor hotelOccupied={hotelOccupied} hotelTotal={hotelTotal} onPress={() => setHotelOpen(true)} />
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
  }, [balance, hotelOccupied, hotelTotal, lobbyVisitors.length, nextVisitorAt,
      buyFloor, openFloor, nextFloorId, nextFloorUnlock, gems,
      showInsufficientResources, towerCollapsed]);

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('../../assets/welcome-bg.png')}
        style={styles.background}
        resizeMode="cover"
      >
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
        <View style={styles.gameArea}>
          <View style={styles.sideLeft} />
          <Animated.View style={[styles.towerColumn, towerStyle]}>
            {towerCollapsed && floors.length >= 10 && quickActionMode === null ? (
              <View style={styles.collapsedContainer}>
                {floorList
                  .filter((item) => item.type !== 'bottomAnchor')
                  .map((item) => (
                    <View key={keyExtractor(item)}>{renderItem({ item })}</View>
                  ))}
              </View>
            ) : (
              <FlashList
                ref={listRef}
                data={quickActionMode !== null && qaItems.length > 0 ? qaItems : floorList}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                estimatedItemSize={216}
                getItemType={(item) => item.type}
                drawDistance={1500}
                extraData={listExtraData}
                contentContainerStyle={
                  quickActionMode !== null && qaItems.length > 0
                    ? styles.listContentQA
                    : styles.listContent
                }
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={100}
                onContentSizeChange={(_w, h) => {
                  contentHeightRef.current = h;
                  if (!hasRevealedRef.current && h > 0 && viewHeightRef.current > 0) {
                    hasRevealedRef.current = true;
                    requestAnimationFrame(() => {
                      scrollToBottom();
                      towerOpacity.value = withTiming(1, {
                        duration: 350,
                        easing: ReanimatedEasing.out(ReanimatedEasing.quad),
                      });
                    });
                  } else if (pendingRestoreRef.current !== null) {
                    const target = pendingRestoreRef.current;
                    pendingRestoreRef.current = null;
                    requestAnimationFrame(() => {
                      if (target === Number.MAX_SAFE_INTEGER) {
                        scrollToBottom();
                      } else {
                        listRef.current?.scrollToOffset({ offset: target, animated: false });
                      }
                    });
                  }
                }}
                onLayout={(e) => { viewHeightRef.current = e.nativeEvent.layout.height; }}
                onScroll={(e) => {
                  if (quickActionModeRef.current === null) {
                    savedScrollOffsetRef.current = e.nativeEvent.contentOffset.y;
                  }
                }}
              />
            )}
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
        />
      ))}
      <LevelUpModal suppressWhileOpen={lobbyOpen || hotelOpen} />
      <AchievementModal />
      <ReferralNotificationModal />
      {!hotelOpen && !lobbyOpen && <InsufficientResourcesModal />}
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
  collapsedContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 14,
    paddingBottom: 90,
  },
  floorWrapper: {
    marginBottom: 13,
  },
});
