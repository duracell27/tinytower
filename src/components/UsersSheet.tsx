// src/components/UsersSheet.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, Pressable, FlatList, StyleSheet, Dimensions,
  ActivityIndicator, Modal, TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, runOnJS, Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api, type UserEntry } from '../services/api';
import { getUserIcon } from '../utils/userIcon';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT - 56;
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

type Tab = 'online' | 'no-city' | 'search';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCountReady?: (count: number) => void;
}

function isOnline(lastSeenAt: string): boolean {
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS;
}

const LVL_ICON = require('../../assets/img/lvlIcon.png');

function PlayerCard({ item, onPress }: { item: UserEntry; onPress: () => void }) {
  const online = isOnline(item.lastSeenAt);
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
      onPress={onPress}
    >
      <Image
        source={getUserIcon(item.playerLevel)}
        style={styles.avatar}
        contentFit="cover"
      />
      <View style={styles.nameBlock}>
        <View style={styles.nameRow}>
          {online && <View style={styles.onlineDot} />}
          <Text style={styles.name} numberOfLines={1}>{item.playerName}</Text>
        </View>
        <Text style={styles.cityText} numberOfLines={1}>{item.city ?? '—'}</Text>
      </View>
      <View style={styles.levelBadge}>
        <Image source={LVL_ICON} style={styles.lvlIcon} contentFit="contain" />
        <Text style={styles.levelText}>{item.playerLevel}</Text>
      </View>
    </Pressable>
  );
}

export default function UsersSheet({ visible, onClose, onCountReady }: Props) {
  const { t } = useTranslation('tabs');
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>('online');
  const [page, setPage] = useState(1);
  const [entries, setEntries] = useState<UserEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setEntries([]);
    setQuery('');
  }, [tab]);

  // Fetch for online and no-city tabs
  useEffect(() => {
    if (!visible || tab === 'search') return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const fetcher = tab === 'online'
      ? api.getOnlinePlayers(page)
      : api.getNoCityPlayers(page);
    fetcher
      .then((d) => {
        if (cancelled) return;
        setEntries(d.entries);
        setTotal(d.total);
        if (tab === 'online' && page === 1) onCountReady?.(d.total);
      })
      .catch(() => { if (!cancelled) setError(t('users.errorLoad')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [visible, tab, page]);

  // Debounced search
  useEffect(() => {
    if (tab !== 'search') return;
    if (query.length < 2) { setEntries([]); setTotal(0); return; }
    let cancelled = false;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      setError(null);
      api.searchPlayers(query, page)
        .then((d) => { if (!cancelled) { setEntries(d.entries); setTotal(d.total); } })
        .catch(() => { if (!cancelled) setError(t('users.errorLoad')); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 400);
    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, page, tab]);

  const totalPages = Math.max(1, Math.ceil(total / 20));

  const renderItem = useCallback(({ item }: { item: UserEntry }) => (
    <PlayerCard
      item={item}
      onPress={() => { router.push(`/user-profile/${item.id}`); onClose(); }}
    />
  ), [onClose, router]);

  if (!mounted) return null;

  const TABS: { key: Tab; label: string }[] = [
    { key: 'online',  label: t('users.tabOnline') },
    { key: 'no-city', label: t('users.tabNoCity') },
    { key: 'search',  label: t('users.tabSearch') },
  ];

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} />
      </Pressable>

      <Animated.View style={[styles.sheet, sheetStyle]}>
        <LinearGradient colors={['#3FA535', '#2E7D28']} style={styles.gradientHeader}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('users.title')}</Text>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton}>
              <Text style={styles.closeIcon}>✕</Text>
            </Pressable>
          </View>
          <View style={styles.tabs}>
            {TABS.map((t) => {
              const isActive = tab === t.key;
              return (
                <Pressable
                  key={t.key}
                  style={[styles.tab, isActive && styles.tabActive]}
                  onPress={() => setTab(t.key)}
                >
                  <Text style={[styles.tabText, isActive ? styles.tabTextActive : styles.tabTextInactive]}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </LinearGradient>

        {tab === 'search' && (
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder={t('users.searchPlaceholder')}
              placeholderTextColor="#9CA3AF"
              value={query}
              onChangeText={(v) => { setQuery(v); setPage(1); }}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        )}

        {loading && <ActivityIndicator style={styles.loader} color="#3FA535" size="large" />}

        {error && !loading && (
          <View style={styles.errorWrap}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!loading && !error && tab === 'search' && query.length < 2 && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>{t('users.minChars')}</Text>
          </View>
        )}

        {!loading && !error && entries.length === 0 && (tab !== 'search' || query.length >= 2) && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>{t('users.empty')}</Text>
          </View>
        )}

        {!loading && !error && entries.length > 0 && (
          <FlatList
            data={entries}
            keyExtractor={(e) => e.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            style={{ flex: 1 }}
          />
        )}

        {!loading && !error && tab !== 'search' && totalPages > 1 && (
          <View style={styles.pagination}>
            <Pressable
              style={[styles.pageBtn, page === 1 && styles.pageBtnDisabled]}
              onPress={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <Text style={styles.pageBtnText}>◀</Text>
            </Pressable>
            <Text style={styles.pageLabel}>{page} / {totalPages}</Text>
            <Pressable
              style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}
              onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
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
    position: 'absolute', bottom: 0, left: 0, right: 0, height: SHEET_HEIGHT,
    backgroundColor: '#F4F6FB', borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden',
  },
  gradientHeader: { paddingTop: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 14,
  },
  title: { fontFamily: 'Fredoka_700Bold', fontSize: 22, color: '#fff' },
  closeButton: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center',
  },
  closeIcon: { fontSize: 18, color: 'rgba(255,255,255,0.7)' },
  tabs: { flexDirection: 'row', paddingHorizontal: 12, gap: 6 },
  tab: {
    flex: 1, paddingVertical: 10, alignItems: 'center',
    borderTopLeftRadius: 12, borderTopRightRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  tabActive: { backgroundColor: '#EEF2F8' },
  tabText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 14 },
  tabTextActive: { color: '#3FA535' },
  tabTextInactive: { color: 'rgba(255,255,255,0.75)' },
  searchContainer: {
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4,
  },
  searchInput: {
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    fontFamily: 'Fredoka_500Medium', fontSize: 15, color: '#2A3344',
    borderWidth: 1, borderColor: '#E8EAF0',
  },
  loader: { flex: 1 },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontFamily: 'Fredoka_400Regular', fontSize: 15, color: '#E05A4A' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: 'Fredoka_500Medium', fontSize: 15, color: '#9CA3AF' },
  list: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 11,
    paddingHorizontal: 12, marginBottom: 8, borderRadius: 16,
    backgroundColor: '#fff', gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    borderWidth: 1, borderColor: 'rgba(40,60,90,0.06)',
  },
  avatar: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  nameBlock: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#52B847' },
  name: { fontFamily: 'Fredoka_600SemiBold', fontSize: 15, color: '#2A3344', flexShrink: 1 },
  cityText: { fontFamily: 'Fredoka_400Regular', fontSize: 12, color: '#9CA3AF' },
  levelBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  lvlIcon: { width: 24, height: 24 },
  levelText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 17, color: '#5A6478' },
  pagination: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#E8EAF0',
  },
  pageBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#3FA535', alignItems: 'center', justifyContent: 'center',
  },
  pageBtnDisabled: { backgroundColor: '#D1D5DB' },
  pageBtnText: { fontSize: 16, color: '#fff' },
  pageLabel: { fontFamily: 'Fredoka_600SemiBold', fontSize: 15, color: '#2A3344' },
});
