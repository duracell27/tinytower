import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, useColorScheme } from 'react-native';
import AppBackground from '../../src/components/AppBackground';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { useRouter, useFocusEffect } from 'expo-router';
import UsersSheet from '../../src/components/UsersSheet';
import { api } from '../../src/services/api';
import { useGameStore } from '../../src/stores/gameStore';
import WarehouseSheet from '../../src/components/WarehouseSheet';
import WorkersPanel from '../../src/components/WorkersPanel';
import LeaderboardSheet from '../../src/components/LeaderboardSheet';
import BoostSheet from '../../src/components/BoostSheet';

export default function MenuScreen() {
  const { t } = useTranslation('tabs');
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [workersOpen, setWorkersOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);
  const [boostsOpen, setBoostsOpen] = useState(false);
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const pendingWorkerFocus = useGameStore((s) => s.pendingWorkerFocus);
  const pendingOpenWarehouse = useGameStore((s) => s.pendingOpenWarehouse);
  const clearPendingOpenWarehouse = useGameStore((s) => s.clearPendingOpenWarehouse);

  useEffect(() => {
    if (pendingWorkerFocus) {
      setWorkersOpen(true);
    }
  }, [pendingWorkerFocus]);

  useEffect(() => {
    if (pendingOpenWarehouse) {
      setInventoryOpen(true);
      clearPendingOpenWarehouse();
    }
  }, [pendingOpenWarehouse, clearPendingOpenWarehouse]);

  useFocusEffect(
    React.useCallback(() => {
      api.getOnlinePlayers(1)
        .then((d) => setOnlineCount(d.total))
        .catch(() => {});
    }, []),
  );

  return (
    <AppBackground style={styles.container}>
      <View style={styles.content}>
        <Text style={[styles.heading, isDark && { color: '#DDE8D8' }]}>{t('menu.heading')}</Text>

        <Pressable style={[styles.menuItem, isDark && { backgroundColor: '#252D42' }]} onPress={() => setBoostsOpen(true)}>
          <Image
            source={require('../../assets/img/MarketingIcon.png')}
            style={{ width: 56, height: 56 }}
            contentFit="contain"
          />
          <Text style={[styles.menuLabel, isDark && { color: '#DDE8D8' }]}>Boosts</Text>
        </Pressable>

        <Pressable style={[styles.menuItem, isDark && { backgroundColor: '#252D42' }]} onPress={() => setInventoryOpen(true)}>
          <Image
            source={require('../../assets/img/menu/werehouse.png')}
            style={{ width: 56, height: 56 }}
            contentFit="contain"
          />
          <Text style={[styles.menuLabel, isDark && { color: '#DDE8D8' }]}>{t('menu.inventory')}</Text>
        </Pressable>

        <Pressable style={[styles.menuItem, isDark && { backgroundColor: '#252D42' }]} onPress={() => setWorkersOpen(true)}>
          <Image
            source={require('../../assets/img/menu/myWorkers.png')}
            style={{ width: 56, height: 56 }}
            contentFit="contain"
          />
          <Text style={[styles.menuLabel, isDark && { color: '#DDE8D8' }]}>{t('menu.workers')}</Text>
        </Pressable>

        <Pressable style={[styles.menuItem, isDark && { backgroundColor: '#252D42' }]} onPress={() => setLeaderboardOpen(true)}>
          <Image
            source={require('../../assets/img/menu/rating.png')}
            style={{ width: 56, height: 56 }}
            contentFit="contain"
          />
          <Text style={[styles.menuLabel, isDark && { color: '#DDE8D8' }]}>{t('menu.leaderboard')}</Text>
        </Pressable>

        <Pressable style={[styles.menuItem, isDark && { backgroundColor: '#252D42' }]} onPress={() => router.push('/chat-screen')}>
          <Image
            source={require('../../assets/img/menu/chat.png')}
            style={{ width: 56, height: 56 }}
            contentFit="contain"
          />
          <Text style={[styles.menuLabel, isDark && { color: '#DDE8D8' }]}>{t('menu.chat')}</Text>
        </Pressable>

        <Pressable style={[styles.menuItem, isDark && { backgroundColor: '#252D42' }]} onPress={() => router.push('/forum-screen')}>
          <Image
            source={require('../../assets/img/menu/forum.png')}
            style={{ width: 56, height: 56 }}
            contentFit="contain"
          />
          <Text style={[styles.menuLabel, isDark && { color: '#DDE8D8' }]}>{t('menu.forum')}</Text>
        </Pressable>

        <Pressable style={[styles.menuItem, isDark && { backgroundColor: '#252D42' }]} onPress={() => setUsersOpen(true)}>
          <Image
            source={require('../../assets/img/users.png')}
            style={{ width: 56, height: 56 }}
            contentFit="contain"
          />
          <Text style={[styles.menuLabel, isDark && { color: '#DDE8D8' }]}>{t('menu.users')}</Text>
          {onlineCount !== null && (
            <View style={[styles.onlineBadge, isDark && { backgroundColor: 'rgba(63,165,53,0.15)' }]}>
              <Text style={styles.onlineBadgeText}>{t('users.onlineBadge', { count: onlineCount })}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <BoostSheet visible={boostsOpen} onClose={() => setBoostsOpen(false)} />
      <WarehouseSheet visible={inventoryOpen} onClose={() => setInventoryOpen(false)} />
      <WorkersPanel
        visible={workersOpen}
        onClose={() => setWorkersOpen(false)}
        targetWorkerId={pendingWorkerFocus}
      />
      <LeaderboardSheet visible={leaderboardOpen} onClose={() => setLeaderboardOpen(false)} />
      <UsersSheet
        visible={usersOpen}
        onClose={() => setUsersOpen(false)}
        onCountReady={(count) => setOnlineCount(count)}
      />
    </AppBackground>
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

  onlineBadge: {
    marginLeft: 'auto',
    backgroundColor: '#EAF6E8',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  onlineBadgeText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
    color: '#3FA535',
  },
});
