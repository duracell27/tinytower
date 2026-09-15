import React, { useEffect, useState } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, useColorScheme, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import CreateCitySheet from '../../src/components/CreateCitySheet';
import { useTranslation } from 'react-i18next';
import LocaleText from '../../src/components/LocaleText';
import AppBackground from '../../src/components/AppBackground';
import TopBar from '../../src/components/TopBar';
import GuestWall from '../../src/components/GuestWall';
import { useGameStore, useBalance } from '../../src/stores/gameStore';
import { useAuthStore } from '../../src/stores/authStore';
import { useCityStore } from '../../src/stores/cityStore';
import { xpForLevel } from '../../shared/engine/xp';
import { formatNum } from '../../src/utils/format';
import { useGameClock } from '../../src/hooks/useGameClock';
import { calcRevenuePerMin } from '../../shared/engine/ratingUtils';
import { gameConfig } from '../../shared/config/gameConfig';
import type { CityDetail, CityMember, CityRole } from '../../src/services/api';

const IMG = {
  cityBuildings: require('../../assets/img/city/cityBuildings.png'),
  advertising:   require('../../assets/img/city/cityBuildingAdvertisingagency.png'),
  bank:          require('../../assets/img/city/cityBuildingCityBank.png'),
  vipClub:       require('../../assets/img/city/cityBuildingVIPClub.png'),
  chat:          require('../../assets/img/city/cityChat.png'),
  notice:        require('../../assets/img/city/cityNotice.png'),
  marketing:     require('../../assets/img/MarketingIcon.png'),
  floorIcon:     require('../../assets/img/floor.png'),
};

const MEMBERS_PER_PAGE = 10;
const ROLE_ORDER: CityRole[] = ['NEWBIE', 'CITIZEN', 'BUSINESSMAN', 'ADVISOR', 'VICE_MAYOR', 'ACTING_MAYOR', 'MAYOR'];

function roleRank(role: CityRole) { return ROLE_ORDER.indexOf(role); }

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

export default function CityScreen() {
  const { t } = useTranslation('tabs');
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const [showCreateSheet, setShowCreateSheet] = useState(false);

  const balance = useBalance();
  const playerLevel = useGameStore((s) => s.playerLevel);
  const playerXp = useGameStore((s) => s.playerXp);
  const gems = useGameStore((s) => s.gems);
  const floors = useGameStore((s) => s.floors);
  const workers = useGameStore((s) => s.workers);
  const openedFloorTypes = useGameStore((s) => s.openedFloorTypes);
  const coinBonusPercent = useGameStore((s) => s.coinBonusPercent);
  const businessUpgrades = useGameStore((s) => s.businessUpgrades);
  const floorStars = useGameStore((s) => s.floorStars);
  const coinBoostPercent = useGameStore((s) => s.coinBoostPercent);
  const xpBoostPercent = useGameStore((s) => s.xpBoostPercent);
  const coinBoostExpiresAt = useGameStore((s) => s.coinBoostExpiresAt);
  const xpBoostExpiresAt = useGameStore((s) => s.xpBoostExpiresAt);
  const now = useGameClock(60_000);
  const activeCoinBoost = now < coinBoostExpiresAt ? coinBoostPercent : 0;
  const activeXpBoost = now < xpBoostExpiresAt ? xpBoostPercent : 0;
  const revenuePerMin = React.useMemo(
    () => calcRevenuePerMin(floors, workers, openedFloorTypes ?? {}, gameConfig, now, businessUpgrades, coinBonusPercent, floorStars, coinBoostPercent, coinBoostExpiresAt),
    [floors, workers, openedFloorTypes, now, businessUpgrades, coinBonusPercent, floorStars, coinBoostPercent, coinBoostExpiresAt],
  );

  const player = useAuthStore((s) => s.player);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const playerName = player?.playerName ?? t('profile.guestFallbackName');

  const { city, loading, fetchMyCityInfo } = useCityStore();

  useEffect(() => {
    if (isAuthenticated) fetchMyCityInfo();
  }, [isAuthenticated]);

  const topBar = (
    <TopBar
      name={playerName}
      level={playerLevel}
      xp={playerXp}
      xpForNextLevel={xpForLevel(playerLevel)}
      coins={formatNum(balance)}
      gems={formatNum(gems)}
      revenuePerMin={revenuePerMin}
      activeCoinBoost={activeCoinBoost}
      activeXpBoost={activeXpBoost}
      coinBoostExpiresAt={coinBoostExpiresAt}
      xpBoostExpiresAt={xpBoostExpiresAt}
    />
  );

  return (
    <View style={styles.container}>
      <AppBackground style={[styles.background, isDark && styles.backgroundDark]}>
        {topBar}

        {loading && !city ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={isDark ? '#6BAED0' : '#2E6EC9'} />
          </View>
        ) : city ? (
          <MyCityView city={city} isDark={isDark} t={t} router={router} />
        ) : (
          <NoCityView isDark={isDark} t={t} router={router} onCreatePress={() => setShowCreateSheet(true)} />
        )}
      </AppBackground>

      {!isAuthenticated && (
        <View style={StyleSheet.absoluteFill}>
          <GuestWall message="Create a free account to access city features" />
        </View>
      )}

      <CreateCitySheet visible={showCreateSheet} onClose={() => setShowCreateSheet(false)} />
    </View>
  );
}

// ─── My City ────────────────────────────────────────────────────────────────

function MyCityView({ city, isDark, t, router }: { city: CityDetail; isDark: boolean; t: any; router: any }) {
  const [memberPage, setMemberPage] = useState(0);
  const player = useAuthStore((s) => s.player);
  const { leaveCity, kickMember, changeMemberRole } = useCityStore();

  const myRole = city.myRole;
  const isMyCity = !!myRole;
  const xpPercent = city.xpForNextLevel ? Math.min(city.xp / city.xpForNextLevel, 1) : 1;
  const totalPages = Math.max(1, Math.ceil(city.members.length / MEMBERS_PER_PAGE));
  const pagedMembers = city.members.slice(
    memberPage * MEMBERS_PER_PAGE,
    (memberPage + 1) * MEMBERS_PER_PAGE,
  );

  const handleLeave = () => {
    Alert.alert(
      t('city.leaveCity'),
      myRole === 'MAYOR' ? t('city.leaveCityMayorWarning') : t('city.leaveCityConfirm'),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: t('city.leaveCity'),
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveCity();
            } catch {
              Alert.alert('', t('city.errors.leave'));
            }
          },
        },
      ],
    );
  };

  const handleKick = (member: CityMember) => {
    Alert.alert('', t('city.kick.confirm', { name: member.playerName }), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: t('city.detail.kick'),
        style: 'destructive',
        onPress: async () => {
          try { await kickMember(city.id, member.playerId); }
          catch { Alert.alert('', t('city.kick.error')); }
        },
      },
    ]);
  };

  const handleChangeRole = (member: CityMember) => {
    if (!myRole) return;
    const availableRoles: CityRole[] = myRole === 'VICE_MAYOR'
      ? ['NEWBIE', 'CITIZEN', 'BUSINESSMAN', 'ADVISOR']
      : ['NEWBIE', 'CITIZEN', 'BUSINESSMAN', 'ADVISOR', 'VICE_MAYOR', 'ACTING_MAYOR', 'MAYOR'];

    Alert.alert(
      t('city.roleChange.title'),
      member.playerName,
      [
        ...availableRoles
          .filter((r) => r !== member.role)
          .map((role) => ({
            text: t(`city.roles.${role}`),
            onPress: async () => {
              try { await changeMemberRole(city.id, member.playerId, role); }
              catch { Alert.alert('', t('city.roleChange.error')); }
            },
          })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  };

  return (
    <ScrollView
      contentContainerStyle={styles.cityScroll}
      showsVerticalScrollIndicator={false}
      style={styles.scrollView}
    >
      {/* ── HERO CARD ─────────────────────────────────── */}
      <View style={[styles.heroCard, isDark && styles.heroCardDark]}>
        <View style={styles.starsRow}>
          {[0, 1, 2, 3, 4].map((i) => (
            <LocaleText key={i} style={[styles.star, isDark && styles.starDark]}>★</LocaleText>
          ))}
        </View>

        <LocaleText style={[styles.cityHeroName, isDark && { color: '#DDE8D8' }]}>{city.name}</LocaleText>

        <LocaleText style={[styles.foundedDate, isDark && { color: '#8A9A80' }]}>
          {t('city.founded', { date: formatFoundedDate(city.createdAt) })}
        </LocaleText>

        <View style={[styles.levelBadge, isDark && styles.levelBadgeDark]}>
          <LocaleText style={[styles.levelText, isDark && { color: '#6BAED0' }]}>
            {t('city.levelLabel', { level: city.level })}
          </LocaleText>
        </View>

        <View style={styles.xpSection}>
          <View style={styles.xpLabelRow}>
            <LocaleText style={[styles.xpNum, isDark && { color: '#9AAAB8' }]}>{city.xp} XP</LocaleText>
            {city.xpForNextLevel != null && (
              <LocaleText style={[styles.xpNum, isDark && { color: '#9AAAB8' }]}>{city.xpForNextLevel} XP</LocaleText>
            )}
          </View>
          <View style={[styles.xpBarBg, isDark && styles.xpBarBgDark]}>
            <View style={[styles.xpBarFill, { width: `${Math.round(xpPercent * 100)}%` as any }]} />
          </View>
        </View>

        <View style={[styles.workersRow, isDark && styles.workersRowDark]}>
          <View style={styles.workerCell}>
            <LocaleText style={styles.workerIcon}>👷</LocaleText>
            <LocaleText style={[styles.workerValue, isDark && { color: '#DDE8D8' }]}>—</LocaleText>
            <LocaleText style={[styles.workerLabel, isDark && { color: '#8A9A80' }]}>{t('city.allWorkers')}</LocaleText>
          </View>
          <View style={[styles.workerDivider, isDark && { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
          <View style={styles.workerCell}>
            <LocaleText style={styles.workerIcon}>😊</LocaleText>
            <LocaleText style={[styles.workerValue, isDark && { color: '#DDE8D8' }]}>—</LocaleText>
            <LocaleText style={[styles.workerLabel, isDark && { color: '#8A9A80' }]}>{t('city.happyWorkers')}</LocaleText>
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
          <LocaleText style={[styles.sectionTitle, isDark && { color: '#DDE8D8' }]}>{t('city.members')}</LocaleText>
          <LocaleText style={[styles.membersPageLabel, isDark && { color: '#8A9A80' }]}>
            {t('city.membersPage', { from: memberPage + 1, total: totalPages })}
          </LocaleText>
        </View>

        {pagedMembers.map((member) => {
          const isMe = member.playerId === player?.id;
          const showKick = isMyCity && !isMe && myRole && canKick(myRole, member.role);
          const showRole = isMyCity && !isMe && myRole && canPromote(myRole);

          return (
            <View key={member.playerId} style={[styles.memberRow, isDark && styles.memberRowDark]}>
              <TouchableOpacity
                style={styles.memberInfo}
                onPress={() => router.push(`/user-profile/${member.playerId}`)}
                activeOpacity={0.7}
              >
                <LocaleText style={[styles.memberName, isDark && { color: '#DDE8D8' }]}>
                  {member.playerName}{isMe ? ' ✦' : ''}
                </LocaleText>
                <LocaleText style={[styles.memberMeta, isDark && { color: '#8A9A80' }]}>
                  {t('city.detail.level', { level: member.playerLevel })} · {t(`city.roles.${member.role}`)}
                </LocaleText>
              </TouchableOpacity>
              <View style={styles.memberActions}>
                {showRole && (
                  <TouchableOpacity
                    style={[styles.memberActionBtn, isDark && styles.memberActionBtnDark]}
                    onPress={() => handleChangeRole(member)}
                    activeOpacity={0.7}
                  >
                    <LocaleText style={[styles.memberActionText, isDark && { color: '#DDE8D8' }]}>⬆</LocaleText>
                  </TouchableOpacity>
                )}
                {showKick && (
                  <TouchableOpacity
                    style={[styles.memberActionBtn, styles.kickBtn]}
                    onPress={() => handleKick(member)}
                    activeOpacity={0.7}
                  >
                    <LocaleText style={styles.kickBtnText}>✕</LocaleText>
                  </TouchableOpacity>
                )}
              </View>
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
        <View style={[styles.block, styles.descBlock, isDark && styles.descBlockDark]}>
          <LocaleText style={[styles.sectionTitle, { marginBottom: 8 }, isDark && { color: '#DDE8D8' }]}>
            {t('city.sections.description')}
          </LocaleText>
          <LocaleText style={[styles.descText, isDark && { color: '#9AAAB8' }]}>{city.description}</LocaleText>
        </View>
      ) : null}

      {/* ── NAV ROWS ──────────────────────────────────── */}
      <View style={[styles.block, styles.navBlock, isDark && styles.navBlockDark]}>
        <TouchableOpacity style={styles.navRow} activeOpacity={0.7}>
          <LocaleText style={styles.navIcon}>📊</LocaleText>
          <LocaleText style={[styles.navLabel, isDark && { color: '#DDE8D8' }]}>{t('city.statistics')}</LocaleText>
          <LocaleText style={[styles.navChevron, isDark && { color: '#5A7090' }]}>›</LocaleText>
        </TouchableOpacity>
        <View style={[styles.navDivider, isDark && { backgroundColor: 'rgba(255,255,255,0.07)' }]} />
        <TouchableOpacity style={styles.navRow} activeOpacity={0.7}>
          <LocaleText style={styles.navIcon}>🏅</LocaleText>
          <LocaleText style={[styles.navLabel, isDark && { color: '#DDE8D8' }]}>{t('city.citizenRankings')}</LocaleText>
          <LocaleText style={[styles.navChevron, isDark && { color: '#5A7090' }]}>›</LocaleText>
        </TouchableOpacity>
        <View style={[styles.navDivider, isDark && { backgroundColor: 'rgba(255,255,255,0.07)' }]} />
        <TouchableOpacity style={styles.navRow} onPress={() => router.push('/city/rankings')} activeOpacity={0.7}>
          <LocaleText style={styles.navIcon}>🏆</LocaleText>
          <LocaleText style={[styles.navLabel, isDark && { color: '#DDE8D8' }]}>{t('city.rankings.button')}</LocaleText>
          <LocaleText style={[styles.navChevron, isDark && { color: '#5A7090' }]}>›</LocaleText>
        </TouchableOpacity>
      </View>

      {/* ── LEAVE CITY ────────────────────────────────── */}
      {isMyCity && (
        <TouchableOpacity
          style={[styles.block, styles.leaveBtn, isDark && styles.leaveBtnDark]}
          onPress={handleLeave}
          activeOpacity={0.7}
        >
          <LocaleText style={styles.leaveBtnText}>{t('city.leaveCity')}</LocaleText>
        </TouchableOpacity>
      )}

      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

// ─── No City ────────────────────────────────────────────────────────────────

function SectionDivider({ label, isDark }: { label: string; isDark: boolean }) {
  return (
    <View style={styles.dividerRow}>
      <View style={[styles.dividerLine, isDark && { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
      <LocaleText style={[styles.dividerLabel, isDark && { color: '#8A9A80' }]}>{label}</LocaleText>
      <View style={[styles.dividerLine, isDark && { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
    </View>
  );
}

function NoCityView({ isDark, t, router, onCreatePress }: { isDark: boolean; t: any; router: any; onCreatePress: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} style={styles.scrollView}>
      <View style={styles.hero}>
        <Image source={IMG.cityBuildings} style={styles.heroImage} contentFit="contain" />
        <LocaleText style={[styles.heroTagline, isDark && { color: '#DDE8D8' }]}>{t('city.tagline')}</LocaleText>
        <LocaleText style={[styles.heroDescription, isDark && { color: '#8A9A80' }]}>{t('city.description')}</LocaleText>
      </View>

      <View style={[styles.card, { backgroundColor: isDark ? '#6BA34A' : '#5E8F42' }]}>
        <Image source={IMG.marketing} style={styles.cardImg} contentFit="contain" />
        <View style={styles.cardBody}>
          <LocaleText style={[styles.cardTitle, { color: '#FFFFFF' }]}>{t('city.bonusTitle')}</LocaleText>
          <LocaleText style={[styles.cardText, { color: 'rgba(255,255,255,0.82)' }]}>{t('city.bonusDescription')}</LocaleText>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: isDark ? '#F0B030' : '#E7A52B' }]}>
        <View style={styles.floorIconWrap}>
          <Image source={IMG.floorIcon} style={styles.cardImg} contentFit="contain" />
          <View style={styles.floorBadge}>
            <LocaleText style={styles.floorBadgeText}>10</LocaleText>
          </View>
        </View>
        <View style={styles.cardBody}>
          <LocaleText style={[styles.cardTitle, { color: '#FFFFFF' }]}>{t('city.requirementTitle')}</LocaleText>
          <LocaleText style={[styles.cardText, { color: 'rgba(255,255,255,0.82)' }]}>{t('city.requirementDescription')}</LocaleText>
        </View>
      </View>

      <SectionDivider label={t('city.joinTitle')} isDark={isDark} />

      <TouchableOpacity
        style={[styles.actionCard, { backgroundColor: isDark ? '#3A7ED8' : '#2E6EC9' }]}
        onPress={() => router.push('/city/search')}
        activeOpacity={0.7}
      >
        <View style={[styles.actionCardLeft, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
          <Image source={IMG.cityBuildings} style={styles.actionImg} contentFit="contain" />
        </View>
        <View style={styles.actionCardBody}>
          <LocaleText style={[styles.actionCardTitle, { color: '#FFFFFF' }]}>{t('city.joinButton')}</LocaleText>
          <LocaleText style={[styles.actionCardSubtitle, { color: 'rgba(255,255,255,0.78)' }]}>{t('city.joinDescription')}</LocaleText>
        </View>
        <LocaleText style={[styles.actionCardChevron, { color: 'rgba(255,255,255,0.7)' }]}>›</LocaleText>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionCard, { backgroundColor: isDark ? '#A87EDE' : '#9A6FD0' }]}
        onPress={onCreatePress}
        activeOpacity={0.7}
      >
        <View style={[styles.actionCardLeft, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
          <Image source={IMG.bank} style={styles.actionImg} contentFit="contain" />
        </View>
        <View style={styles.actionCardBody}>
          <LocaleText style={[styles.actionCardTitle, { color: '#FFFFFF' }]}>{t('city.createButton')}</LocaleText>
          <LocaleText style={[styles.actionCardSubtitle, { color: 'rgba(255,255,255,0.78)' }]}>{t('city.createSubtitle')}</LocaleText>
        </View>
        <LocaleText style={[styles.actionCardChevron, { color: 'rgba(255,255,255,0.7)' }]}>›</LocaleText>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionCard, { backgroundColor: isDark ? '#E86060' : '#E05050' }]}
        onPress={() => router.push('/city/rankings')}
        activeOpacity={0.7}
      >
        <View style={[styles.actionCardLeft, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
          <Image source={IMG.vipClub} style={styles.actionImg} contentFit="contain" />
        </View>
        <View style={styles.actionCardBody}>
          <LocaleText style={[styles.actionCardTitle, { color: '#FFFFFF' }]}>{t('city.rankings.button')}</LocaleText>
          <LocaleText style={[styles.actionCardSubtitle, { color: 'rgba(255,255,255,0.78)' }]}>{t('city.rankings.subtitle')}</LocaleText>
        </View>
        <LocaleText style={[styles.actionCardChevron, { color: 'rgba(255,255,255,0.7)' }]}>›</LocaleText>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  background: { flex: 1, backgroundColor: '#DCEFF6' },
  backgroundDark: { backgroundColor: '#0D1F2D' },
  scrollView: { flex: 1 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // NoCityView scroll
  scroll: { paddingHorizontal: 20, paddingTop: 130, paddingBottom: 100 },

  // MyCityView scroll
  cityScroll: { paddingTop: 130, paddingBottom: 8 },

  // ── Hero (no city) ─────────────────────────────────
  hero: { alignItems: 'center', paddingTop: 8, paddingBottom: 20 },
  heroImage: { width: 140, height: 110, marginBottom: 12 },
  heroTagline: { fontFamily: 'Fredoka_700Bold', fontSize: 20, color: '#1C2C1A', textAlign: 'center', marginBottom: 6 },
  heroDescription: { fontFamily: 'Fredoka_500Medium', fontSize: 15, color: '#5A6650', textAlign: 'center' },

  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 14, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(0,0,0,0.1)' },
  dividerLabel: { fontFamily: 'Fredoka_600SemiBold', fontSize: 13, color: '#7A9080', letterSpacing: 0.3 },

  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 14, marginBottom: 10, gap: 12 },
  cardImg: { width: 44, height: 44 },
  floorIconWrap: { width: 44, height: 44, position: 'relative' },
  floorBadge: {
    position: 'absolute', top: -6, right: -6,
    backgroundColor: '#FFFFFF', borderRadius: 8,
    minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  floorBadgeText: { fontFamily: 'Fredoka_700Bold', fontSize: 11, color: '#7A4A00', lineHeight: 13 },
  cardBody: { flex: 1 },
  cardTitle: { fontFamily: 'Fredoka_700Bold', fontSize: 15, color: '#1C2C1A', marginBottom: 3 },
  cardText: { fontFamily: 'Fredoka_500Medium', fontSize: 13, color: '#4A5540', lineHeight: 18 },

  actionCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 16, marginBottom: 10, gap: 14 },
  actionCardLeft: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  actionImg: { width: 40, height: 40 },
  actionCardBody: { flex: 1 },
  actionCardTitle: { fontFamily: 'Fredoka_700Bold', fontSize: 16, color: '#1C2C1A', marginBottom: 2 },
  actionCardSubtitle: { fontFamily: 'Fredoka_500Medium', fontSize: 13, color: '#4A6050', lineHeight: 17 },
  actionCardChevron: { fontSize: 26, color: '#7A9A8A', lineHeight: 30 },

  // ── Hero card (my city) ────────────────────────────
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

  cityHeroName: {
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
  levelText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 15, color: '#2E6EC9' },

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

  // ── Section cards ──────────────────────────────────
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 12,
    marginBottom: 16,
    gap: 8,
  },
  sectionCard: {
    width: '30.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
  },
  sectionCardDark: { backgroundColor: '#1A2E3E' },
  sectionCardIcon: { fontSize: 24 },
  sectionCardLabel: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 12,
    color: '#0A1C30',
    textAlign: 'center',
  },

  // ── Generic block ──────────────────────────────────
  block: { marginHorizontal: 16, marginBottom: 16 },

  // ── Members ────────────────────────────────────────
  membersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: { fontFamily: 'Fredoka_700Bold', fontSize: 17, color: '#0A1C30' },
  membersPageLabel: { fontFamily: 'Fredoka_500Medium', fontSize: 13, color: '#5A7090' },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    gap: 10,
  },
  memberRowDark: { backgroundColor: '#1A2E3E' },
  memberInfo: { flex: 1 },
  memberName: { fontFamily: 'Fredoka_600SemiBold', fontSize: 15, color: '#0A1C30', marginBottom: 2 },
  memberMeta: { fontFamily: 'Fredoka_400Regular', fontSize: 12, color: '#5A7090' },
  memberActions: { flexDirection: 'row', gap: 8 },
  memberActionBtn: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: '#E8F0F8',
    alignItems: 'center', justifyContent: 'center',
  },
  memberActionBtnDark: { backgroundColor: 'rgba(255,255,255,0.1)' },
  memberActionText: { fontSize: 16, color: '#2E6EC9' },
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

  // ── Description ────────────────────────────────────
  descBlock: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16 },
  descBlockDark: { backgroundColor: '#1A2E3E' },
  descText: { fontFamily: 'Fredoka_400Regular', fontSize: 14, color: '#3A5060', lineHeight: 20 },

  // ── Nav block ──────────────────────────────────────
  navBlock: { backgroundColor: '#FFFFFF', borderRadius: 14, overflow: 'hidden', paddingVertical: 4 },
  navBlockDark: { backgroundColor: '#1A2E3E' },
  navRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  navIcon: { fontSize: 20, width: 28 },
  navLabel: { flex: 1, fontFamily: 'Fredoka_500Medium', fontSize: 15, color: '#0A1C30' },
  navChevron: { fontFamily: 'Fredoka_600SemiBold', fontSize: 22, color: '#8A9A80', lineHeight: 24 },
  navDivider: { height: 1, marginLeft: 56, backgroundColor: 'rgba(0,0,0,0.06)' },

  // ── Leave ──────────────────────────────────────────
  leaveBtn: { backgroundColor: '#FCE8E8', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  leaveBtnDark: { backgroundColor: 'rgba(200,50,50,0.15)' },
  leaveBtnText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 16, color: '#C03030' },
});
