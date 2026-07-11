import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Pressable, FlatList, StyleSheet, Dimensions, ActivityIndicator, Modal,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, runOnJS, Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import { api, type LeaderboardResponse, type LeaderboardEntry } from '../services/api';
import { formatNum } from '../utils/format';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT - 56;

type Tab = 'level' | 'floors' | 'revenue';

const AVATAR_COLORS = ['#5B6CF8', '#49AA38', '#E5A72E', '#E05A4A', '#8B5CF6', '#06B6D4'];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const TAB_ACTIVE_COLORS: Record<Tab, string> = {
  level: '#5B6CF8',
  floors: '#49AA38',
  revenue: '#E5A72E',
};

const VALUE_LABELS: Record<Tab, string> = {
  level: 'LVL',
  floors: 'FLOORS',
  revenue: '/MIN',
};

function rankStyle(rank: number): { borderWidth: number; borderColor: string; backgroundColor: string } {
  if (rank === 1) return { borderWidth: 2, borderColor: '#F5C842', backgroundColor: '#FEFCE8' };
  if (rank === 2) return { borderWidth: 2, borderColor: '#B8C0CC', backgroundColor: '#F4F6F8' };
  if (rank === 3) return { borderWidth: 2, borderColor: '#C8926A', backgroundColor: '#FFF5EE' };
  return { borderWidth: 1, borderColor: 'rgba(40,60,90,0.06)', backgroundColor: '#fff' };
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function LeaderboardSheet({ visible, onClose }: Props) {
  const { t } = useTranslation('tabs');
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>('level');
  const [page, setPage] = useState(1);
  const [retryKey, setRetryKey] = useState(0);
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myId = useAuthStore(s => s.player?.id);

  const slideY = useSharedValue(SHEET_HEIGHT);
  const scrimOpacity = useSharedValue(0);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: slideY.value }] }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrimOpacity.value }));

  useEffect(() => {
    if (visible) {
      setMounted(true);
      slideY.value = withTiming(0, { duration: 420, easing: Easing.bezier(0.4, 0, 0.2, 1) });
      scrimOpacity.value = withTiming(0.5, { duration: 300, easing: Easing.linear });
    } else if (mounted) {
      scrimOpacity.value = withTiming(0, { duration: 280, easing: Easing.linear });
      slideY.value = withTiming(SHEET_HEIGHT, { duration: 300, easing: Easing.bezier(0.4, 0, 1, 1) }, () => {
        runOnJS(setMounted)(false);
      });
    }
  }, [visible, mounted]);

  useEffect(() => {
    setPage(1);
    setRetryKey(0);
  }, [tab]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.leaderboard(tab, page)
      .then(d => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setError(t('leaderboard.errorLoad')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [visible, tab, page, retryKey]);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'level',   label: t('leaderboard.tabLevel') },
    { key: 'floors',  label: t('leaderboard.tabFloors') },
    { key: 'revenue', label: t('leaderboard.tabRevenue') },
  ];

  const totalPages = data ? Math.ceil(data.total / 20) : 1;
  const isOnPage = data?.entries.some(e => e.playerId === myId) ?? false;

  function formatValue(v: number) {
    return formatNum(v);
  }

  const renderEntry = useCallback(({ item }: { item: LeaderboardEntry }) => {
    const isMe = item.playerId === myId;
    const accent = TAB_ACTIVE_COLORS[tab];
    return (
      <View style={[styles.row, rankStyle(item.rank), isMe && styles.rowHighlight]}>
        <Text style={[styles.rankNum, isMe && styles.rankHighlight]}>#{item.rank}</Text>
        <View style={[styles.avatar, { backgroundColor: getAvatarColor(item.playerName) }]}>
          <Text style={styles.avatarText}>{item.playerName.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={[styles.name, isMe && styles.textHighlight]} numberOfLines={1}>
          {item.playerName}
        </Text>
        <View style={styles.valueBlock}>
          <Text style={styles.valueLabel}>{VALUE_LABELS[tab]}</Text>
          <Text style={[styles.valueBig, { color: isMe ? '#B8860B' : accent }]}>
            {formatValue(item.value)}
          </Text>
        </View>
      </View>
    );
  }, [myId, tab]);

  if (!mounted) return null;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} />
      </Pressable>

      <Animated.View style={[styles.sheet, sheetStyle]}>
        <LinearGradient colors={['#5B8DD9', '#3A6BBF']} style={styles.gradientHeader}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('leaderboard.title')}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.closeIcon}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.tabs}>
            {TABS.map(tabItem => {
              const isActive = tab === tabItem.key;
              return (
                <Pressable
                  key={tabItem.key}
                  style={[styles.tab, isActive && styles.tabActive]}
                  onPress={() => setTab(tabItem.key)}
                >
                  <Text style={[
                    styles.tabText,
                    isActive
                      ? { color: TAB_ACTIVE_COLORS[tabItem.key] }
                      : styles.tabTextInactive,
                  ]}>
                    {tabItem.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </LinearGradient>

        {loading && <ActivityIndicator style={styles.loader} color="#5B6CF8" size="large" />}

        {error && !loading && (
          <View style={styles.errorWrap}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => setRetryKey(k => k + 1)} style={styles.retryBtn}>
              <Text style={styles.retryText}>{t('leaderboard.retry')}</Text>
            </Pressable>
          </View>
        )}

        {!loading && !error && data && (
          <FlatList
            data={data.entries}
            keyExtractor={e => e.playerId}
            renderItem={renderEntry}
            contentContainerStyle={styles.list}
            style={{ flex: 1 }}
          />
        )}

        {!loading && !error && data && !isOnPage && (
          <View style={[styles.row, rankStyle(data.currentPlayer.rank), styles.rowHighlight, styles.pinnedRow]}>
            <Text style={[styles.rankNum, styles.rankHighlight]}>#{data.currentPlayer.rank}</Text>
            <View style={[styles.avatar, { backgroundColor: '#C9951A' }]}>
              <Text style={styles.avatarText}>★</Text>
            </View>
            <Text style={[styles.name, styles.textHighlight]}>{t('leaderboard.you')}</Text>
            <View style={styles.valueBlock}>
              <Text style={styles.valueLabel}>{VALUE_LABELS[tab]}</Text>
              <Text style={[styles.valueBig, { color: '#B8860B' }]}>
                {formatValue(data.currentPlayer.value)}
              </Text>
            </View>
          </View>
        )}

        {!loading && !error && data && (
          <View style={styles.pagination}>
            <Pressable
              style={[styles.pageBtn, page === 1 && styles.pageBtnDisabled]}
              onPress={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <Text style={styles.pageBtnText}>◀</Text>
            </Pressable>
            <Text style={styles.pageLabel}>{page} / {totalPages}</Text>
            <Pressable
              style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}
              onPress={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              <Text style={styles.pageBtnText}>▶</Text>
            </Pressable>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: '#000' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: '#F4F6FB',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  gradientHeader: {
    paddingTop: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  title: { fontFamily: 'Fredoka_700Bold', fontSize: 22, color: '#fff' },
  closeIcon: { fontSize: 18, color: 'rgba(255,255,255,0.7)' },
  tabs: { flexDirection: 'row', paddingHorizontal: 12, gap: 6 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  tabActive: { backgroundColor: '#EEF2F8' },
  tabText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 14 },
  tabTextInactive: { color: 'rgba(255,255,255,0.75)' },
  loader: { flex: 1 },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontFamily: 'Fredoka_400Regular', fontSize: 15, color: '#E05A4A' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#5B6CF8', borderRadius: 10 },
  retryText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 14, color: '#fff' },
  list: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingLeft: 11,
    paddingRight: 13,
    marginBottom: 8,
    borderRadius: 18,
    gap: 10,
  },
  rowHighlight: { backgroundColor: '#FFF7E0' },
  rankNum: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: '#9CA3AF',
    width: 36,
  },
  rankHighlight: { color: '#B8860B' },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
    color: '#fff',
  },
  name: { fontFamily: 'Fredoka_600SemiBold', fontSize: 16, color: '#2A3344', flex: 1 },
  valueBlock: { alignItems: 'center', gap: 1 },
  valueLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 8,
    color: '#AEB4C0',
    letterSpacing: 0.5,
  },
  valueBig: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 24,
  },
  textHighlight: { color: '#B8860B' },
  pinnedRow: { marginHorizontal: 16, marginBottom: 6, borderRadius: 18 },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8EAF0',
  },
  pageBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#5B6CF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBtnDisabled: { backgroundColor: '#D1D5DB' },
  pageBtnText: { fontSize: 16, color: '#fff' },
  pageLabel: { fontFamily: 'Fredoka_600SemiBold', fontSize: 15, color: '#2A3344' },
});
