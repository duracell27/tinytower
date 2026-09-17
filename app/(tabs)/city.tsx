import React, { useEffect, useState } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, useColorScheme, Dimensions,
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
import { getWorkerMood } from '../../shared/engine/workerUtils';
import { useAppTheme } from '../../src/hooks/useAppTheme';
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

const STAR_EMPTY = require('../../assets/img/starEmpty.png');
const XP_ICON    = require('../../assets/img/xpIcon.png');
const WORKER_ICON = require('../../assets/img/worker.png');
const HAPPY_ICON  = require('../../assets/img/happySmile.png');

const SECTION_CARDS = [
  { key: 'budget',        img: require('../../assets/img/coin.png') },
  { key: 'tasks',         img: require('../../assets/img/city/cityTasks.png') },
  { key: 'chat',          img: require('../../assets/img/city/cityChat.png') },
  { key: 'history',       img: require('../../assets/img/city/cityNotice.png') },
  { key: 'buildings',     img: require('../../assets/img/city/cityBuildings.png') },
  { key: 'notifications', img: require('../../assets/img/city/cityNotice.png') },
] as const;

const MEMBERS_PER_PAGE = 10;
const ROLE_ORDER: CityRole[] = ['NEWBIE', 'CITIZEN', 'BUSINESSMAN', 'ADVISOR', 'VICE_MAYOR', 'ACTING_MAYOR', 'MAYOR'];


function formatFoundedDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' });
}

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
  const theme = useAppTheme();
  const player = useAuthStore((s) => s.player);
  const { leaveCity } = useCityStore();
  const showCityAlert = useGameStore((s) => s.showCityAlert);
  const showCityConfirm = useGameStore((s) => s.showCityConfirm);

  // Current player's own worker stats (city-wide aggregate requires backend update)
  const workers = useGameStore((s) => s.workers);
  const floors = useGameStore((s) => s.floors);
  const openedFloorTypes = useGameStore((s) => s.openedFloorTypes);
  const totalWorkers = workers.length;
  const happyCount = workers.filter((w) => {
    if (w.assignedFloorId === null) return false;
    const staticFloor = gameConfig.floors.find((f) => f.id === w.assignedFloorId);
    const floorType = staticFloor ? staticFloor.floorType : (openedFloorTypes?.[String(w.assignedFloorId)] ?? '');
    const floor = floors.find((f) => f.id === w.assignedFloorId);
    const production = floor?.productions[w.assignedSlotIdx!];
    return getWorkerMood(w, floorType, production?.typeId ?? null) === 'good';
  }).length;

  const myRole = city.myRole;
  const isMyCity = !!myRole;
  const xpPercent = city.xpForNextLevel ? Math.min(city.xp / city.xpForNextLevel, 1) : 1;
  const totalPages = Math.max(1, Math.ceil(city.members.length / MEMBERS_PER_PAGE));
  const pagedMembers = city.members.slice(
    memberPage * MEMBERS_PER_PAGE,
    (memberPage + 1) * MEMBERS_PER_PAGE,
  );

  const handleLeave = () => {
    showCityConfirm({
      title: t('city.leaveCity'),
      message: myRole === 'MAYOR' ? t('city.leaveCityMayorWarning') : t('city.leaveCityConfirm'),
      confirmText: t('city.leaveCity'),
      danger: true,
      onConfirm: async () => {
        try {
          await leaveCity();
        } catch {
          showCityAlert({ message: t('city.errors.leave') });
        }
      },
    });
  };

  return (
    <ScrollView
      contentContainerStyle={styles.cityScroll}
      showsVerticalScrollIndicator={false}
      style={styles.scrollView}
    >
      {/* ── HERO CARD ─────────────────────────────────── */}
      <View style={[styles.heroCard, { backgroundColor: theme.surface }]}>

        {/* Stars */}
        <View style={styles.starsRow}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Image key={i} source={STAR_EMPTY} style={styles.star} contentFit="contain" />
          ))}
        </View>

        {/* City name with icon on both sides */}
        <View style={styles.cityNameRow}>
          <Image source={IMG.cityBuildings} style={styles.cityNameIcon} contentFit="contain" />
          <LocaleText style={[styles.cityHeroName, { color: theme.text }]}>{city.name}</LocaleText>
          <Image source={IMG.cityBuildings} style={styles.cityNameIcon} contentFit="contain" />
        </View>

        <LocaleText style={[styles.foundedDate, { color: theme.textMuted }]}>
          {t('city.founded', { date: formatFoundedDate(city.createdAt) })}
        </LocaleText>

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
            <LocaleText style={[styles.xpNum, { color: theme.textMuted }]}>
              {city.xp}
              {city.xpForNextLevel != null ? ` / ${city.xpForNextLevel}` : ''}
            </LocaleText>
            <Image source={XP_ICON} style={styles.xpIconImg} contentFit="contain" />
          </View>
        </View>

        {/* XP bar */}
        <View style={[styles.xpBarBg, { backgroundColor: theme.divider }]}>
          <View style={[styles.xpBarFill, { width: `${Math.round(xpPercent * 100)}%` as any }]} />
        </View>

        {/* Workers / Happy divider */}
        <View style={[styles.workersDividerLine, { backgroundColor: theme.divider }]} />

        {/* Workers row — profile-style */}
        <View style={styles.workerStatsRow}>
          <View style={styles.workerStatItem}>
            <Image source={WORKER_ICON} style={styles.workerStatIcon} contentFit="contain" />
            <View style={styles.workerStatText}>
              <LocaleText style={[styles.workerStatLabel, { color: theme.textMuted }]}>{t('city.allWorkers')}</LocaleText>
              <LocaleText style={[styles.workerStatValue, { color: theme.text }]}>{totalWorkers}</LocaleText>
            </View>
          </View>
          <View style={[styles.workerStatDivider, { backgroundColor: theme.divider }]} />
          <View style={styles.workerStatItem}>
            <Image source={HAPPY_ICON} style={styles.workerStatIcon} contentFit="contain" />
            <View style={styles.workerStatText}>
              <LocaleText style={[styles.workerStatLabel, { color: theme.textMuted }]}>{t('city.happyWorkers')}</LocaleText>
              <LocaleText style={[styles.workerStatValue, { color: theme.text }]}>{happyCount} / {totalWorkers}</LocaleText>
            </View>
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
            <Image source={card.img} style={styles.sectionCardImg} contentFit="contain" />
            <LocaleText style={[styles.sectionCardLabel, isDark && { color: '#DDE8D8' }]}>
              {t(`city.sections.${card.key}`)}
            </LocaleText>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── MEMBERS ───────────────────────────────────── */}
      <View style={[styles.block, styles.membersBlock, isDark && styles.membersBlockDark]}>
        {/* Header */}
        <View style={styles.membersHeader}>
          <LocaleText style={[styles.sectionTitle, { color: '#FFFFFF' }]}>{t('city.members')}</LocaleText>
          <View style={[styles.memberCountBadge, isDark && styles.memberCountBadgeDark]}>
            <LocaleText style={styles.memberCountText}>{city.memberCount} / {city.maxMembers}</LocaleText>
          </View>
        </View>

        {/* List */}
        <View style={[styles.membersListBg, isDark && styles.membersListBgDark]}>
        {pagedMembers.map((member, idx) => {
          const globalIdx = memberPage * MEMBERS_PER_PAGE + idx + 1;

          return (
            <TouchableOpacity
              key={member.playerId}
              style={[styles.memberRow, isDark && styles.memberRowDark]}
              onPress={() => router.push(`/user-profile/${member.playerId}`)}
              activeOpacity={0.7}
            >
              <LocaleText style={[styles.memberRank, isDark && { color: '#5A7090' }]}>{globalIdx}</LocaleText>

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
                  {(member.cityXp ?? 0).toLocaleString()}
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
          onPress={() => router.push(`/city/xp-stats?id=${city.id}`)}
          activeOpacity={0.7}
        >
          <Image source={require('../../assets/img/xpIcon.png')} style={styles.navImg} contentFit="contain" />
          <LocaleText style={[styles.navLabel, isDark && { color: '#DDE8D8' }]}>{t('city.xpStats.title')}</LocaleText>
          <LocaleText style={[styles.navChevron, isDark && { color: '#5A7090' }]}>›</LocaleText>
        </TouchableOpacity>
        <View style={[styles.navDivider, isDark && { backgroundColor: 'rgba(255,255,255,0.07)' }]} />
        <TouchableOpacity style={styles.navRow} activeOpacity={0.7}>
          <Image source={require('../../assets/img/menu/rating.png')} style={styles.navImg} contentFit="contain" />
          <LocaleText style={[styles.navLabel, isDark && { color: '#DDE8D8' }]}>{t('city.citizenRankings')}</LocaleText>
          <LocaleText style={[styles.navChevron, isDark && { color: '#5A7090' }]}>›</LocaleText>
        </TouchableOpacity>
        <View style={[styles.navDivider, isDark && { backgroundColor: 'rgba(255,255,255,0.07)' }]} />
        <TouchableOpacity style={styles.navRow} onPress={() => router.push('/city/rankings')} activeOpacity={0.7}>
          <Image source={require('../../assets/img/rating/1PlaceCup.png')} style={styles.navImg} contentFit="contain" />
          <LocaleText style={[styles.navLabel, isDark && { color: '#DDE8D8' }]}>{t('city.rankings.button')}</LocaleText>
          <LocaleText style={[styles.navChevron, isDark && { color: '#5A7090' }]}>›</LocaleText>
        </TouchableOpacity>
      </View>

      {/* ── SETTINGS (mayor only) ─────────────────────── */}
      {(myRole === 'MAYOR' || myRole === 'ACTING_MAYOR') && (
        <TouchableOpacity
          style={[styles.block, styles.settingsBtn, isDark && styles.settingsBtnDark]}
          onPress={() => router.push(`/city/settings?cityId=${city.id}`)}
          activeOpacity={0.7}
        >
          <LocaleText style={[styles.settingsBtnText, isDark && { color: '#8BBFE0' }]}>
            {t('city.settingsTitle')}
          </LocaleText>
        </TouchableOpacity>
      )}

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

      <View style={{ height: 80 }} />
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
  cityScroll: { paddingTop: 155, paddingBottom: 8 },

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

  levelXpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  levelXpLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  levelBadge: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 5,
    backgroundColor: 'rgba(46,110,201,0.13)',
  },
  levelText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 14, color: '#2E6EC9' },
  xpPercentBadge: {
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: 'rgba(46,110,201,0.08)',
  },
  xpPercentText: { fontFamily: 'Fredoka_500Medium', fontSize: 11, color: '#2E6EC9' },
  xpValueRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  xpNum: { fontFamily: 'Fredoka_500Medium', fontSize: 13 },
  xpIconImg: { width: 18, height: 18 },

  bonusBadge: {
    backgroundColor: 'rgba(50,160,80,0.13)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 14,
    alignSelf: 'center',
  },
  bonusBadgeText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 13, color: '#2A7A3A' },

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

  // ── Section cards ──────────────────────────────────
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  sectionCard: {
    width: (Dimensions.get('window').width - 32 - 16) / 3,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
  },
  sectionCardDark: { backgroundColor: '#1A2E3E' },
  sectionCardImg: { width: 32, height: 32 },
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
    backgroundColor: '#2E6EC9',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  membersListBg: {
    backgroundColor: '#E8F2FA',
    padding: 10,
    gap: 6,
  },
  membersListBgDark: { backgroundColor: 'rgba(30,60,100,0.35)' },
  sectionTitle: { fontFamily: 'Fredoka_700Bold', fontSize: 17, color: '#0A1C30' },
  membersBlock: { borderRadius: 16, overflow: 'hidden' },
  membersBlockDark: {},
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
  navImg: { width: 26, height: 26 },
  navLabel: { flex: 1, fontFamily: 'Fredoka_500Medium', fontSize: 15, color: '#0A1C30' },
  navChevron: { fontFamily: 'Fredoka_600SemiBold', fontSize: 22, color: '#8A9A80', lineHeight: 24 },
  navDivider: { height: 1, marginLeft: 56, backgroundColor: 'rgba(0,0,0,0.06)' },

  // ── Settings ───────────────────────────────────────
  settingsBtn: { backgroundColor: '#E8F2FA', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  settingsBtnDark: { backgroundColor: 'rgba(46,110,201,0.15)' },
  settingsBtnText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 16, color: '#2E6EC9' },

  // ── Leave ──────────────────────────────────────────
  leaveBtn: { backgroundColor: '#FCE8E8', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  leaveBtnDark: { backgroundColor: 'rgba(200,50,50,0.15)' },
  leaveBtnText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 16, color: '#C03030' },
});
