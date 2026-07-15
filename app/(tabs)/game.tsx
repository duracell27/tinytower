import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ImageBackground } from 'react-native';
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
  | { type: 'underConstruction'; floorId: number; uc: UnderConstructionState };


function formatCoins(n: number): string {
  if (n >= 1000) {
    const str = String(n);
    const parts: string[] = [];
    for (let i = str.length; i > 0; i -= 3) {
      parts.unshift(str.slice(Math.max(0, i - 3), i));
    }
    return parts.join(' ');
  }
  return String(n);
}

function keyExtractor(item: FloorItem): string {
  if (item.type === 'production') return `prod-${item.id}`;
  if (item.type === 'underConstruction') return `uc-${item.floorId}`;
  return item.type;
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
  const initial = playerName.charAt(0).toUpperCase();

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

  const floorList: FloorItem[] = React.useMemo(() => {
    const items: FloorItem[] = [];
    if (nextFloorUnlock && lastSyncAt > 0) {
      items.push({ type: 'buyFloor' });
    }

    // Merge all floors (production + UC) sorted by ID descending so they appear
    // in the correct tower order (highest floor at top, between buyFloor and hotel).
    const ucById = new Map(underConstruction.map((uc) => [uc.floorId, uc]));
    const allIds = new Set([
      ...floors.map((f) => f.id),
      ...underConstruction.map((uc) => uc.floorId),
    ]);
    for (const id of [...allIds].sort((a, b) => b - a)) {
      const uc = ucById.get(id);
      if (uc) {
        items.push({ type: 'underConstruction', floorId: id, uc });
      } else {
        items.push({ type: 'production', id });
      }
    }

    items.push({ type: 'hotel' });
    items.push({ type: 'lobby' });
    return items;
  }, [underConstruction, floors, nextFloorUnlock, lastSyncAt]);

  const [hotelOpen, setHotelOpen] = useState(false);
  const [lobbyOpen, setLobbyOpen] = useState(false);
  const listRef = useRef<FlashList<FloorItem>>(null);
  const savedScrollOffsetRef = useRef(Number.MAX_SAFE_INTEGER);
  const qaEnteredRef = useRef(false);
  const quickActionModeRef = useRef<QuickActionMode | null>(null);
  const contentHeightRef = useRef(0);
  const viewHeightRef = useRef(0);

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
    () => ({ now, quickActionMode, nextFloorUnlock }),
    [now, quickActionMode, nextFloorUnlock],
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

  useEffect(() => {
    if (quickActionMode !== null) {
      qaEnteredRef.current = true;
      const id = setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 0);
      return () => clearTimeout(id);
    } else if (qaEnteredRef.current) {
      const target = savedScrollOffsetRef.current;
      const id = setTimeout(() => listRef.current?.scrollToOffset({ offset: target, animated: false }), 0);
      return () => clearTimeout(id);
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
      setQuickActionMode(null);
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
    if (item.type === 'underConstruction') {
      const { uc } = item;
      const selType = uc.selectedFloorType ?? null;
      return (
        <View style={styles.floorWrapper}>
          <UnderConstructionBanner
            floorId={uc.floorId}
            endsAt={uc.startedAt + uc.durationMs}
            now={now}
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
            now={now}
            onPress={() => setLobbyOpen(true)}
          />
        </View>
      );
    }
    if (item.type === 'production') {
      return (
        <View style={styles.floorWrapper}>
          <FloorCard floorId={item.id} balance={balance} now={now} onHireSlot={() => setHotelOpen(true)} />
        </View>
      );
    }
    return null;
  }, [balance, now, hotelOccupied, hotelTotal, lobbyVisitors.length, nextVisitorAt,
      buyFloor, openFloor, nextFloorId, nextFloorUnlock, gems,
      showInsufficientResources]);

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
          <View style={styles.towerColumn}>
            <FlashList
              ref={listRef}
              data={quickActionMode !== null ? qaItems : floorList}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              estimatedItemSize={150}
              extraData={listExtraData}
              contentContainerStyle={quickActionMode !== null ? styles.listContentQA : styles.listContent}
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={100}
              onContentSizeChange={(_w, h) => { contentHeightRef.current = h; }}
              onLayout={(e) => { viewHeightRef.current = e.nativeEvent.layout.height; }}
              onScroll={(e) => {
                if (quickActionModeRef.current === null) {
                  savedScrollOffsetRef.current = e.nativeEvent.contentOffset.y;
                }
              }}
            />
          </View>
          <View style={styles.sideRight} />
        </View>

        <TopBar
          name={playerName}
          level={playerLevel}
          xp={playerXp}
          xpForNextLevel={xpForLevel(playerLevel)}
          initial={initial}
          coins={formatCoins(balance)}
          gems={String(gems)}
          revenuePerMin={revenuePerMin}
          onDevAddGems={() => devAddGems(100)}
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
      {!hotelOpen && !lobbyOpen && <InsufficientResourcesModal />}
    </View>
  );
}

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
    paddingBottom: 85,
    paddingHorizontal: 14,
  },
  listContentQA: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingBottom: 140,
    paddingHorizontal: 14,
  },
  floorWrapper: {
    marginBottom: 13,
  },
});
