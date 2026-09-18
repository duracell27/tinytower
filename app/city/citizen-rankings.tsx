import React, { useMemo, useState } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, useColorScheme,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import LocaleText from '../../src/components/LocaleText';
import AppBackground from '../../src/components/AppBackground';
import { useCityStore } from '../../src/stores/cityStore';
import { useAuthStore } from '../../src/stores/authStore';
import { getUserIcon } from '../../src/utils/userIcon';
import { formatNum } from '../../src/utils/format';
import type { CityMember } from '../../src/services/api';

const CUP_1   = require('../../assets/img/rating/1PlaceCup.png');
const CUP_2   = require('../../assets/img/rating/2PlaceCup.png');
const CUP_3   = require('../../assets/img/rating/3PlaceCup.png');
const XP_ICON = require('../../assets/img/xpIcon.png');

type Tab = 'cityXp' | 'level' | 'floors' | 'revenue';

const TAB_COLOR: Record<Tab, string> = {
  cityXp:  '#2E6EC9',
  level:   '#49AA38',
  floors:  '#E5A72E',
  revenue: '#9A6FD0',
};

const TAB_COLOR_DARK: Record<Tab, string> = {
  cityXp:  '#1A3D6E',
  level:   '#245C1E',
  floors:  '#7A5510',
  revenue: '#4A2A78',
};

type RankedMember = CityMember & { rank: number };

function sortByTab(members: CityMember[], tab: Tab): RankedMember[] {
  const val = (m: CityMember) => {
    if (tab === 'cityXp')  return m.cityXp ?? 0;
    if (tab === 'level')   return m.playerLevel;
    if (tab === 'floors')  return m.floorCount ?? 0;
    return m.revenuePerMin ?? 0;
  };
  return [...members].sort((a, b) => val(b) - val(a)).map((m, i) => ({ ...m, rank: i + 1 }));
}

export default function CitizenRankingsScreen() {
  const { t } = useTranslation('tabs');
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { city } = useCityStore();
  const myId = useAuthStore((s) => s.player?.id);
  const [tab, setTab] = useState<Tab>('cityXp');

  const ranked: RankedMember[] = useMemo(
    () => sortByTab(city?.members ?? [], tab),
    [city, tab],
  );

  const TABS: { key: Tab; label: string }[] = [
    { key: 'cityXp',  label: t('city.citizenRanking.cityXp') },
    { key: 'level',   label: t('city.citizenRanking.tabLevel') },
    { key: 'floors',  label: t('city.citizenRanking.tabFloors') },
    { key: 'revenue', label: t('city.citizenRanking.tabRevenue') },
  ];

  function getMemberValue(m: CityMember): string {
    if (tab === 'cityXp')  return (m.cityXp ?? 0).toLocaleString();
    if (tab === 'level')   return String(m.playerLevel);
    if (tab === 'floors')  return String(m.floorCount ?? 0);
    return formatNum(m.revenuePerMin ?? 0);
  }

  return (
    <AppBackground style={[styles.bg, isDark && styles.bgDark]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 4 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Back + title */}
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <LocaleText style={[styles.backIcon, isDark && { color: '#6BAED0' }]}>‹</LocaleText>
          </TouchableOpacity>
          <View style={styles.titleCenter}>
            <Image source={CUP_1} style={styles.headerCup} contentFit="contain" />
            <View>
              <LocaleText style={[styles.headerTitle, isDark && { color: '#DDE8D8' }]}>
                {t('city.citizenRanking.title')}
              </LocaleText>
              {city && (
                <LocaleText style={[styles.headerCityName, isDark && { color: '#8A9A80' }]}>
                  {city.name}
                </LocaleText>
              )}
            </View>
          </View>
          <View style={styles.backPlaceholder} />
        </View>

        {/* Members-style block */}
        <View style={[styles.block, styles.membersBlock]}>
          {/* Header — color follows active tab */}
          <View style={[styles.membersHeader, { backgroundColor: isDark ? TAB_COLOR_DARK[tab] : TAB_COLOR[tab] }]}>
            {TABS.map((tabItem) => {
              const isActive = tab === tabItem.key;
              return (
                <TouchableOpacity
                  key={tabItem.key}
                  style={[
                    styles.tabBadge,
                    isDark && styles.tabBadgeDark,
                    isActive && (isDark ? styles.tabBadgeActiveDark : styles.tabBadgeActive),
                  ]}
                  onPress={() => setTab(tabItem.key)}
                  activeOpacity={0.75}
                >
                  <LocaleText style={[styles.tabText, isActive && styles.tabTextActive]}>
                    {tabItem.label}
                  </LocaleText>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Light-blue list area */}
          <View style={[styles.membersListBg, isDark && styles.membersListBgDark]}>
            {ranked.length === 0 ? (
              <LocaleText style={[styles.emptyText, isDark && { color: '#8A9A80' }]}>
                {t('city.citizenRanking.empty')}
              </LocaleText>
            ) : ranked.map((item) => {
              const isMe = item.playerId === myId;
              const isTop3 = item.rank <= 3;

              return (
                <TouchableOpacity
                  key={item.playerId}
                  style={[styles.memberRow, isDark && styles.memberRowDark, isMe && styles.memberRowMe]}
                  onPress={() => router.push(`/user-profile/${item.playerId}`)}
                  activeOpacity={0.7}
                >
                  {isTop3 ? (
                    <View style={styles.trophyWrap}>
                      <Image
                        source={item.rank === 1 ? CUP_1 : item.rank === 2 ? CUP_2 : CUP_3}
                        style={item.rank === 1 ? styles.trophy1 : item.rank === 2 ? styles.trophy2 : styles.trophy3}
                        contentFit="contain"
                      />
                    </View>
                  ) : (
                    <LocaleText style={[styles.memberRank, isDark && { color: '#5A7090' }]}>
                      {item.rank}
                    </LocaleText>
                  )}

                  <View style={[styles.memberRankDivider, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />

                  <Image source={getUserIcon(item.playerLevel)} style={styles.avatar} contentFit="cover" />

                  <View style={styles.memberInfo}>
                    <LocaleText style={[styles.memberName, isDark && { color: '#DDE8D8' }]} numberOfLines={1}>
                      {item.playerName}
                    </LocaleText>
                    <LocaleText style={[styles.memberMeta, isDark && { color: '#8A9A80' }]} numberOfLines={1}>
                      {t(`city.roles.${item.role}`)}
                    </LocaleText>
                  </View>

                  {/* Right value block */}
                  <View style={styles.valueBlock}>
                    <LocaleText style={[styles.memberXp, { color: TAB_COLOR[tab] }]}>
                      {getMemberValue(item)}
                    </LocaleText>
                    <LocaleText style={styles.valueLabel}>
                      {t(`city.citizenRanking.label_${tab}`)}
                    </LocaleText>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#F0F8FF' },
  bgDark: { backgroundColor: '#0D1F2D' },
  scroll: { paddingBottom: 40 },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
  },
  backBtn: { width: 32 },
  backPlaceholder: { width: 32 },
  backIcon: { fontSize: 34, color: '#2E6EC9', lineHeight: 36 },
  titleCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  headerCup: { width: 44, height: 44 },
  headerTitle: { fontFamily: 'Fredoka_700Bold', fontSize: 24, color: '#0A1C30' },
  headerCityName: { fontFamily: 'Fredoka_500Medium', fontSize: 13, color: '#5A7090' },

  // ── Members block (copied from city.tsx) ─────────────
  block: { marginHorizontal: 16, marginBottom: 16 },
  membersBlock: { borderRadius: 16, overflow: 'hidden' },

  membersHeader: {
    flexDirection: 'row',
    backgroundColor: '#2E6EC9', // overridden inline per tab
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 6,
  },
  tabBadge: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20,
    paddingVertical: 6,
  },
  tabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.38)' },
  tabBadgeDark: { backgroundColor: 'rgba(255,255,255,0.12)' },
  tabBadgeActiveDark: { backgroundColor: 'rgba(255,255,255,0.28)' },
  tabText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 13, color: 'rgba(255,255,255,0.65)' },
  tabTextActive: { color: '#FFFFFF' },

  membersListBg: { backgroundColor: '#E8F2FA', padding: 10, gap: 6 },
  membersListBgDark: { backgroundColor: 'rgba(30,60,100,0.35)' },

  // ── Member row (copied from city.tsx) ─────────────────
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 0,
  },
  memberRowDark: { backgroundColor: '#1A2E3E' },
  memberRowMe: {
    borderWidth: 2,
    borderColor: '#49AA38',
    shadowColor: '#49AA38',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },

  trophyWrap: { minWidth: 22, alignItems: 'center', justifyContent: 'center' },
  trophy1: { width: 24, height: 24 },
  trophy2: { width: 20, height: 20 },
  trophy3: { width: 17, height: 17 },

  memberRank: {
    fontFamily: 'Fredoka_700Bold', fontSize: 15,
    color: '#8A9A80', minWidth: 22, textAlign: 'center',
  },
  memberRankDivider: {
    width: 1, height: 32,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginHorizontal: 10,
  },
  avatar: { width: 32, height: 32, borderRadius: 16, overflow: 'hidden', marginRight: 8 },

  memberInfo: { flex: 1 },
  memberName: { fontFamily: 'Fredoka_600SemiBold', fontSize: 15, color: '#0A1C30', marginBottom: 2 },
  memberMeta: { fontFamily: 'Fredoka_400Regular', fontSize: 12, color: '#5A7090' },

  valueBlock: { alignItems: 'flex-end', gap: 2 },
  valueLabel: { fontFamily: 'Fredoka_400Regular', fontSize: 11, color: '#9AAAB8' },

  memberXpRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  memberXp: { fontFamily: 'Fredoka_700Bold', fontSize: 17, color: '#2E6EC9' },

  emptyText: {
    fontFamily: 'Fredoka_500Medium', fontSize: 14,
    color: '#7A8A80', textAlign: 'center', paddingVertical: 20,
  },
});
