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
import { syncService } from '../../src/services/sync';
import { xpForLevel } from '../../shared/engine/xp';
import { calcRevenuePerMin } from '../../shared/engine/ratingUtils';
import type { UnderConstructionState } from '../../shared/types';

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
  const balance = useBalance();
  const now = useGameClock(1000);
  const playerLevel = useGameStore((s) => s.playerLevel);
  const playerXp = useGameStore((s) => s.playerXp);
  const gems = useGameStore((s) => s.gems);
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

  const revenuePerMin = React.useMemo(
    () => calcRevenuePerMin(floors, workers, openedFloorTypes ?? {}, gameConfig),
    [floors, workers, openedFloorTypes],
  );

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
              data={floorList}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              estimatedItemSize={150}
              extraData={now}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              initialScrollIndex={floorList.length - 1}
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
        />
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
  floorWrapper: {
    marginBottom: 13,
  },
});
