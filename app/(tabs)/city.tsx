import React, { useEffect } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, useColorScheme } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
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

const IMG = {
  cityBuildings:   require('../../assets/img/city/cityBuildings.png'),
  advertising:     require('../../assets/img/city/cityBuildingAdvertisingagency.png'),
  bank:            require('../../assets/img/city/cityBuildingCityBank.png'),
  vipClub:         require('../../assets/img/city/cityBuildingVIPClub.png'),
  chat:            require('../../assets/img/city/cityChat.png'),
  notice:          require('../../assets/img/city/cityNotice.png'),
  marketing:       require('../../assets/img/MarketingIcon.png'),
  floorIcon:       require('../../assets/img/floor.png'),
};

export default function CityScreen() {
  const { t } = useTranslation('tabs');
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();

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
    if (isAuthenticated) {
      fetchMyCityInfo();
    }
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
          <NoCityView isDark={isDark} t={t} router={router} />
        )}
      </AppBackground>

      {!isAuthenticated && (
        <View style={StyleSheet.absoluteFill}>
          <GuestWall message="Create a free account to access city features" />
        </View>
      )}
    </View>
  );
}

function SectionDivider({ label, isDark }: { label: string; isDark: boolean }) {
  return (
    <View style={styles.dividerRow}>
      <View style={[styles.dividerLine, isDark && { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
      <LocaleText style={[styles.dividerLabel, isDark && { color: '#8A9A80' }]}>{label}</LocaleText>
      <View style={[styles.dividerLine, isDark && { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
    </View>
  );
}

function NoCityView({ isDark, t, router }: { isDark: boolean; t: any; router: any }) {
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} style={styles.scrollView}>
      {/* Hero */}
      <View style={styles.hero}>
        <Image source={IMG.cityBuildings} style={styles.heroImage} contentFit="contain" />
        <LocaleText style={[styles.heroTagline, isDark && { color: '#DDE8D8' }]}>{t('city.tagline')}</LocaleText>
        <LocaleText style={[styles.heroDescription, isDark && { color: '#8A9A80' }]}>{t('city.description')}</LocaleText>
      </View>

      {/* Info cards */}
      <View style={[styles.card, isDark ? { backgroundColor: 'rgba(30,150,80,0.42)' } : styles.cardBonus]}>
        <Image source={IMG.marketing} style={styles.cardImg} contentFit="contain" />
        <View style={styles.cardBody}>
          <LocaleText style={[styles.cardTitle, isDark && { color: '#DDE8D8' }]}>{t('city.bonusTitle')}</LocaleText>
          <LocaleText style={[styles.cardText, isDark && { color: '#8A9A80' }]}>{t('city.bonusDescription')}</LocaleText>
        </View>
      </View>

      <View style={[styles.card, isDark ? { backgroundColor: 'rgba(190,120,10,0.42)' } : styles.cardRequirement]}>
        <View style={styles.floorIconWrap}>
          <Image source={IMG.floorIcon} style={styles.cardImg} contentFit="contain" />
          <View style={styles.floorBadge}>
            <LocaleText style={styles.floorBadgeText}>10</LocaleText>
          </View>
        </View>
        <View style={styles.cardBody}>
          <LocaleText style={[styles.cardTitle, isDark && { color: '#DDE8D8' }]}>{t('city.requirementTitle')}</LocaleText>
          <LocaleText style={[styles.cardText, isDark && { color: '#8A9A80' }]}>{t('city.requirementDescription')}</LocaleText>
        </View>
      </View>

      <SectionDivider label={t('city.joinTitle')} isDark={isDark} />

      {/* Browse Cities */}
      <TouchableOpacity
        style={[styles.actionCard, isDark ? { backgroundColor: 'rgba(20,95,210,0.45)' } : styles.actionCardBlue]}
        onPress={() => router.push('/city/search')}
        activeOpacity={0.7}
      >
        <View style={[styles.actionCardLeft, isDark && { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
          <Image source={IMG.cityBuildings} style={styles.actionImg} contentFit="contain" />
        </View>
        <View style={styles.actionCardBody}>
          <LocaleText style={[styles.actionCardTitle, isDark && { color: '#DDE8D8' }]}>{t('city.joinButton')}</LocaleText>
          <LocaleText style={[styles.actionCardSubtitle, isDark && { color: '#8A9A80' }]}>{t('city.joinDescription')}</LocaleText>
        </View>
        <LocaleText style={[styles.actionCardChevron, isDark && { color: '#8A9A80' }]}>›</LocaleText>
      </TouchableOpacity>

      {/* Create City */}
      <TouchableOpacity
        style={[styles.actionCard, isDark ? { backgroundColor: 'rgba(80,55,200,0.42)' } : styles.actionCardGreen]}
        onPress={() => router.push('/city/create')}
        activeOpacity={0.7}
      >
        <View style={[styles.actionCardLeft, isDark && { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
          <Image source={IMG.bank} style={styles.actionImg} contentFit="contain" />
        </View>
        <View style={styles.actionCardBody}>
          <LocaleText style={[styles.actionCardTitle, isDark && { color: '#DDE8D8' }]}>{t('city.createButton')}</LocaleText>
          <LocaleText style={[styles.actionCardSubtitle, isDark && { color: '#8A9A80' }]}>{t('city.createSubtitle')}</LocaleText>
        </View>
        <LocaleText style={[styles.actionCardChevron, isDark && { color: '#8A9A80' }]}>›</LocaleText>
      </TouchableOpacity>

      {/* Rankings */}
      <TouchableOpacity
        style={[styles.actionCard, isDark ? { backgroundColor: 'rgba(175,135,0,0.45)' } : styles.actionCardGold]}
        onPress={() => router.push('/city/rankings')}
        activeOpacity={0.7}
      >
        <View style={[styles.actionCardLeft, isDark && { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
          <Image source={IMG.vipClub} style={styles.actionImg} contentFit="contain" />
        </View>
        <View style={styles.actionCardBody}>
          <LocaleText style={[styles.actionCardTitle, isDark && { color: '#DDE8D8' }]}>{t('city.rankings.button')}</LocaleText>
          <LocaleText style={[styles.actionCardSubtitle, isDark && { color: '#8A9A80' }]}>{t('city.rankings.subtitle')}</LocaleText>
        </View>
        <LocaleText style={[styles.actionCardChevron, isDark && { color: '#8A9A80' }]}>›</LocaleText>
      </TouchableOpacity>
    </ScrollView>
  );
}

function MyCityView({ city, isDark, t, router }: { city: any; isDark: boolean; t: any; router: any }) {
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} style={styles.scrollView}>
      {/* City header card */}
      <TouchableOpacity
        style={[styles.cityCard, isDark ? { backgroundColor: 'rgba(30,60,100,0.45)' } : styles.cityCardLight]}
        onPress={() => router.push(`/city/${city.id}`)}
        activeOpacity={0.8}
      >
        <View style={styles.cityCardTop}>
          <Image source={IMG.cityBuildings} style={styles.cityCardImg} contentFit="contain" />
          <View style={styles.cityCardInfo}>
            <LocaleText style={[styles.cityName, isDark && { color: '#DDE8D8' }]}>{city.name}</LocaleText>
            <LocaleText style={[styles.cityLevel, isDark && { color: '#6BAED0' }]}>
              {t('city.levelLabel', { level: city.level })}
            </LocaleText>
          </View>
          <LocaleText style={[styles.chevronLarge, isDark && { color: '#8A9A80' }]}>›</LocaleText>
        </View>

        {/* Bonus badge */}
        <View style={[styles.bonusBadge, isDark && { backgroundColor: 'rgba(100,200,120,0.2)' }]}>
          <LocaleText style={[styles.bonusBadgeText, isDark && { color: '#7BCF8A' }]}>
            {t('city.bonusLabel', { percent: city.level })}
          </LocaleText>
        </View>

        {/* Members */}
        <LocaleText style={[styles.memberCount, isDark && { color: '#8A9A80' }]}>
          {t('city.memberCount', { count: city.memberCount, max: city.maxMembers })}
        </LocaleText>

        {/* My role */}
        {city.myRole && (
          <View style={styles.roleBadgeRow}>
            <View style={[styles.roleBadge, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
              <LocaleText style={[styles.roleBadgeText, isDark && { color: '#DDE8D8' }]}>
                {t(`city.roles.${city.myRole}`)}
              </LocaleText>
            </View>
          </View>
        )}
      </TouchableOpacity>

      <SectionDivider label={t('city.members')} isDark={isDark} />

      {/* Members */}
      <TouchableOpacity
        style={[styles.actionCard, isDark ? { backgroundColor: 'rgba(30,70,110,0.35)' } : styles.actionCardBlue]}
        onPress={() => router.push(`/city/${city.id}`)}
        activeOpacity={0.7}
      >
        <View style={[styles.actionCardLeft, isDark && { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
          <Image source={IMG.chat} style={styles.actionImg} contentFit="contain" />
        </View>
        <View style={styles.actionCardBody}>
          <LocaleText style={[styles.actionCardTitle, isDark && { color: '#DDE8D8' }]}>{t('city.members')}</LocaleText>
          <LocaleText style={[styles.actionCardSubtitle, isDark && { color: '#8A9A80' }]}>
            {t('city.memberCount', { count: city.memberCount, max: city.maxMembers })}
          </LocaleText>
        </View>
        <LocaleText style={[styles.actionCardChevron, isDark && { color: '#8A9A80' }]}>›</LocaleText>
      </TouchableOpacity>

      {(city.myRole === 'MAYOR' || city.myRole === 'ACTING_MAYOR') && (
        <TouchableOpacity
          style={[styles.actionCard, isDark ? { backgroundColor: 'rgba(80,50,15,0.35)' } : styles.actionCardAmber]}
          onPress={() => router.push(`/city/settings?cityId=${city.id}`)}
          activeOpacity={0.7}
        >
          <View style={[styles.actionCardLeft, isDark && { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
            <Image source={IMG.notice} style={styles.actionImg} contentFit="contain" />
          </View>
          <View style={styles.actionCardBody}>
            <LocaleText style={[styles.actionCardTitle, isDark && { color: '#DDE8D8' }]}>{t('city.settingsTitle')}</LocaleText>
          </View>
          <LocaleText style={[styles.actionCardChevron, isDark && { color: '#8A9A80' }]}>›</LocaleText>
        </TouchableOpacity>
      )}

      {/* Rankings */}
      <TouchableOpacity
        style={[styles.actionCard, isDark ? { backgroundColor: 'rgba(80,55,10,0.35)' } : styles.actionCardGold]}
        onPress={() => router.push('/city/rankings')}
        activeOpacity={0.7}
      >
        <View style={[styles.actionCardLeft, isDark && { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
          <Image source={IMG.vipClub} style={styles.actionImg} contentFit="contain" />
        </View>
        <View style={styles.actionCardBody}>
          <LocaleText style={[styles.actionCardTitle, isDark && { color: '#DDE8D8' }]}>{t('city.rankings.button')}</LocaleText>
          <LocaleText style={[styles.actionCardSubtitle, isDark && { color: '#8A9A80' }]}>{t('city.rankings.subtitle')}</LocaleText>
        </View>
        <LocaleText style={[styles.actionCardChevron, isDark && { color: '#8A9A80' }]}>›</LocaleText>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  background: { flex: 1, backgroundColor: '#DCEFF6' },
  backgroundDark: { backgroundColor: '#0D1F2D' },
  scrollView: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 130, paddingBottom: 100 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Hero (no city)
  hero: { alignItems: 'center', paddingTop: 8, paddingBottom: 20 },
  heroImage: { width: 140, height: 110, marginBottom: 12 },
  heroTagline: { fontFamily: 'Fredoka_700Bold', fontSize: 20, color: '#1C2C1A', textAlign: 'center', marginBottom: 6 },
  heroDescription: { fontFamily: 'Fredoka_500Medium', fontSize: 15, color: '#5A6650', textAlign: 'center' },

  // Divider
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 14, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(0,0,0,0.1)' },
  dividerLabel: { fontFamily: 'Fredoka_600SemiBold', fontSize: 13, color: '#7A9080', letterSpacing: 0.3 },

  // Info cards
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 14, marginBottom: 10, gap: 12 },
  cardBonus: { backgroundColor: '#A8ECC8' },
  cardRequirement: { backgroundColor: '#FFD078' },
  cardImg: { width: 44, height: 44 },
  floorIconWrap: { width: 44, height: 44, position: 'relative' },
  floorBadge: {
    position: 'absolute', top: -6, right: -6,
    backgroundColor: '#E7A52B', borderRadius: 8,
    minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  floorBadgeText: { fontFamily: 'Fredoka_700Bold', fontSize: 11, color: '#FFF', lineHeight: 13 },
  cardBody: { flex: 1 },
  cardTitle: { fontFamily: 'Fredoka_700Bold', fontSize: 15, color: '#1C2C1A', marginBottom: 3 },
  cardText: { fontFamily: 'Fredoka_500Medium', fontSize: 13, color: '#4A5540', lineHeight: 18 },

  // Action cards
  actionCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 16, marginBottom: 10, gap: 14 },
  actionCardBlue: { backgroundColor: '#8ECEF8' },
  actionCardGreen: { backgroundColor: '#C4B0F8' },
  actionCardAmber: { backgroundColor: '#FFD078' },
  actionCardGold: { backgroundColor: '#FFD84A' },
  actionCardLeft: { width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  actionImg: { width: 40, height: 40 },
  actionCardBody: { flex: 1 },
  actionCardTitle: { fontFamily: 'Fredoka_700Bold', fontSize: 16, color: '#1C2C1A', marginBottom: 2 },
  actionCardSubtitle: { fontFamily: 'Fredoka_500Medium', fontSize: 13, color: '#4A6050', lineHeight: 17 },
  actionCardChevron: { fontSize: 26, color: '#7A9A8A', lineHeight: 30 },

  // My city card
  cityCard: { borderRadius: 18, padding: 18, marginBottom: 4 },
  cityCardLight: { backgroundColor: '#D0E8F8' },
  cityCardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  cityCardImg: { width: 52, height: 52 },
  cityCardInfo: { flex: 1 },
  cityName: { fontFamily: 'Fredoka_700Bold', fontSize: 20, color: '#0A1C30', marginBottom: 2 },
  cityLevel: { fontFamily: 'Fredoka_600SemiBold', fontSize: 14, color: '#2E6EC9' },
  chevronLarge: { fontSize: 28, color: '#5A8AB0' },
  bonusBadge: { backgroundColor: 'rgba(50,160,80,0.15)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start', marginBottom: 8 },
  bonusBadgeText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 14, color: '#2A7A3A' },
  memberCount: { fontFamily: 'Fredoka_500Medium', fontSize: 13, color: '#5A7090', marginBottom: 8 },
  roleBadgeRow: { flexDirection: 'row' },
  roleBadge: { backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  roleBadgeText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 13, color: '#1A3050' },
});
