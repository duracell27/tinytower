import React, { useEffect, useState, useCallback } from 'react';
import {
  View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, useColorScheme,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import LocaleText from '../../src/components/LocaleText';
import AppBackground from '../../src/components/AppBackground';
import { useCityStore } from '../../src/stores/cityStore';
import type { CitySummary } from '../../src/services/api';

const WORKER_ICON = require('../../assets/img/worker.png');
const CITY_ICON   = require('../../assets/img/city/cityBuildings.png');
const LVL_ICON    = require('../../assets/img/lvlIcon.png');

export default function CityBrowseScreen() {
  const { t } = useTranslation('tabs');
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { browseCities } = useCityStore();

  const [cities, setCities] = useState<CitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await browseCities();
      setCities(data);
    } finally {
      setLoading(false);
    }
  }, [browseCities]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await browseCities();
      setCities(data);
    } finally {
      setRefreshing(false);
    }
  }, [browseCities]);

  useEffect(() => { load(); }, [load]);

  const renderItem = ({ item }: { item: CitySummary }) => (
    <TouchableOpacity
      style={[styles.row, isDark && styles.rowDark]}
      onPress={() => router.push(`/city/${item.id}`)}
      activeOpacity={0.7}
    >
      <Image source={CITY_ICON} style={styles.rowCityIcon} contentFit="contain" />

      <View style={styles.cityInfo}>
        <View style={styles.nameRow}>
          <LocaleText style={[styles.cityName, isDark && { color: '#DDE8D8' }]} numberOfLines={1}>
            {item.name}
          </LocaleText>
          <Image source={LVL_ICON} style={styles.lvlIcon} contentFit="contain" />
          <LocaleText style={[styles.levelText, isDark && { color: '#6BAED0' }]}>
            {item.level}
          </LocaleText>
        </View>
        {item.description ? (
          <LocaleText style={[styles.cityMeta, isDark && { color: '#8A9A80' }]} numberOfLines={1}>
            {item.description}
          </LocaleText>
        ) : null}
      </View>

      <View style={[styles.memberPill, isDark && styles.memberPillDark]}>
        <Image source={WORKER_ICON} style={styles.pillIcon} contentFit="contain" />
        <LocaleText style={[styles.memberPillText, isDark && { color: '#6BAED0' }]}>
          {item.memberCount}/{item.maxMembers}
        </LocaleText>
      </View>
    </TouchableOpacity>
  );

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
        data={cities}
        keyExtractor={(e) => e.id}
        contentContainerStyle={[styles.list, { paddingTop: insets.top }]}
        renderItem={renderItem}
        ListHeaderComponent={
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
              <LocaleText style={[styles.backIcon, isDark && { color: '#6BAED0' }]}>‹</LocaleText>
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Image source={CITY_ICON} style={styles.cityHeaderIcon} contentFit="contain" />
              <LocaleText style={[styles.headerTitle, isDark && { color: '#DDE8D8' }]}>
                {t('city.browse.title')}
              </LocaleText>
              <LocaleText style={[styles.headerSubtitle, isDark && { color: '#8A9A80' }]}>
                {t('city.browse.subtitle')}
              </LocaleText>
            </View>

            <TouchableOpacity
              style={[styles.searchBtn, isDark && styles.searchBtnDark]}
              onPress={() => router.push('/city/search')}
              activeOpacity={0.7}
            >
              <LocaleText style={[styles.searchBtnText, isDark && { color: '#6BAED0' }]}>
                {t('city.search.title')}
              </LocaleText>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <LocaleText style={[styles.emptyText, isDark && { color: '#8A9A80' }]}>
              {t('city.browse.empty')}
            </LocaleText>
          </View>
        }
        ListFooterComponent={
          cities.length > 0 ? (
            <TouchableOpacity
              style={[styles.refreshBtn, isDark && styles.refreshBtnDark]}
              onPress={refresh}
              disabled={refreshing}
              activeOpacity={0.7}
            >
              {refreshing
                ? <ActivityIndicator color={isDark ? '#6BAED0' : '#2E6EC9'} />
                : <LocaleText style={[styles.refreshBtnText, isDark && { color: '#6BAED0' }]}>
                    {t('city.browse.refresh')}
                  </LocaleText>
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

  header: { paddingBottom: 16, paddingHorizontal: 16 },
  backBtn: { paddingTop: 4, paddingBottom: 8, alignSelf: 'flex-start' },
  backIcon: { fontSize: 34, color: '#2E6EC9', lineHeight: 36 },

  headerCenter: { alignItems: 'center', paddingBottom: 14 },
  cityHeaderIcon: { width: 56, height: 56, marginBottom: 8 },
  headerTitle: { fontFamily: 'Fredoka_700Bold', fontSize: 22, color: '#0A1C30', marginBottom: 4 },
  headerSubtitle: { fontFamily: 'Fredoka_500Medium', fontSize: 14, color: '#5A7090' },

  searchBtn: {
    backgroundColor: '#E8F2FA',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 10,
    alignItems: 'center',
  },
  searchBtnDark: { backgroundColor: 'rgba(46,110,201,0.15)' },
  searchBtnText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 15, color: '#2E6EC9' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  rowDark: { backgroundColor: '#1A2E3E' },

  rowCityIcon: { width: 32, height: 32 },
  cityInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  cityName: { fontFamily: 'Fredoka_700Bold', fontSize: 18, color: '#0A1C30', flexShrink: 1 },
  lvlIcon: { width: 16, height: 16 },
  levelText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 14, color: '#2E6EC9' },
  cityMeta: { fontFamily: 'Fredoka_400Regular', fontSize: 12, color: '#5A7090' },

  memberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(46,110,201,0.10)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  memberPillDark: { backgroundColor: 'rgba(107,174,208,0.15)' },
  pillIcon: { width: 18, height: 18 },
  memberPillText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 13, color: '#2E6EC9' },

  emptyText: { fontFamily: 'Fredoka_500Medium', fontSize: 15, color: '#7A8A80' },

  refreshBtn: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#E8F0F8',
    alignItems: 'center',
  },
  refreshBtnDark: { backgroundColor: 'rgba(255,255,255,0.07)' },
  refreshBtnText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 15, color: '#2E6EC9' },
});
