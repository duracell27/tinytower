import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ImageBackground } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import TopBar from '../src/components/TopBar';
import BottomNav from '../src/components/BottomNav';
import FloorCard from '../src/components/FloorCard';
import { HotelFloor, LobbyFloor } from '../src/components/TechnicalFloor';
import HotelPanel from '../src/components/HotelPanel';
import { useGameStore, useBalance } from '../src/stores/gameStore';
import { useAuthStore } from '../src/stores/authStore';
import { useGameClock } from '../src/hooks/useGameClock';
import { gameConfig } from '../shared/config/gameConfig';
import { syncService } from '../src/services/sync';

function xpForLevel(level: number): number {
  return level * 100;
}

type FloorItem =
  | { type: 'production'; id: number }
  | { type: 'hotel' }
  | { type: 'lobby' };

const FLOOR_LIST: FloorItem[] = [
  ...gameConfig.floors.map((f) => ({ type: 'production' as const, id: f.id })).reverse(),
  { type: 'hotel' },
  { type: 'lobby' },
];

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
  const balance = useBalance();
  const now = useGameClock(1000);
  const playerLevel = useGameStore((s) => s.playerLevel);
  const playerXp = useGameStore((s) => s.playerXp);
  const gems = useGameStore((s) => s.gems);
  const hotelOccupied = useGameStore((s) => s.hotelOccupied);
  const hotelTotal = useGameStore((s) => s.hotelTotal);
  const visitors = useGameStore((s) => s.visitors);
  const liftVisitor = useGameStore((s) => s.liftVisitor);
  const player = useAuthStore((s) => s.player);
  const playerName = player?.playerName ?? 'Гравець';
  const initial = playerName.charAt(0).toUpperCase();

  const [hotelOpen, setHotelOpen] = useState(false);
  const listRef = useRef<FlashList<FloorItem>>(null);

  useEffect(() => {
    syncService.start();
    return () => syncService.stop();
  }, []);

  const renderItem = useCallback(({ item }: { item: FloorItem }) => {
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
          <LobbyFloor visitors={visitors} onLift={liftVisitor} />
        </View>
      );
    }
    return (
      <View style={styles.floorWrapper}>
        <FloorCard floorId={item.id} balance={balance} now={now} />
      </View>
    );
  }, [balance, now, hotelOccupied, hotelTotal, visitors, liftVisitor]);

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('../assets/welcome-bg.png')}
        style={styles.background}
        resizeMode="cover"
      >
        <View style={styles.listContainer}>
          <FlashList
            ref={listRef}
            data={FLOOR_LIST}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            estimatedItemSize={150}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            initialScrollIndex={FLOOR_LIST.length - 1}
          />
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

        <BottomNav />

        <HotelPanel visible={hotelOpen} onClose={() => setHotelOpen(false)} />
      </ImageBackground>
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
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingTop: 130,
    paddingBottom: 120,
    paddingHorizontal: 14,
  },
  floorWrapper: {
    marginBottom: 13,
  },
});
