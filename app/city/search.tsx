import React, { useState, useCallback } from 'react';
import {
  View, StyleSheet, TextInput, FlatList, TouchableOpacity,
  ActivityIndicator, useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import LocaleText from '../../src/components/LocaleText';
import AppBackground from '../../src/components/AppBackground';
import { useCityStore } from '../../src/stores/cityStore';
import type { CitySummary } from '../../src/services/api';

export default function CitySearchScreen() {
  const { t } = useTranslation('tabs');
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const { searchCities } = useCityStore();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CitySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

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
                <LocaleText style={[styles.cityMeta, isDark && { color: '#8A9A80' }]}>
                  {t('city.levelLabel', { level: item.level })} · {t('city.memberCount', { count: item.memberCount, max: item.maxMembers })}
                </LocaleText>
                {item.description ? (
                  <LocaleText style={[styles.cityDesc, isDark && { color: '#667080' }]} numberOfLines={1}>
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
  searchRow: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
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
  cityName: { fontFamily: 'Fredoka_700Bold', fontSize: 17, color: '#0A1C30', marginBottom: 3 },
  cityMeta: { fontFamily: 'Fredoka_500Medium', fontSize: 13, color: '#5A7090', marginBottom: 2 },
  cityDesc: { fontFamily: 'Fredoka_400Regular', fontSize: 12, color: '#7A8A90' },
  chevron: { fontSize: 24, color: '#5A8AB0' },
});
