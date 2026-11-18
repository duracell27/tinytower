import React, { useState, useEffect, useRef } from 'react';
import { seasonColors } from '../../src/config/seasonTheme';
import { View, Text, Pressable, StyleSheet, useColorScheme, ScrollView, Platform, PanResponder } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import LocaleText from '../../src/components/LocaleText';
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

  const translateY = useSharedValue(0);
  const isAtTopRef = useRef(true);
  const isAtBottomRef = useRef(true);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gs) => {
        if (Platform.OS !== 'android') return false;
        if (isAtTopRef.current && gs.dy > 5) return true;
        if (isAtBottomRef.current && gs.dy < -5) return true;
        return false;
      },
      onPanResponderMove: (_, gs) => {
        if (isAtTopRef.current && gs.dy > 0) {
          translateY.value = gs.dy * 0.2;
        } else if (isAtBottomRef.current && gs.dy < 0) {
          translateY.value = gs.dy * 0.2;
        }
      },
      onPanResponderRelease: () => {
        translateY.value = withSpring(0, { damping: 22, stiffness: 200 });
      },
      onPanResponderTerminate: () => {
        translateY.value = withSpring(0, { damping: 22, stiffness: 200 });
      },
    })
  ).current;

  const bounceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const scrollContent = (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      bounces={true}
      alwaysBounceVertical={true}
      overScrollMode="never"
      scrollEventThrottle={16}
      onScroll={(e) => {
        const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
        isAtTopRef.current = contentOffset.y <= 0;
        isAtBottomRef.current = contentOffset.y >= contentSize.height - layoutMeasurement.height - 1;
      }}
    >
        <LocaleText style={[styles.heading, isDark && { color: '#DDE8D8' }]}>{t('menu.heading')}</LocaleText>

        <Pressable style={[styles.menuItem, isDark && { backgroundColor: '#252D42', borderColor: seasonColors.borderDark }]} onPress={() => setBoostsOpen(true)}>
          <Image
            source={require('../../assets/img/MarketingIcon.png')}
            style={{ width: 56, height: 56 }}
            contentFit="contain"
          />
          <LocaleText style={[styles.menuLabel, isDark && { color: '#DDE8D8' }]}>{t('boost.title')}</LocaleText>
        </Pressable>

        <Pressable style={[styles.menuItem, isDark && { backgroundColor: '#252D42', borderColor: seasonColors.borderDark }]} onPress={() => setInventoryOpen(true)}>
          <Image
            source={require('../../assets/img/menu/werehouse.png')}
            style={{ width: 56, height: 56 }}
            contentFit="contain"
          />
          <LocaleText style={[styles.menuLabel, isDark && { color: '#DDE8D8' }]}>{t('menu.inventory')}</LocaleText>
        </Pressable>

        <Pressable style={[styles.menuItem, isDark && { backgroundColor: '#252D42', borderColor: seasonColors.borderDark }]} onPress={() => setWorkersOpen(true)}>
          <Image
            source={require('../../assets/img/menu/myWorkers.png')}
            style={{ width: 56, height: 56 }}
            contentFit="contain"
          />
          <LocaleText style={[styles.menuLabel, isDark && { color: '#DDE8D8' }]}>{t('menu.workers')}</LocaleText>
        </Pressable>

        <Pressable style={[styles.menuItem, isDark && { backgroundColor: '#252D42', borderColor: seasonColors.borderDark }]} onPress={() => setLeaderboardOpen(true)}>
          <Image
            source={require('../../assets/img/menu/rating.png')}
            style={{ width: 56, height: 56 }}
            contentFit="contain"
          />
          <LocaleText style={[styles.menuLabel, isDark && { color: '#DDE8D8' }]}>{t('menu.leaderboard')}</LocaleText>
        </Pressable>

        <Pressable style={[styles.menuItem, isDark && { backgroundColor: '#252D42', borderColor: seasonColors.borderDark }]} onPress={() => router.push('/chat-screen')}>
          <Image
            source={require('../../assets/img/menu/chat.png')}
            style={{ width: 56, height: 56 }}
            contentFit="contain"
          />
          <LocaleText style={[styles.menuLabel, isDark && { color: '#DDE8D8' }]}>{t('menu.chat')}</LocaleText>
        </Pressable>

        <Pressable style={[styles.menuItem, isDark && { backgroundColor: '#252D42', borderColor: seasonColors.borderDark }]} onPress={() => router.push('/forum-screen')}>
          <Image
            source={require('../../assets/img/menu/forum.png')}
            style={{ width: 56, height: 56 }}
            contentFit="contain"
          />
          <LocaleText style={[styles.menuLabel, isDark && { color: '#DDE8D8' }]}>{t('menu.forum')}</LocaleText>
        </Pressable>

        <Pressable style={[styles.menuItem, isDark && { backgroundColor: '#252D42', borderColor: seasonColors.borderDark }]} onPress={() => setUsersOpen(true)}>
          <Image
            source={require('../../assets/img/users.png')}
            style={{ width: 56, height: 56 }}
            contentFit="contain"
          />
          <LocaleText style={[styles.menuLabel, isDark && { color: '#DDE8D8' }]}>{t('menu.users')}</LocaleText>
          {onlineCount !== null && (
            <View style={[styles.onlineBadge, isDark && { backgroundColor: 'rgba(63,165,53,0.15)' }]}>
              <LocaleText style={styles.onlineBadgeText}>{t('users.onlineBadge', { count: onlineCount })}</LocaleText>
            </View>
          )}
        </Pressable>
      </ScrollView>
  );

  return (
    <AppBackground style={styles.container}>
      {Platform.OS === 'android' ? (
        <Animated.View style={[{ flex: 1 }, bounceStyle]} {...panResponder.panHandlers}>
          {scrollContent}
        </Animated.View>
      ) : (
        scrollContent
      )}

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
  scroll: { flex: 1 },
  content: {
    paddingTop: 72,
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 12,
  },
  heading: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 32,
    color: seasonColors.accent,
    marginBottom: 12,
    textAlign: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: seasonColors.border,
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
