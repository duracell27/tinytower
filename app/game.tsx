import React, { useCallback, useEffect } from 'react';
import { View, StyleSheet, ImageBackground } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import TopBar from '../src/components/TopBar';
import BottomNav from '../src/components/BottomNav';
import FloorCard from '../src/components/FloorCard';
import { HotelFloor, LobbyFloor } from '../src/components/TechnicalFloor';
import { useGameStore, useBalance } from '../src/stores/gameStore';
import { useGameClock } from '../src/hooks/useGameClock';
import { gameConfig } from '../shared/config/gameConfig';
import { syncService } from '../src/services/sync';

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
  const hotelOccupied = useGameStore((s) => s.hotelOccupied);
  const hotelTotal = useGameStore((s) => s.hotelTotal);
  const visitors = useGameStore((s) => s.visitors);
  const liftVisitor = useGameStore((s) => s.liftVisitor);

  useEffect(() => {
    syncService.start();
    return () => syncService.stop();
  }, []);

  const renderItem = useCallback(({ item }: { item: FloorItem }) => {
    if (item.type === 'hotel') {
      return (
        <View style={styles.floorWrapper}>
          <HotelFloor hotelOccupied={hotelOccupied} hotelTotal={hotelTotal} />
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
            data={FLOOR_LIST}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            estimatedItemSize={150}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        </View>

        <TopBar
          name="Duracell"
          level={7}
          xp="640/1000"
          initial="D"
          coins={formatCoins(balance)}
          gems="143"
        />

        <BottomNav />
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
