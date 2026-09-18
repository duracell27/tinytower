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

const CUP_1 = require('../../assets/img/rating/1PlaceCup.png');
const LVL_ICON = require('../../assets/img/lvlIcon.png');

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

  return (
    <AppBackground style={[styles.background, isDark && styles.backgroundDark]}>
      {/* ── Custom header ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <LocaleText style={[styles.backIcon, isDark && { color: '#6BAED0' }]}>‹</LocaleText>
          </TouchableOpacity>

          <View style={styles.titleRow}>
            <Image source={CUP_1} style={styles.cupIcon} contentFit="contain" />
            <LocaleText style={[styles.title, isDark && { color: '#DDE8D8' }]}>
              {t('city.search.title')}
            </LocaleText>
          </View>

          <View style={styles.backPlaceholder} />
        </View>

        <LocaleText style={[styles.description, isDark && { color: '#8A9A80' }]}>
          {t('city.search.description')}
        </LocaleText>

        {totalCities != null && (
          <View style={[styles.statsBadge, isDark && styles.statsBadgeDark]}>
            <LocaleText style={[styles.statsText, isDark && { color: '#6BAED0' }]}>
              {t('city.search.citiesCount', { count: totalCities })}
            </LocaleText>
          </View>
        )}
      </View>

      {/* ── Search input ── */}
      <View style={styles.searchRow}>
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

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={isDark ? '#6BAED0' : '#2E6EC9'} />
        </View>
      ) : query.length < 2 && !searched ? (
        <View style={styles.center}>
          <LocaleText style={[styles.hint, isDark && { color: '#8A9A80' }]}>{t('city.search.minChars')}</LocaleText>
        </View>
      ) : results.length === 0 && searched ? (
        <View style={styles.center}>
          <LocaleText style={[styles.hint, isDark && { color: '#8A9A80' }]}>{t('city.search.empty')}</LocaleText>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.row, isDark && styles.rowDark]}
              onPress={() => router.push(`/city/${item.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <LocaleText style={[styles.cityName, isDark && { color: '#DDE8D8' }]}>{item.name}</LocaleText>
                <View style={styles.metaRow}>
                  <Image source={LVL_ICON} style={styles.lvlIcon} contentFit="contain" />
                  <LocaleText style={[styles.cityMeta, isDark && { color: '#8A9A80' }]}>
                    {t('city.levelLabel', { level: item.level })} · {t('city.memberCount', { count: item.memberCount, max: item.maxMembers })}
                  </LocaleText>
                </View>
                {item.description ? (
                  <LocaleText style={[styles.cityDesc, isDark && { color: '#667080' }]} numberOfLines={2}>
                    {item.description}
                  </LocaleText>
                ) : null}
              </View>
              <LocaleText style={[styles.chevron, isDark && { color: '#8A9A80' }]}>›</LocaleText>
            </TouchableOpacity>
          )}
        />
      )}
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#F0F8FF' },
  backgroundDark: { backgroundColor: '#0D1F2D' },

  topBar: { paddingHorizontal: 16, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  backBtn: { width: 36 },
  backPlaceholder: { width: 36 },
  backIcon: { fontSize: 34, color: '#2E6EC9', lineHeight: 36 },
  titleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  cupIcon: { width: 28, height: 28 },
  title: { fontFamily: 'Fredoka_700Bold', fontSize: 24, color: '#0A1C30' },
  description: { fontFamily: 'Fredoka_400Regular', fontSize: 13, color: '#5A7090', marginBottom: 10, lineHeight: 18 },

  statsBadge: {
    alignSelf: 'center',
    backgroundColor: '#E8F2FA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  statsBadgeDark: { backgroundColor: 'rgba(46,110,201,0.15)' },
  statsText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 13, color: '#2E6EC9' },

  searchRow: { paddingHorizontal: 16, paddingBottom: 8 },
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hint: { fontFamily: 'Fredoka_500Medium', fontSize: 15, color: '#7A8A80' },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    gap: 12,
  },
  rowDark: { backgroundColor: '#1A2E3E' },
  rowLeft: { flex: 1 },
  cityName: { fontFamily: 'Fredoka_700Bold', fontSize: 17, color: '#0A1C30', marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  lvlIcon: { width: 15, height: 15 },
  cityMeta: { fontFamily: 'Fredoka_500Medium', fontSize: 13, color: '#5A7090' },
  cityDesc: { fontFamily: 'Fredoka_400Regular', fontSize: 12, color: '#7A8A90', lineHeight: 17 },
  chevron: { fontSize: 24, color: '#5A8AB0' },
});
