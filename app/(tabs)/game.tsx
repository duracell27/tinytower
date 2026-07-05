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
import InsufficientResourcesModal from '../../src/components/InsufficientResourcesModal';
import { useGameStore, useBalance } from '../../src/stores/gameStore';
import { useAuthStore } from '../../src/stores/authStore';
import { useGameClock } from '../../src/hooks/useGameClock';
import { gameConfig } from '../../shared/config/gameConfig';
import { syncService } from '../../src/services/sync';
import { xpForLevel } from '../../shared/engine/xp';

type FloorItem =
  | { type: 'production'; id: number }
  | { type: 'hotel' }
  | { type: 'lobby' }
  | { type: 'buyFloor' }
  | { type: 'underConstruction' };


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
  return item.type;
}

export default function GameScreen() {
  const { t } = useTranslation('tabs');
  const balance = useBalance();
  const now = useGameClock(1000);
  const playerLevel = useGameStore((s) => s.playerLevel);
  const playerXp = useGameStore((s) => s.playerXp);
  const gems = useGameStore((s) => s.gems);
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
  const openFloor = useGameStore((s) => s.openFloor);
  const [pickerOpen, setPickerOpen] = useState(false);

  const floors = useGameStore((s) => s.floors);

  const { nextFloorId, nextFloorUnlock } = React.useMemo(() => {
    const highestFloorId = Math.max(...floors.map((f) => f.id), ...gameConfig.floors.map((f) => f.id));
    const nfId = highestFloorId + 1;
    return {
      nextFloorId: nfId,
      nextFloorUnlock: gameConfig.floorUnlocks.find((f) => f.floorId === nfId) ?? null,
    };
  }, [floors]);

  const floorList: FloorItem[] = React.useMemo(() => {
    const items: FloorItem[] = [];
    if (underConstruction) {
      items.push({ type: 'underConstruction' });
    } else if (nextFloorUnlock) {
      items.push({ type: 'buyFloor' });
    }
    const sortedFloorIds = [...floors.map((f) => f.id)].sort((a, b) => b - a);
    for (const id of sortedFloorIds) {
      items.push({ type: 'production', id });
    }
    items.push({ type: 'hotel' });
    items.push({ type: 'lobby' });
    return items;
  }, [underConstruction, floors, nextFloorUnlock]);

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
    if (item.type === 'underConstruction' && underConstruction) {
      return (
        <View style={styles.floorWrapper}>
          <UnderConstructionBanner
            floorId={underConstruction.floorId}
            endsAt={underConstruction.startedAt + underConstruction.durationMs}
            now={now}
            onOpenFloor={() => setPickerOpen(true)}
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
      underConstruction, buyFloor, nextFloorId, nextFloorUnlock, gems, showInsufficientResources]);

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
        />
      </ImageBackground>

      <HotelPanel visible={hotelOpen} onClose={() => setHotelOpen(false)} />
      <LobbyPanel
        visible={lobbyOpen}
        onClose={() => setLobbyOpen(false)}
        onOpenHotel={() => { setLobbyOpen(false); setHotelOpen(true); }}
      />
      {underConstruction && (
        <BusinessTypePickerSheet
          visible={pickerOpen}
          underConstruction={underConstruction}
          onClose={() => setPickerOpen(false)}
          onOpen={(floorType) => {
            openFloor(underConstruction.floorId, floorType);
            setPickerOpen(false);
          }}
        />
      )}
      <LevelUpModal suppressWhileOpen={lobbyOpen || hotelOpen} />
      <InsufficientResourcesModal />
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
    paddingHorizontal: 8,
  },
  floorWrapper: {
    marginBottom: 13,
  },
});
