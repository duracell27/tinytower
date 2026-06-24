import React, { useMemo } from 'react';
import { View, StyleSheet, ImageBackground } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import TopBar from '../src/components/TopBar';
import BottomNav from '../src/components/BottomNav';
import FloorCard from '../src/components/FloorCard';
import { useGameStore, useBalance } from '../src/stores/gameStore';
import { useGameClock } from '../src/hooks/useGameClock';
import { gameConfig } from '../src/config/gameConfig';

// Floor IDs in reverse order (highest floor at top)
const FLOOR_IDS = gameConfig.floors.map((f) => f.id).reverse();

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

export default function GameScreen() {
  const balance = useBalance();
  const now = useGameClock(1000);

  const renderItem = useMemo(() => {
    return ({ item }: { item: number }) => (
      <View style={styles.floorWrapper}>
        <FloorCard floorId={item} balance={balance} now={now} />
      </View>
    );
  }, [balance, now]);

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('../assets/welcome-bg.png')}
        style={styles.background}
        resizeMode="cover"
      >
        {/* Floor list */}
        <View style={styles.listContainer}>
          <FlashList
            data={FLOOR_IDS}
            renderItem={renderItem}
            keyExtractor={(item) => String(item)}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        </View>

        {/* Top bar overlay */}
        <TopBar
          name="Duracell"
          level={7}
          xp="640/1000"
          initial="D"
          coins={formatCoins(balance)}
          gems="143"
        />

        {/* Bottom nav overlay */}
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
