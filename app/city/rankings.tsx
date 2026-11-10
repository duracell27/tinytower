import React, { useEffect, useState, useCallback } from 'react';
import {
  View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, useColorScheme,
} from 'react-native';
import { seasonColors } from '../../src/config/seasonTheme';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import LocaleText from '../../src/components/LocaleText';
import AppBackground from '../../src/components/AppBackground';
import { useCityStore } from '../../src/stores/cityStore';
import type { CityRankingEntry } from '../../src/services/api';

const LVL_ICON = require('../../assets/img/lvlIcon.png');
const CUP_1    = require('../../assets/img/rating/1PlaceCup.png');

const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

export default function CityRankingsScreen() {
  const { t } = useTranslation('tabs');
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getCityRankings } = useCityStore();

  const [entries, setEntries] = useState<CityRankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const loadPage = useCallback(async (p: number, replace: boolean) => {
    if (p === 1) setLoading(true); else setLoadingMore(true);
    try {
      const res = await getCityRankings(p);
      setEntries((prev) => replace ? res.entries : [...prev, ...res.entries]);
      setHasMore(p * res.pageSize < res.total);
      setPage(p);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [getCityRankings]);

  useEffect(() => { loadPage(1, true); }, [loadPage]);

  const renderItem = ({ item }: { item: CityRankingEntry }) => {
    const rankColor = item.rank <= 3 ? RANK_COLORS[item.rank - 1] : (isDark ? '#8A9A80' : '#7A8A80');
    const isTop3 = item.rank <= 3;

    return (
      <TouchableOpacity
        style={[styles.row, isDark && styles.rowDark, isTop3 && { borderWidth: 2, borderColor: rankColor }]}
        onPress={() => router.push(`/city/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={[styles.rankBox, isTop3 && { backgroundColor: rankColor + '22' }]}>
          <LocaleText style={[styles.rankText, { color: rankColor }]}>
            {t('city.rankings.rankLabel', { rank: item.rank })}
          </LocaleText>
        </View>

        <View style={styles.cityInfo}>
          <LocaleText style={[styles.cityName, isDark && { color: '#DDE8D8' }]} numberOfLines={1}>
            {item.name}
          </LocaleText>
        </View>

        <View style={styles.levelBox}>
          <Image source={LVL_ICON} style={styles.lvlIcon} contentFit="contain" />
          <LocaleText style={[styles.levelText, isDark && { color: '#6BAED0' }]}>
            {item.level}
          </LocaleText>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <AppBackground style={[styles.bg, isDark && styles.bgDark]}>
        <View style={[styles.center, { paddingTop: insets.top }]}>
          <ActivityIndicator color={isDark ? '#6BAED0' : '#2E6EC9'} />
        </View>
      </AppBackground>
    );
  }

  return (
    <AppBackground style={[styles.bg, isDark && styles.bgDark]}>
      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        contentContainerStyle={[styles.list, { paddingTop: insets.top }]}
        renderItem={renderItem}
        ListHeaderComponent={
          <View style={[styles.hero, { backgroundColor: isDark ? '#252D42' : '#FFFFFF' }, isDark && { borderColor: seasonColors.borderDark }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
              <LocaleText style={[styles.backIcon, isDark && { color: '#6BAED0' }]}>‹</LocaleText>
            </TouchableOpacity>

            <View style={styles.heroCenter}>
              <Image source={CUP_1} style={styles.heroIcon} contentFit="contain" />
              <View style={styles.heroTextWrap}>
                <LocaleText style={[styles.heroTitle, isDark && { color: '#DDE8D8' }]}>
                  {t('city.rankings.title')}
                </LocaleText>
                <LocaleText style={[styles.heroSub, isDark && { color: '#8A9A80' }]}>
                  {t('city.rankings.subtitle')}
                </LocaleText>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.findCityBtn, isDark && styles.findCityBtnDark]}
              onPress={() => router.push('/city/search')}
              activeOpacity={0.7}
            >
              <LocaleText style={[styles.findCityBtnText, isDark && { color: '#6BAED0' }]}>
                {t('city.rankings.findCity')}
              </LocaleText>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <LocaleText style={[styles.emptyText, isDark && { color: '#8A9A80' }]}>
              {t('city.rankings.empty')}
            </LocaleText>
          </View>
        }
        ListFooterComponent={
          hasMore ? (
            <TouchableOpacity
              style={[styles.loadMoreBtn, isDark && styles.loadMoreBtnDark]}
              onPress={() => loadPage(page + 1, false)}
              disabled={loadingMore}
              activeOpacity={0.7}
            >
              {loadingMore
                ? <ActivityIndicator color={isDark ? '#6BAED0' : '#2E6EC9'} />
                : <LocaleText style={[styles.loadMoreText, isDark && { color: '#6BAED0' }]}>{t('city.rankings.loadMore')}</LocaleText>
              }
            </TouchableOpacity>
          ) : null
        }
      />
    </AppBackground>
  );
}


const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#F0F8FF' },
  bgDark: { backgroundColor: '#0D1F2D' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  list: { paddingBottom: 40 },

  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(46,110,201,0.15)', alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontFamily: 'Fredoka_700Bold', fontSize: 26, color: '#2E6EC9', lineHeight: 26, includeFontPadding: false },

  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: seasonColors.border,
  },
  heroCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  heroIcon: { width: 36, height: 36 },
  heroTextWrap: { gap: 1 },
  heroTitle: { fontFamily: 'Fredoka_700Bold', fontSize: 20, color: '#0A1C30' },
  heroSub: { fontFamily: 'Fredoka_400Regular', fontSize: 12, color: '#5A7090' },

  findCityBtn: {
    backgroundColor: '#E8F2FA',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2E6EC9',
  },
  findCityBtnDark: { backgroundColor: '#1A2E4A' },
  findCityBtnText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 13, color: '#2E6EC9' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: seasonColors.border,
  },
  rowDark: { backgroundColor: '#252D42', borderColor: seasonColors.borderDark },
  rowTop3: {},

  rankBox: { width: 44, alignItems: 'center', borderRadius: 8, paddingVertical: 4 },
  rankText: { fontFamily: 'Fredoka_700Bold', fontSize: 15, color: '#7A8A80' },

  cityInfo: { flex: 1 },
  cityName: { fontFamily: 'Fredoka_600SemiBold', fontSize: 15, color: '#0A1C30' },

  levelBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lvlIcon: { width: 22, height: 22 },
  levelText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 14, color: '#2E6EC9' },

  emptyText: { fontFamily: 'Fredoka_500Medium', fontSize: 15, color: '#7A8A80' },

  loadMoreBtn: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#E8F0F8',
    alignItems: 'center',
  },
  loadMoreBtnDark: { backgroundColor: 'rgba(255,255,255,0.07)' },
  loadMoreText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 15, color: '#2E6EC9' },
});
