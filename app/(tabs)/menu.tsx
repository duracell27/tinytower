import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ImageBackground } from 'react-native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import WarehouseSheet from '../../src/components/WarehouseSheet';
import WorkersPanel from '../../src/components/WorkersPanel';
import LeaderboardSheet from '../../src/components/LeaderboardSheet';

export default function MenuScreen() {
  const { t } = useTranslation('tabs');
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [workersOpen, setWorkersOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);

  return (
    <ImageBackground
      source={require('../../assets/welcome-bg.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
      <View style={styles.content}>
        <Text style={styles.heading}>{t('menu.heading')}</Text>

        <Pressable style={styles.menuItem} onPress={() => setInventoryOpen(true)}>
          <Image
            source={require('../../assets/img/menu/werehouse.png')}
            style={{ width: 56, height: 56 }}
            contentFit="contain"
          />
          <Text style={styles.menuLabel}>{t('menu.inventory')}</Text>
        </Pressable>

        <Pressable style={styles.menuItem} onPress={() => setWorkersOpen(true)}>
          <Image
            source={require('../../assets/img/menu/workers.png')}
            style={{ width: 56, height: 56 }}
            contentFit="contain"
          />
          <Text style={styles.menuLabel}>{t('menu.workers')}</Text>
        </Pressable>

        <Pressable style={styles.menuItem} onPress={() => setLeaderboardOpen(true)}>
          <Image
            source={require('../../assets/img/menu/rating.png')}
            style={{ width: 56, height: 56 }}
            contentFit="contain"
          />
          <Text style={styles.menuLabel}>{t('menu.leaderboard')}</Text>
        </Pressable>
      </View>

      <WarehouseSheet visible={inventoryOpen} onClose={() => setInventoryOpen(false)} />
      <WorkersPanel visible={workersOpen} onClose={() => setWorkersOpen(false)} />
      <LeaderboardSheet visible={leaderboardOpen} onClose={() => setLeaderboardOpen(false)} />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    paddingTop: 72,
    paddingHorizontal: 20,
    gap: 12,
  },
  heading: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 26,
    color: '#2A3344',
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  menuLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 17,
    color: '#2A3344',
  },
});
