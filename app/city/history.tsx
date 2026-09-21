import React, { useEffect, useState, useCallback } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, useColorScheme,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import LocaleText from '../../src/components/LocaleText';
import AppBackground from '../../src/components/AppBackground';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { api } from '../../src/services/api';
import type { CityHistoryEvent } from '../../src/services/api';

const PRIMARY      = '#2E6EC9';
const HISTORY_ICON = require('../../assets/img/city/cityHistory.png');

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const dd  = String(d.getDate()).padStart(2, '0');
  const mm  = String(d.getMonth() + 1).padStart(2, '0');
  const yy  = String(d.getFullYear()).slice(-2);
  const hh  = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yy} ${hh}:${min}`;
}

const EVENT_ICONS: Record<string, string> = {
  CITY_CREATED: '🏙️',
  ROLE_CHANGED: '👑',
  CITY_LEVEL_UP: '⬆️',
};

const EVENT_COLORS: Record<string, string> = {
  CITY_CREATED: '#2E6EC9',
  ROLE_CHANGED: '#9A6FD0',
  CITY_LEVEL_UP: '#2A9A4A',
};

const EVENT_COLORS_DARK: Record<string, string> = {
  CITY_CREATED: '#4A8EE8',
  ROLE_CHANGED: '#B88AEC',
  CITY_LEVEL_UP: '#4ABF6A',
};

export default function CityHistoryScreen() {
  const { t } = useTranslation('tabs');
  const { id: cityId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const theme = useAppTheme();

  const [events, setEvents] = useState<CityHistoryEvent[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    if (!cityId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCityHistory(cityId, p);
      setEvents(data.events);
      setTotal(data.total);
      setPageSize(data.pageSize);
      setPage(p);
    } catch {
      setError(t('city.history.loadError'));
    } finally {
      setLoading(false);
    }
  }, [cityId, t]);

  useEffect(() => { load(1); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function renderEventText(ev: CityHistoryEvent) {
    const eventColors = isDark ? EVENT_COLORS_DARK : EVENT_COLORS;
    const color = eventColors[ev.eventType] ?? theme.text;

    if (ev.eventType === 'CITY_CREATED') {
      return (
        <View style={styles.inlineRow}>
          <TouchableOpacity
            onPress={ev.actorId ? () => router.push(`/user-profile/${ev.actorId}`) : undefined}
            activeOpacity={ev.actorId ? 0.7 : 1}
          >
            <LocaleText style={[styles.link, { color }]}>{ev.actorName}</LocaleText>
          </TouchableOpacity>
          <LocaleText style={[styles.eventText, { color: theme.text }]}>
            {' '}{t('city.history.cityCreated')}
          </LocaleText>
        </View>
      );
    }

    if (ev.eventType === 'CITY_LEVEL_UP') {
      return (
        <LocaleText style={[styles.eventText, { color: theme.text }]}>
          {t('city.history.levelUp', { level: ev.toLevel })}
        </LocaleText>
      );
    }

    if (ev.eventType === 'ROLE_CHANGED') {
      const fromRole = ev.fromRole ? t(`city.roles.${ev.fromRole}`) : '?';
      const toRole = ev.toRole ? t(`city.roles.${ev.toRole}`) : '?';
      return (
        <View style={styles.inlineRow}>
          <TouchableOpacity
            onPress={ev.actorId ? () => router.push(`/user-profile/${ev.actorId}`) : undefined}
            activeOpacity={ev.actorId ? 0.7 : 1}
          >
            <LocaleText style={[styles.link, { color }]}>{ev.actorName}</LocaleText>
          </TouchableOpacity>
          <LocaleText style={[styles.eventText, { color: theme.text }]}>
            {' '}{t('city.history.roleChanged1')}{' '}
          </LocaleText>
          <TouchableOpacity
            onPress={ev.targetId ? () => router.push(`/user-profile/${ev.targetId}`) : undefined}
            activeOpacity={ev.targetId ? 0.7 : 1}
          >
            <LocaleText style={[styles.link, { color }]}>{ev.targetName ?? '?'}</LocaleText>
          </TouchableOpacity>
          <LocaleText style={[styles.eventText, { color: theme.text }]}>
            {' '}{t('city.history.roleChanged2', { from: fromRole, to: toRole })}
          </LocaleText>
        </View>
      );
    }

    return <LocaleText style={[styles.eventText, { color: theme.text }]}>{ev.eventType}</LocaleText>;
  }

  return (
    <View style={styles.container}>
      <AppBackground style={[styles.bg, isDark && styles.bgDark]}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <View style={[styles.hero, { backgroundColor: isDark ? '#1A2E3E' : '#FFFFFF' }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
              <LocaleText style={[styles.backText, { color: isDark ? '#8AAFD4' : PRIMARY }]}>‹</LocaleText>
            </TouchableOpacity>
            <View style={styles.heroCenter}>
              <Image source={HISTORY_ICON} style={styles.heroIcon} contentFit="contain" />
              <View style={styles.heroTextWrap}>
                <LocaleText style={[styles.heroTitle, { color: theme.text }]}>
                  {t('city.sections.history')}
                </LocaleText>
                <LocaleText style={[styles.heroSub, { color: theme.textMuted }]}>
                  {t('city.history.headerDesc')}
                </LocaleText>
              </View>
            </View>
            <View style={{ width: 36 }} />
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={isDark ? '#6BAED0' : PRIMARY} />
            </View>
          ) : error ? (
            <View style={styles.center}>
              <LocaleText style={[styles.errorText, { color: theme.textMuted }]}>{error}</LocaleText>
            </View>
          ) : events.length === 0 ? (
            <View style={styles.center}>
              <LocaleText style={[styles.emptyText, { color: theme.textMuted }]}>
                {t('city.history.empty')}
              </LocaleText>
            </View>
          ) : (
            <>
              <View style={[styles.card, { backgroundColor: isDark ? '#1A2E3E' : '#FFFFFF' }]}>
                {events.map((ev, idx) => {
                  const eventColors = isDark ? EVENT_COLORS_DARK : EVENT_COLORS;
                  const accentColor = eventColors[ev.eventType] ?? theme.text;
                  const isLast = idx === events.length - 1;
                  return (
                    <View key={ev.id} style={[styles.eventRow, !isLast && { borderBottomColor: theme.divider, borderBottomWidth: 1 }]}>
                      <View style={styles.timelineCol}>
                        <View style={[styles.dot, { backgroundColor: accentColor }]} />
                        {!isLast && <View style={[styles.line, { backgroundColor: theme.divider }]} />}
                      </View>
                      <View style={styles.eventContent}>
                        <View style={styles.eventHeaderRow}>
                          <LocaleText style={[styles.eventTypeLabel, { color: accentColor }]}>
                            {EVENT_ICONS[ev.eventType]} {t(`city.history.types.${ev.eventType}`)}
                          </LocaleText>
                          <LocaleText style={[styles.eventDate, { color: theme.textMuted }]}>
                            {fmtDate(ev.createdAt)}
                          </LocaleText>
                        </View>
                        <View style={styles.eventBody}>
                          {renderEventText(ev)}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>

              {totalPages > 1 && (
                <View style={styles.pagination}>
                  <TouchableOpacity
                    style={[styles.pageBtn, { backgroundColor: isDark ? '#1A2E3E' : '#FFFFFF' }, page === 1 && styles.pageBtnOff]}
                    onPress={() => load(page - 1)}
                    disabled={page === 1}
                    activeOpacity={0.7}
                  >
                    <LocaleText style={[styles.pageBtnText, { color: isDark ? '#6BAED0' : PRIMARY }, page === 1 && styles.pageBtnTextOff]}>◀</LocaleText>
                  </TouchableOpacity>
                  <LocaleText style={[styles.pageIndicator, { color: theme.textMuted }]}>
                    {page} / {totalPages}
                  </LocaleText>
                  <TouchableOpacity
                    style={[styles.pageBtn, { backgroundColor: isDark ? '#1A2E3E' : '#FFFFFF' }, page === totalPages && styles.pageBtnOff]}
                    onPress={() => load(page + 1)}
                    disabled={page === totalPages}
                    activeOpacity={0.7}
                  >
                    <LocaleText style={[styles.pageBtnText, { color: isDark ? '#6BAED0' : PRIMARY }, page === totalPages && styles.pageBtnTextOff]}>▶</LocaleText>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </AppBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bg: { flex: 1, backgroundColor: '#DCEFF6' },
  bgDark: { backgroundColor: '#0D1F2D' },
  center: { paddingVertical: 48, alignItems: 'center', justifyContent: 'center', padding: 32 },

  scroll: { paddingHorizontal: 0 },

  /* Header — same as budget */
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 10,
    marginHorizontal: 14,
  },
  backBtn: { width: 36 },
  backText: { fontSize: 28, lineHeight: 32, fontFamily: 'Fredoka_600SemiBold' },
  heroCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  heroIcon:     { width: 36, height: 36 },
  heroTextWrap: { gap: 1 },
  heroTitle:    { fontFamily: 'Fredoka_700Bold', fontSize: 20 },
  heroSub:      { fontFamily: 'Fredoka_400Regular', fontSize: 12 },

  card: {
    borderRadius: 14,
    overflow: 'hidden',
    marginHorizontal: 14,
    marginBottom: 14,
  },

  eventRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },

  timelineCol: {
    alignItems: 'center',
    width: 14,
    paddingTop: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  line: {
    flex: 1,
    width: 2,
    marginTop: 4,
  },

  eventContent: { flex: 1 },
  eventHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  eventTypeLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
  },
  eventDate: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 11,
  },
  eventBody: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  inlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  eventText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  actorName: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
  },
  link: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    textDecorationLine: 'underline',
  },

  emptyText: { fontFamily: 'Fredoka_500Medium', fontSize: 15, textAlign: 'center' },
  errorText:  { fontFamily: 'Fredoka_500Medium', fontSize: 15, textAlign: 'center' },

  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginHorizontal: 14,
    marginBottom: 14,
  },
  pageBtn: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  pageBtnOff: { opacity: 0.35 },
  pageBtnText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 16 },
  pageBtnTextOff: { color: '#8A9A80' },
  pageIndicator: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 14,
    minWidth: 50,
    textAlign: 'center',
  },
});
