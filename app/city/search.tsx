import React, { useState, useCallback, useEffect } from 'react';
import {
  View, StyleSheet, TextInput, FlatList, TouchableOpacity,
  ActivityIndicator, useColorScheme,
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

export default function CitySearchScreen() {
  const { t } = useTranslation('tabs');
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { searchCities, getCityRankings } = useCityStore();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CitySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [totalCities, setTotalCities] = useState<number | null>(null);

  useEffect(() => {
    getCityRankings(1).then((res) => setTotalCities(res.total)).catch(() => {});
  }, []);

  const handleSearch = useCallback(async (q: string) => {
    if (q.length < 2) return;
    setLoading(true);
    setSearched(true);
    try {
      const data = await searchCities(q);
      setResults(data);
    } finally {
      setLoading(false);
    }
  }, [searchCities]);

  const onChangeText = (text: string) => {
    setQuery(text);
    if (text.length >= 2) {
      handleSearch(text);
    } else {
      setResults([]);
      setSearched(false);
    }
  };

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

  return (
    <AppBackground style={[styles.bg, isDark && styles.bgDark]}>
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingTop: insets.top }]}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
              <LocaleText style={[styles.backIcon, isDark && { color: '#6BAED0' }]}>‹</LocaleText>
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Image source={CITY_ICON} style={styles.cityHeaderIcon} contentFit="contain" />
              <LocaleText style={[styles.headerTitle, isDark && { color: '#DDE8D8' }]}>
                {t('city.search.title')}
              </LocaleText>
              {totalCities != null && (
                <View style={[styles.countBadge, isDark && styles.countBadgeDark]}>
                  <LocaleText style={[styles.countBadgeText, isDark && { color: '#6BAED0' }]}>
                    {t('city.search.citiesCount', { count: totalCities })}
                  </LocaleText>
                </View>
              )}
            </View>

            <View style={styles.inputWrap}>
              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                placeholder={t('city.search.placeholder')}
                placeholderTextColor={isDark ? '#667080' : '#A0AEB8'}
                value={query}
                onChangeText={onChangeText}
                autoFocus
                returnKeyType="search"
                onSubmitEditing={() => handleSearch(query)}
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={isDark ? '#6BAED0' : '#2E6EC9'} />
            </View>
          ) : query.length < 2 && !searched ? (
            <View style={styles.center}>
              <LocaleText style={[styles.hint, isDark && { color: '#8A9A80' }]}>
                {t('city.search.minChars')}
              </LocaleText>
            </View>
          ) : searched && results.length === 0 ? (
            <View style={styles.center}>
              <LocaleText style={[styles.hint, isDark && { color: '#8A9A80' }]}>
                {t('city.search.empty')}
              </LocaleText>
            </View>
          ) : null
        }
      />
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#F0F8FF' },
  bgDark: { backgroundColor: '#0D1F2D' },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  list: { paddingBottom: 40 },

  header: { paddingBottom: 16, paddingHorizontal: 16 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(46,110,201,0.15)', alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontFamily: 'Fredoka_700Bold', fontSize: 26, color: '#2E6EC9', lineHeight: 26, includeFontPadding: false },

  headerCenter: { alignItems: 'center', paddingBottom: 14 },
  cityHeaderIcon: { width: 56, height: 56, marginBottom: 8 },
  headerTitle: { fontFamily: 'Fredoka_700Bold', fontSize: 22, color: '#0A1C30', marginBottom: 8 },

  countBadge: {
    backgroundColor: '#E8F2FA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  countBadgeDark: { backgroundColor: 'rgba(46,110,201,0.15)' },
  countBadgeText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 13, color: '#2E6EC9' },

  inputWrap: { marginTop: 4 },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#B0C8D8',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Geologica_500Medium',
    color: '#0A1C30',
  },
  inputDark: { backgroundColor: '#1A2E3E', borderColor: '#2A4A60', color: '#DDE8D8' },

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

  hint: { fontFamily: 'Fredoka_500Medium', fontSize: 15, color: '#7A8A80' },
});
