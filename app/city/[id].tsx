import React, { useEffect, useState } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Alert, useColorScheme, Dimensions,
} from 'react-native';
import { useGameStore } from '../../src/stores/gameStore';

const CARD_WIDTH = (Dimensions.get('window').width - 32 - 16) / 3; // 2×margin + 2×gap
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import LocaleText from '../../src/components/LocaleText';
import AppBackground from '../../src/components/AppBackground';
import { useCityStore } from '../../src/stores/cityStore';
import { useAuthStore } from '../../src/stores/authStore';
import type { CityDetail, CityMember, CityRole } from '../../src/services/api';

const MEMBERS_PER_PAGE = 10;
const ROLE_ORDER: CityRole[] = ['NEWBIE', 'CITIZEN', 'BUSINESSMAN', 'ADVISOR', 'VICE_MAYOR', 'ACTING_MAYOR', 'MAYOR'];

function roleRank(role: CityRole): number {
  return ROLE_ORDER.indexOf(role);
}

function canKick(actorRole: CityRole, targetRole: CityRole): boolean {
  if (actorRole === 'MAYOR') return true;
  if (actorRole === 'ACTING_MAYOR') return targetRole !== 'MAYOR';
  if (actorRole === 'VICE_MAYOR') return roleRank(targetRole) <= roleRank('ADVISOR');
  return false;
}

function canPromote(actorRole: CityRole): boolean {
  return actorRole === 'MAYOR' || actorRole === 'ACTING_MAYOR' || actorRole === 'VICE_MAYOR';
}

function formatFoundedDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' });
}

const SECTION_CARDS = [
  { key: 'budget',        icon: '💰' },
  { key: 'tasks',         icon: '📋' },
  { key: 'chat',          icon: '💬' },
  { key: 'history',       icon: '📜' },
  { key: 'buildings',     icon: '🏗️' },
  { key: 'notifications', icon: '🔔' },
] as const;

export default function CityDetailScreen() {
  const { t } = useTranslation('tabs');
  const isDark = useColorScheme() === 'dark';
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const player = useAuthStore((s) => s.player);
  const { getCityById, kickMember, changeMemberRole, leaveCity } = useCityStore();
  const showCityAlert = useGameStore((s) => s.showCityAlert);
  const showCityConfirm = useGameStore((s) => s.showCityConfirm);

  const [city, setCity] = useState<CityDetail | null>(null);
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

  const handleKick = (member: CityMember) => {
    showCityConfirm({
      title: t('city.detail.kick'),
      message: t('city.kick.confirm', { name: member.playerName }),
      confirmText: t('city.detail.kick'),
      danger: true,
      onConfirm: async () => {
        try {
          await kickMember(id!, member.playerId);
          await load();
        } catch {
          showCityAlert({ message: t('city.kick.error') });
        }
      },
    });
  };

  const handleChangeRole = (member: CityMember) => {
    const myRole = city?.myRole;
    if (!myRole) return;

    const availableRoles: CityRole[] = myRole === 'VICE_MAYOR'
      ? ['NEWBIE', 'CITIZEN', 'BUSINESSMAN', 'ADVISOR']
      : ['NEWBIE', 'CITIZEN', 'BUSINESSMAN', 'ADVISOR', 'VICE_MAYOR', 'ACTING_MAYOR', 'MAYOR'];

    const options = availableRoles
      .filter((r) => r !== member.role)
      .map((role) => ({
        text: t(`city.roles.${role}`),
        onPress: async () => {
          try {
            await changeMemberRole(id!, member.playerId, role);
            await load();
          } catch {
            showCityAlert({ message: t('city.roleChange.error') });
          }
        },
      }));

    // Role change keeps native alert (multi-option picker)
    Alert.alert(t('city.roleChange.title'), member.playerName, [
      ...options,
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleLeave = () => {
    const isMayor = city?.myRole === 'MAYOR';
    showCityConfirm({
      title: t('city.leaveCity'),
      message: isMayor ? t('city.leaveCityMayorWarning') : t('city.leaveCityConfirm'),
      confirmText: t('city.leaveCity'),
      danger: true,
      onConfirm: async () => {
        try {
          await leaveCity();
          router.back();
        } catch {
          showCityAlert({ message: t('city.errors.leave') });
        }
      },
    });
  };

  if (loading) {
    return (
      <AppBackground style={[styles.bg, isDark && styles.bgDark]}>
        <View style={styles.center}>
          <ActivityIndicator color={isDark ? '#6BAED0' : '#2E6EC9'} />
        </View>
      </AppBackground>
    );
  }

  if (!city) {
    return (
      <AppBackground style={[styles.bg, isDark && styles.bgDark]}>
        <View style={styles.center}>
          <LocaleText style={styles.errorText}>{t('city.errors.load')}</LocaleText>
        </View>
      </AppBackground>
    );
  }

  const myRole = city.myRole;
  const isMyCity = !!myRole;
  const xpPercent = city.xpForNextLevel ? Math.min(city.xp / city.xpForNextLevel, 1) : 1;
  const totalPages = Math.max(1, Math.ceil(city.members.length / MEMBERS_PER_PAGE));
  const pagedMembers = city.members.slice(
    memberPage * MEMBERS_PER_PAGE,
    (memberPage + 1) * MEMBERS_PER_PAGE,
  );

  return (
    <AppBackground style={[styles.bg, isDark && styles.bgDark]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── HERO CARD ─────────────────────────────────── */}
        <View style={[styles.heroCard, isDark && styles.heroCardDark]}>

          {/* Stars */}
          <View style={styles.starsRow}>
            {[0, 1, 2, 3, 4].map((i) => (
              <LocaleText key={i} style={[styles.star, isDark && styles.starDark]}>★</LocaleText>
            ))}
          </View>

          {/* City name */}
          <LocaleText style={[styles.cityName, isDark && { color: '#DDE8D8' }]}>
            {city.name}
          </LocaleText>

          {/* Founded date */}
          <LocaleText style={[styles.foundedDate, isDark && { color: '#8A9A80' }]}>
            {t('city.founded', { date: formatFoundedDate(city.createdAt) })}
          </LocaleText>

          {/* Level badge */}
          <View style={[styles.levelBadge, isDark && styles.levelBadgeDark]}>
            <LocaleText style={[styles.levelText, isDark && { color: '#6BAED0' }]}>
              {t('city.levelLabel', { level: city.level })}
            </LocaleText>
          </View>

          {/* XP progress */}
          <View style={styles.xpSection}>
            <View style={styles.xpLabelRow}>
              <LocaleText style={[styles.xpNum, isDark && { color: '#9AAAB8' }]}>
                {city.xp} XP
              </LocaleText>
              {city.xpForNextLevel != null && (
                <LocaleText style={[styles.xpNum, isDark && { color: '#9AAAB8' }]}>
                  {city.xpForNextLevel} XP
                </LocaleText>
              )}
            </View>
            <View style={[styles.xpBarBg, isDark && styles.xpBarBgDark]}>
              <View style={[styles.xpBarFill, { width: `${Math.round(xpPercent * 100)}%` as any }]} />
            </View>
          </View>

          {/* Workers row */}
          <View style={[styles.workersRow, isDark && styles.workersRowDark]}>
            <View style={styles.workerCell}>
              <LocaleText style={styles.workerIcon}>👷</LocaleText>
              <LocaleText style={[styles.workerValue, isDark && { color: '#DDE8D8' }]}>—</LocaleText>
              <LocaleText style={[styles.workerLabel, isDark && { color: '#8A9A80' }]}>
                {t('city.allWorkers')}
              </LocaleText>
            </View>
            <View style={[styles.workerDivider, isDark && { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
            <View style={styles.workerCell}>
              <LocaleText style={styles.workerIcon}>😊</LocaleText>
              <LocaleText style={[styles.workerValue, isDark && { color: '#DDE8D8' }]}>—</LocaleText>
              <LocaleText style={[styles.workerLabel, isDark && { color: '#8A9A80' }]}>
                {t('city.happyWorkers')}
              </LocaleText>
            </View>
          </View>
        </View>

        {/* ── SECTION CARDS ─────────────────────────────── */}
        <View style={styles.cardsGrid}>
          {SECTION_CARDS.map((card) => (
            <TouchableOpacity
              key={card.key}
              style={[styles.sectionCard, isDark && styles.sectionCardDark]}
              activeOpacity={0.7}
            >
              <LocaleText style={styles.sectionCardIcon}>{card.icon}</LocaleText>
              <LocaleText style={[styles.sectionCardLabel, isDark && { color: '#DDE8D8' }]}>
                {t(`city.sections.${card.key}`)}
              </LocaleText>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── MEMBERS ───────────────────────────────────── */}
        <View style={styles.block}>
          <View style={styles.membersHeader}>
            <LocaleText style={[styles.sectionTitle, isDark && { color: '#DDE8D8' }]}>
              {t('city.members')}
            </LocaleText>
            <View style={[styles.memberCountBadge, isDark && styles.memberCountBadgeDark]}>
              <LocaleText style={styles.memberCountText}>
                {city.memberCount} / {city.maxMembers}
              </LocaleText>
            </View>
          </View>

          {pagedMembers.map((member, idx) => {
            const globalIdx = memberPage * MEMBERS_PER_PAGE + idx + 1;
            const isMe = member.playerId === player?.id;
            const showKick = isMyCity && !isMe && myRole && canKick(myRole, member.role);
            const showRole = isMyCity && !isMe && myRole && canPromote(myRole);

            return (
              <View key={member.playerId} style={[styles.memberRow, isDark && styles.memberRowDark]}>
                <LocaleText style={[styles.memberRank, isDark && { color: '#5A7090' }]}>
                  {globalIdx}
                </LocaleText>

                <TouchableOpacity
                  style={styles.memberInfo}
                  onPress={() => router.push(`/user-profile/${member.playerId}`)}
                  activeOpacity={0.7}
                >
                  <LocaleText style={[styles.memberName, isDark && { color: '#DDE8D8' }]}>
                    {member.playerName}{isMe ? ' ✦' : ''}
                  </LocaleText>
                  <LocaleText style={[styles.memberMeta, isDark && { color: '#8A9A80' }]}>
                    {t(`city.roles.${member.role}`)} · {t('city.detail.level', { level: member.playerLevel })}
                  </LocaleText>
                </TouchableOpacity>

                <LocaleText style={[styles.memberXp, isDark && { color: '#6BAED0' }]}>
                  {(member.cityXp ?? 0).toLocaleString()} XP
                </LocaleText>

                {(showRole || showKick) && (
                  <View style={styles.memberActions}>
                    {showRole && (
                      <TouchableOpacity
                        style={[styles.actionBtn, isDark && styles.actionBtnDark]}
                        onPress={() => handleChangeRole(member)}
                        activeOpacity={0.7}
                      >
                        <LocaleText style={[styles.actionBtnText, isDark && { color: '#DDE8D8' }]}>⬆</LocaleText>
                      </TouchableOpacity>
                    )}
                    {showKick && (
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.kickBtn]}
                        onPress={() => handleKick(member)}
                        activeOpacity={0.7}
                      >
                        <LocaleText style={styles.kickBtnText}>✕</LocaleText>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })}

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
          <View style={[styles.block, styles.descBlock, isDark && styles.blockDark]}>
            <LocaleText style={[styles.sectionTitle, { marginBottom: 8 }, isDark && { color: '#DDE8D8' }]}>
              {t('city.sections.description')}
            </LocaleText>
            <LocaleText style={[styles.descText, isDark && { color: '#9AAAB8' }]}>
              {city.description}
            </LocaleText>
          </View>
        ) : null}

        {/* ── NAV ITEMS ─────────────────────────────────── */}
        <View style={[styles.block, styles.navBlock, isDark && styles.blockDark]}>
          <TouchableOpacity style={styles.navRow} activeOpacity={0.7}>
            <LocaleText style={styles.navIcon}>📊</LocaleText>
            <LocaleText style={[styles.navLabel, isDark && { color: '#DDE8D8' }]}>
              {t('city.statistics')}
            </LocaleText>
            <LocaleText style={[styles.navChevron, isDark && { color: '#5A7090' }]}>›</LocaleText>
          </TouchableOpacity>

          <View style={[styles.navDivider, isDark && { backgroundColor: 'rgba(255,255,255,0.07)' }]} />

          <TouchableOpacity style={styles.navRow} activeOpacity={0.7}>
            <LocaleText style={styles.navIcon}>🏅</LocaleText>
            <LocaleText style={[styles.navLabel, isDark && { color: '#DDE8D8' }]}>
              {t('city.citizenRankings')}
            </LocaleText>
            <LocaleText style={[styles.navChevron, isDark && { color: '#5A7090' }]}>›</LocaleText>
          </TouchableOpacity>

          <View style={[styles.navDivider, isDark && { backgroundColor: 'rgba(255,255,255,0.07)' }]} />

          <TouchableOpacity
            style={styles.navRow}
            onPress={() => router.push('/city/rankings')}
            activeOpacity={0.7}
          >
            <LocaleText style={styles.navIcon}>🏆</LocaleText>
            <LocaleText style={[styles.navLabel, isDark && { color: '#DDE8D8' }]}>
              {t('city.rankings.button')}
            </LocaleText>
            <LocaleText style={[styles.navChevron, isDark && { color: '#5A7090' }]}>›</LocaleText>
          </TouchableOpacity>
        </View>

        {/* ── LEAVE CITY ────────────────────────────────── */}
        {isMyCity && (
          <TouchableOpacity
            style={[styles.leaveBtn, isDark && styles.leaveBtnDark]}
            onPress={handleLeave}
            activeOpacity={0.7}
          >
            <LocaleText style={styles.leaveBtnText}>{t('city.leaveCity')}</LocaleText>
          </TouchableOpacity>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#F0F8FF' },
  bgDark: { backgroundColor: '#0D1F2D' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontFamily: 'Fredoka_500Medium', fontSize: 15, color: '#7A8A80' },
  scroll: { paddingTop: 12, paddingBottom: 8 },

  heroCard: {
    backgroundColor: '#D0E8F8',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  heroCardDark: { backgroundColor: 'rgba(30,60,100,0.45)' },

  starsRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  star: { fontSize: 26, color: '#C8D8E8' },
  starDark: { color: '#3A5070' },

  cityName: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 24,
    color: '#0A1C30',
    textAlign: 'center',
    marginBottom: 4,
  },
  foundedDate: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
    color: '#5A7090',
    marginBottom: 14,
  },

  levelBadge: {
    backgroundColor: 'rgba(46,110,201,0.12)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 5,
    marginBottom: 14,
  },
  levelBadgeDark: { backgroundColor: 'rgba(107,174,208,0.18)' },
  levelText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
    color: '#2E6EC9',
  },

  xpSection: { width: '100%', marginBottom: 14 },
  xpLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  xpNum: { fontFamily: 'Fredoka_500Medium', fontSize: 12, color: '#5A7090' },
  xpBarBg: { height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.1)', overflow: 'hidden' },
  xpBarBgDark: { backgroundColor: 'rgba(255,255,255,0.1)' },
  xpBarFill: { height: '100%', backgroundColor: '#2E6EC9', borderRadius: 4 },

  workersRow: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 14,
    paddingVertical: 12,
  },
  workersRowDark: { backgroundColor: 'rgba(255,255,255,0.06)' },
  workerCell: { flex: 1, alignItems: 'center', gap: 2 },
  workerIcon: { fontSize: 20, marginBottom: 2 },
  workerValue: { fontFamily: 'Fredoka_700Bold', fontSize: 18, color: '#0A1C30' },
  workerLabel: { fontFamily: 'Fredoka_400Regular', fontSize: 11, color: '#5A7090' },
  workerDivider: { width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(0,0,0,0.1)' },

  // ── Section cards ─────────────────────────────────
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  sectionCard: {
    width: CARD_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
  },
  sectionCardSpacer: { width: '31.5%' },
  sectionCardDark: { backgroundColor: '#1A2E3E' },
  sectionCardIcon: { fontSize: 24 },
  sectionCardLabel: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 12,
    color: '#0A1C30',
    textAlign: 'center',
  },

  block: { marginHorizontal: 16, marginBottom: 16 },
  blockDark: {},

  // ── Members ───────────────────────────────────────
  membersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 17,
    color: '#0A1C30',
  },
  memberCountBadge: {
    backgroundColor: '#2E6EC9',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  memberCountBadgeDark: { backgroundColor: '#1A4A80' },
  memberCountText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
    color: '#FFFFFF',
  },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    gap: 10,
  },
  memberRowDark: { backgroundColor: '#1A2E3E' },
  memberRank: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 15,
    color: '#8A9A80',
    minWidth: 22,
    textAlign: 'center',
  },
  memberInfo: { flex: 1 },
  memberName: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
    color: '#0A1C30',
    marginBottom: 2,
  },
  memberMeta: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 12,
    color: '#5A7090',
  },
  memberXp: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
    color: '#2E6EC9',
  },
  memberActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: '#E8F0F8',
    alignItems: 'center', justifyContent: 'center',
  },
  actionBtnDark: { backgroundColor: 'rgba(255,255,255,0.1)' },
  actionBtnText: { fontSize: 16, color: '#2E6EC9' },
  kickBtn: { backgroundColor: '#FCE8E8' },
  kickBtnText: { fontSize: 14, color: '#C03030' },

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

  descBlock: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16 },
  descText: { fontFamily: 'Fredoka_400Regular', fontSize: 14, color: '#3A5060', lineHeight: 20 },

  navBlock: { backgroundColor: '#FFFFFF', borderRadius: 14, overflow: 'hidden', paddingVertical: 4 },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  navIcon: { fontSize: 20, width: 28 },
  navLabel: { flex: 1, fontFamily: 'Fredoka_500Medium', fontSize: 15, color: '#0A1C30' },
  navChevron: { fontFamily: 'Fredoka_600SemiBold', fontSize: 22, color: '#8A9A80', lineHeight: 24 },
  navDivider: { height: 1, marginLeft: 56, backgroundColor: 'rgba(0,0,0,0.06)' },

  leaveBtn: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#FCE8E8',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  leaveBtnDark: { backgroundColor: 'rgba(200,50,50,0.15)' },
  leaveBtnText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 16, color: '#C03030' },
});
