import React, { useEffect, useState } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  useColorScheme, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LocaleText from '../../src/components/LocaleText';
import AppBackground from '../../src/components/AppBackground';
import { useCityStore } from '../../src/stores/cityStore';
import { useAuthStore } from '../../src/stores/authStore';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { formatXp } from '../../src/utils/format';
import { api } from '../../src/services/api';
import type { CityDetail, CityRole, CityBuildingDto } from '../../src/services/api';

const BUILDING_ICONS: Record<string, any> = {
  MOTOR_POOL:      require('../../assets/img/city/cityBuildingAutopark.png'),
  AD_AGENCY:       require('../../assets/img/city/cityBuildingAdvertisingagency.png'),
  CITY_BANK:       require('../../assets/img/city/cityBuildingCityBank.png'),
  BUSINESS_SCHOOL: require('../../assets/img/city/cityBuildingSchoolofBusiness.png'),
  STATE_ACADEMY:   require('../../assets/img/city/cityBuildingStateAcademy.png'),
  VIP_CLUB:        require('../../assets/img/city/cityBuildingVIPClub.png'),
  VIP_HOTEL:       require('../../assets/img/city/cityBuildingVIPHotel.png'),
};

const STAR_EMPTY = require('../../assets/img/starEmpty.png');
const STAR_FULL  = require('../../assets/img/starFull.png');
const STAR_66    = require('../../assets/img/star66.png');
const STAR_33    = require('../../assets/img/star33.png');
const XP_ICON     = require('../../assets/img/xpIcon.png');
const WORKER_ICON = require('../../assets/img/worker.png');
const HAPPY_ICON  = require('../../assets/img/happySmile.png');
const CITY_ICON   = require('../../assets/img/city/cityBuildings.png');

const MAX_BUILDING_LEVEL = 15;
const TOTAL_BUILDING_TYPES = Object.keys(BUILDING_ICONS).length;
const MEMBERS_PER_PAGE = 10;
const ROLE_ORDER: CityRole[] = ['NEWBIE', 'CITIZEN', 'BUSINESSMAN', 'ADVISOR', 'VICE_MAYOR', 'ACTING_MAYOR', 'MAYOR'];

const cityStarSource = (avg: number, idx: number) => {
  const rem = avg - idx;
  if (rem >= 1)     return STAR_FULL;
  if (rem >= 2 / 3) return STAR_66;
  if (rem >= 1 / 3) return STAR_33;
  return STAR_EMPTY;
};

function formatFoundedDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function CityDetailScreen() {
  const { t } = useTranslation('tabs');
  const isDark = useColorScheme() === 'dark';
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const player = useAuthStore((s) => s.player);
  const { getCityById } = useCityStore();

  const [city, setCity] = useState<CityDetail | null>(null);
  const [buildings, setBuildings] = useState<CityBuildingDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberPage, setMemberPage] = useState(0);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getCityById(id);
      setCity(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  useFocusEffect(
    React.useCallback(() => {
      if (id) api.getCityBuildings(id).then(setBuildings).catch(() => {});
    }, [id]),
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

  if (!city) {
    return (
      <AppBackground style={[styles.bg, isDark && styles.bgDark]}>
        <View style={[styles.center, { paddingTop: insets.top }]}>
          <LocaleText style={styles.errorText}>{t('city.errors.load')}</LocaleText>
        </View>
      </AppBackground>
    );
  }

  const xpPercent = city.xpForNextLevel ? Math.min(city.xp / city.xpForNextLevel, 1) : 1;
  const activeBuildings = buildings.filter((b) => b.state === 'ACTIVE' && b.level > 0);
  const totalBuildingLevel = buildings.reduce((sum, b) => sum + b.level, 0);
  const starsAvg = (totalBuildingLevel / (TOTAL_BUILDING_TYPES * MAX_BUILDING_LEVEL)) * 5;

  const sortedMembers = [...city.members].sort(
    (a, b) => ROLE_ORDER.indexOf(b.role) - ROLE_ORDER.indexOf(a.role),
  );
  const totalPages = Math.max(1, Math.ceil(sortedMembers.length / MEMBERS_PER_PAGE));
  const pagedMembers = sortedMembers.slice(
    memberPage * MEMBERS_PER_PAGE,
    (memberPage + 1) * MEMBERS_PER_PAGE,
  );

  return (
    <AppBackground style={[styles.bg, isDark && styles.bgDark]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── BACK BUTTON ───────────────────────────────── */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <LocaleText style={styles.backBtnText}>‹</LocaleText>
        </TouchableOpacity>

        {/* ── HERO CARD ─────────────────────────────────── */}
        <View style={[styles.heroCard, { backgroundColor: theme.surface }]}>

          {/* Stars */}
          <View style={styles.starsRow}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Image key={i} source={cityStarSource(starsAvg, i)} style={styles.star} contentFit="contain" />
            ))}
          </View>

          {/* City name with icon on both sides */}
          <View style={styles.cityNameRow}>
            <Image source={CITY_ICON} style={styles.cityNameIcon} contentFit="contain" />
            <LocaleText style={[styles.cityHeroName, { color: theme.text }]}>{city.name}</LocaleText>
            <Image source={CITY_ICON} style={styles.cityNameIcon} contentFit="contain" />
          </View>

          <LocaleText style={[styles.foundedDate, { color: theme.textMuted }]}>
            {t('city.founded', { date: formatFoundedDate(city.createdAt) })}
          </LocaleText>

          {/* Active buildings strip */}
          {activeBuildings.length > 0 && (
            <>
              <View style={styles.buildingsDivider} />
              {(() => {
                const n = activeBuildings.length;
                const rows = n > 5
                  ? [activeBuildings.slice(0, Math.ceil(n / 2)), activeBuildings.slice(Math.ceil(n / 2))]
                  : [activeBuildings];
                return rows.map((row, ri) => (
                  <View key={ri} style={styles.buildingsRow}>
                    {row.map((b) => (
                      <View key={b.buildingType} style={styles.buildingItem}>
                        <Image
                          source={BUILDING_ICONS[b.buildingType]}
                          style={styles.buildingIcon}
                          contentFit="contain"
                        />
                        <View style={styles.buildingLevelBadge}>
                          <LocaleText style={styles.buildingLevelText}>{b.level}</LocaleText>
                        </View>
                        {b.isBoosted && b.boostMultiplier != null && (
                          <View style={[styles.buildingBoostBadge, { backgroundColor: b.boostMultiplier < 2 ? '#C87E00' : '#2592AB' }]}>
                            <LocaleText style={styles.buildingBoostText}>×{b.boostMultiplier % 1 === 0 ? b.boostMultiplier : b.boostMultiplier.toFixed(1)}</LocaleText>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                ));
              })()}
              <View style={styles.buildingsDivider} />
            </>
          )}

          {/* Level + XP row */}
          <View style={styles.levelXpRow}>
            <View style={styles.levelXpLeft}>
              <View style={styles.levelBadge}>
                <LocaleText style={styles.levelText}>
                  {t('city.levelLabel', { level: city.level })}
                </LocaleText>
              </View>
              {city.xpForNextLevel != null && city.xpForNextLevel > 0 && (
                <View style={styles.xpPercentBadge}>
                  <LocaleText style={styles.xpPercentText}>
                    {(Math.min(city.xp / city.xpForNextLevel, 1) * 100).toFixed(1)}%
                  </LocaleText>
                </View>
              )}
            </View>
            <View style={styles.xpValueRow}>
              <LocaleText style={[styles.xpNum, { color: '#2E6EC9' }]}>
                {formatXp(city.xp)}
                {city.xpForNextLevel != null ? ` / ${formatXp(city.xpForNextLevel)}` : ''}
              </LocaleText>
              <Image source={XP_ICON} style={styles.xpIconImg} contentFit="contain" />
            </View>
          </View>

          {/* XP bar */}
          <View style={[styles.xpBarBg, { backgroundColor: 'rgba(46,110,201,0.15)' }]}>
            <View style={[styles.xpBarFill, { width: `${Math.round(xpPercent * 100)}%` as any }]} />
          </View>

          {/* Workers / Happy divider */}
          <View style={[styles.workersDividerLine, { backgroundColor: '#2E6EC9', opacity: 0.5 }]} />

          {/* Workers row */}
          <View style={styles.workerStatsRow}>
            <View style={styles.workerStatItem}>
              <Image source={WORKER_ICON} style={styles.workerStatIcon} contentFit="contain" />
              <View style={styles.workerStatText}>
                <LocaleText style={[styles.workerStatLabel, { color: theme.textMuted }]}>{t('city.allWorkers')}</LocaleText>
                <LocaleText style={[styles.workerStatValue, { color: theme.text }]}>
                  {city.totalWorkers}
                </LocaleText>
              </View>
            </View>
            <View style={[styles.workerStatDivider, { backgroundColor: '#2E6EC9', opacity: 0.5 }]} />
            <View style={styles.workerStatItem}>
              <Image source={HAPPY_ICON} style={styles.workerStatIcon} contentFit="contain" />
              <View style={styles.workerStatText}>
                <LocaleText style={[styles.workerStatLabel, { color: theme.textMuted }]}>{t('city.happyWorkers')}</LocaleText>
                <LocaleText style={[styles.workerStatValue, { color: theme.text }]}>
                  {city.happyWorkers} / {city.totalWorkers}
                </LocaleText>
              </View>
            </View>
          </View>
        </View>

        {/* ── MEMBERS ───────────────────────────────────── */}
        <View style={[styles.block, styles.membersBlock, isDark && styles.membersBlockDark]}>
          <View style={styles.membersHeader}>
            <LocaleText style={[styles.sectionTitle, { color: '#FFFFFF' }]}>{t('city.members')}</LocaleText>
            <View style={[styles.memberCountBadge, isDark && styles.memberCountBadgeDark]}>
              <LocaleText style={styles.memberCountText}>{city.memberCount} / {city.maxMembers}</LocaleText>
            </View>
          </View>

          <View style={[styles.membersListBg, isDark && styles.membersListBgDark]}>
            {pagedMembers.map((member, idx) => {
              const globalIdx = memberPage * MEMBERS_PER_PAGE + idx + 1;
              const isMe = member.playerId === player?.id;

              return (
                <TouchableOpacity
                  key={member.playerId}
                  style={[styles.memberRow, isDark && styles.memberRowDark]}
                  onPress={() => router.push(`/user-profile/${member.playerId}`)}
                  activeOpacity={0.7}
                >
                  <LocaleText style={[styles.memberRank, isDark && { color: '#5A7090' }, isMe && { color: '#2E6EC9' }]}>
                    {globalIdx}
                  </LocaleText>

                  <View style={[styles.memberRankDivider, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />

                  <View style={styles.memberInfo}>
                    <LocaleText style={[styles.memberName, isDark && { color: '#DDE8D8' }]}>
                      {member.playerName}
                    </LocaleText>
                    <LocaleText style={[styles.memberMeta, isDark && { color: '#8A9A80' }]}>
                      {t(`city.roles.${member.role}`)} · {t('city.detail.level', { level: member.playerLevel })}
                    </LocaleText>
                  </View>

                  <View style={styles.memberXpRow}>
                    <LocaleText style={[styles.memberXp, isDark && { color: '#6BAED0' }]}>
                      {formatXp(member.cityXp ?? 0)}
                    </LocaleText>
                    <Image source={XP_ICON} style={styles.memberXpIcon} contentFit="contain" />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {totalPages > 1 && (
            <View style={styles.pagination}>
              <TouchableOpacity
                style={[styles.pageBtn, isDark && styles.pageBtnDark, memberPage === 0 && styles.pageBtnOff]}
                onPress={() => setMemberPage((p) => Math.max(0, p - 1))}
                disabled={memberPage === 0}
                activeOpacity={0.7}
              >
                <LocaleText style={[styles.pageBtnText, memberPage === 0 && styles.pageBtnTextOff]}>◀</LocaleText>
              </TouchableOpacity>
              <LocaleText style={[styles.pageIndicator, isDark && { color: '#8A9A80' }]}>
                {memberPage + 1} / {totalPages}
              </LocaleText>
              <TouchableOpacity
                style={[styles.pageBtn, isDark && styles.pageBtnDark, memberPage === totalPages - 1 && styles.pageBtnOff]}
                onPress={() => setMemberPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={memberPage === totalPages - 1}
                activeOpacity={0.7}
              >
                <LocaleText style={[styles.pageBtnText, memberPage === totalPages - 1 && styles.pageBtnTextOff]}>▶</LocaleText>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── DESCRIPTION ───────────────────────────────── */}
        {city.description ? (
          <View style={[styles.block, styles.descBlock, isDark && styles.descBlockDark]}>
            <LocaleText style={[styles.sectionTitle, { marginBottom: 8 }, isDark && { color: '#DDE8D8' }]}>
              {t('city.sections.description')}
            </LocaleText>
            <LocaleText style={[styles.descText, isDark && { color: '#9AAAB8' }]}>{city.description}</LocaleText>
          </View>
        ) : null}

        {/* ── NAV ROWS ──────────────────────────────────── */}
        <View style={[styles.block, styles.navBlock, isDark && styles.navBlockDark]}>
          <TouchableOpacity
            style={styles.navRow}
            onPress={() => router.push(`/city/citizen-rankings?cityId=${city.id}`)}
            activeOpacity={0.7}
          >
            <Image source={require('../../assets/img/menu/rating.png')} style={styles.navImg} contentFit="contain" />
            <LocaleText style={[styles.navLabel, isDark && { color: '#DDE8D8' }]}>{t('city.citizenRankings')}</LocaleText>
            <LocaleText style={styles.navChevron}>›</LocaleText>
          </TouchableOpacity>
          <View style={styles.navDivider} />
          <TouchableOpacity style={styles.navRow} onPress={() => router.push('/city/rankings')} activeOpacity={0.7}>
            <Image source={require('../../assets/img/rating/1PlaceCup.png')} style={styles.navImg} contentFit="contain" />
            <LocaleText style={[styles.navLabel, isDark && { color: '#DDE8D8' }]}>{t('city.rankings.button')}</LocaleText>
            <LocaleText style={styles.navChevron}>›</LocaleText>
          </TouchableOpacity>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#DCEFF6' },
  bgDark: { backgroundColor: '#0D1F2D' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontFamily: 'Fredoka_500Medium', fontSize: 15, color: '#7A8A80' },
  scroll: { paddingBottom: 8 },

  backBtn: {
    marginHorizontal: 16,
    marginBottom: 8,
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(46,110,201,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { fontFamily: 'Fredoka_700Bold', fontSize: 26, color: '#2E6EC9', lineHeight: 26, includeFontPadding: false },

  // ── Hero card ──────────────────────────────────────
  heroCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
  },

  starsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  star: { width: 22, height: 22 },

  cityNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  cityNameIcon: { width: 22, height: 22 },
  cityHeroName: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 24,
    textAlign: 'center',
    flexShrink: 1,
  },
  foundedDate: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
    marginBottom: 18,
  },

  buildingsDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#2E6EC9',
    opacity: 0.5,
    marginVertical: 8,
    alignSelf: 'center',
  },
  buildingsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 4,
  },
  buildingItem: { position: 'relative', alignItems: 'center' },
  buildingIcon: { width: 46, height: 46 },
  buildingLevelBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#2E6EC9',
    borderRadius: 7,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  buildingLevelText: { fontFamily: 'Fredoka_700Bold', fontSize: 10, color: '#FFFFFF', lineHeight: 12 },
  buildingBoostBadge: {
    position: 'absolute',
    top: -4,
    left: -4,
    borderRadius: 7,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  buildingBoostText: { fontFamily: 'Fredoka_700Bold', fontSize: 10, color: '#FFFFFF', lineHeight: 12 },

  levelXpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  levelXpLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  levelBadge: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 5, backgroundColor: 'rgba(46,110,201,0.13)' },
  levelText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 14, color: '#2E6EC9' },
  xpPercentBadge: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: 'rgba(46,110,201,0.08)' },
  xpPercentText: { fontFamily: 'Fredoka_500Medium', fontSize: 11, color: '#2E6EC9' },
  xpValueRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  xpNum: { fontFamily: 'Fredoka_600SemiBold', fontSize: 13 },
  xpIconImg: { width: 18, height: 18 },

  xpBarBg: { width: '100%', height: 7, borderRadius: 4, overflow: 'hidden', marginBottom: 14 },
  xpBarFill: { height: '100%', backgroundColor: '#2E6EC9', borderRadius: 4 },

  workersDividerLine: { width: '100%', height: 1, marginBottom: 12 },
  workerStatsRow: { flexDirection: 'row', width: '100%', alignItems: 'center' },
  workerStatItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8 },
  workerStatIcon: { width: 32, height: 32 },
  workerStatText: { flex: 1 },
  workerStatLabel: { fontFamily: 'Fredoka_400Regular', fontSize: 11, marginBottom: 1 },
  workerStatValue: { fontFamily: 'Fredoka_700Bold', fontSize: 16 },
  workerStatDivider: { width: 1, height: 36, alignSelf: 'center' },

  // ── Generic block ──────────────────────────────────
  block: { marginHorizontal: 16, marginBottom: 16 },

  // ── Members ────────────────────────────────────────
  membersBlock: { borderRadius: 16, overflow: 'hidden' },
  membersBlockDark: {},
  membersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2E6EC9',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  membersListBg: { backgroundColor: '#E8F2FA', padding: 10, gap: 6 },
  membersListBgDark: { backgroundColor: 'rgba(30,60,100,0.35)' },
  sectionTitle: { fontFamily: 'Fredoka_700Bold', fontSize: 17, color: '#0A1C30' },
  memberCountBadge: { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  memberCountBadgeDark: { backgroundColor: 'rgba(255,255,255,0.15)' },
  memberCountText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 13, color: '#FFFFFF' },

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
  memberRankDivider: { width: 1, height: 32, backgroundColor: 'rgba(0,0,0,0.08)', marginHorizontal: 10 },
  memberRank: { fontFamily: 'Fredoka_700Bold', fontSize: 15, color: '#8A9A80', minWidth: 22, textAlign: 'center' },
  memberInfo: { flex: 1 },
  memberName: { fontFamily: 'Fredoka_600SemiBold', fontSize: 15, color: '#0A1C30', marginBottom: 2 },
  memberMeta: { fontFamily: 'Fredoka_400Regular', fontSize: 12, color: '#5A7090' },
  memberXpRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  memberXp: { fontFamily: 'Fredoka_600SemiBold', fontSize: 13, color: '#2E6EC9' },
  memberXpIcon: { width: 16, height: 16 },

  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 4,
  },
  pageBtn: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  pageBtnDark: { backgroundColor: '#1A2E3E' },
  pageBtnOff: { opacity: 0.35 },
  pageBtnText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 16, color: '#2E6EC9' },
  pageBtnTextOff: { color: '#8A9A80' },
  pageIndicator: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 14,
    color: '#5A7090',
    minWidth: 50,
    textAlign: 'center',
  },

  // ── Description ────────────────────────────────────
  descBlock: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16 },
  descBlockDark: { backgroundColor: '#1A2E3E' },
  descText: { fontFamily: 'Fredoka_400Regular', fontSize: 14, color: '#3A5060', lineHeight: 20 },

  // ── Nav block ──────────────────────────────────────
  navBlock: { backgroundColor: '#FFFFFF', borderRadius: 14, overflow: 'hidden', paddingVertical: 4 },
  navBlockDark: { backgroundColor: '#1A2E3E' },
  navRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  navImg: { width: 26, height: 26 },
  navLabel: { flex: 1, fontFamily: 'Fredoka_500Medium', fontSize: 15, color: '#0A1C30' },
  navChevron: { fontFamily: 'Fredoka_600SemiBold', fontSize: 22, color: '#6BAED0', lineHeight: 24 },
  navDivider: { height: 1, backgroundColor: '#2E6EC9', opacity: 0.5 },
});
