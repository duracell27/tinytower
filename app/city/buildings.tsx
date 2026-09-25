import React, { useEffect, useState, useCallback } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, useColorScheme,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import LocaleText from '../../src/components/LocaleText';
import AppBackground from '../../src/components/AppBackground';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { api, CityBuildingDto } from '../../src/services/api';
import { useGameClock } from '../../src/hooks/useGameClock';

const PRIMARY    = '#2E6EC9';
const COIN_COLOR = '#F5A623';
const GEM_COLOR  = '#9B59D0';

const BUILDINGS_ICON  = require('../../assets/img/city/cityBuildings.png');
const NO_BUILDING_ICON = require('../../assets/img/city/NoBuilding.png');
const COIN_ICON       = require('../../assets/img/coin.png');
const GEM_ICON        = require('../../assets/img/diamond.png');

const BUILDING_ICONS: Record<string, any> = {
  MOTOR_POOL:      require('../../assets/img/city/cityBuildingAutopark.png'),
  AD_AGENCY:       require('../../assets/img/city/cityBuildingAdvertisingagency.png'),
  CITY_BANK:       require('../../assets/img/city/cityBuildingCityBank.png'),
  BUSINESS_SCHOOL: require('../../assets/img/city/cityBuildingSchoolofBusiness.png'),
  STATE_ACADEMY:   require('../../assets/img/city/cityBuildingStateAcademy.png'),
  VIP_CLUB:        require('../../assets/img/city/cityBuildingVIPClub.png'),
  VIP_HOTEL:       require('../../assets/img/city/cityBuildingVIPHotel.png'),
};

// Matches floor header color schemes (green→blue→yellow→purple→red→gold→gold)
const BUILDING_ACCENT: Record<string, { light: string; dark: string }> = {
  MOTOR_POOL:      { light: '#5E8F42', dark: '#6BA34A' },
  AD_AGENCY:       { light: '#2E6EC9', dark: '#3A7ED8' },
  CITY_BANK:       { light: '#E7A52B', dark: '#F0B030' },
  BUSINESS_SCHOOL: { light: '#9A6FD0', dark: '#A87EDE' },
  STATE_ACADEMY:   { light: '#E05050', dark: '#E86060' },
  VIP_CLUB:        { light: '#C8920A', dark: '#D4A820' },
  VIP_HOTEL:       { light: '#C8920A', dark: '#D4A820' },
};

// Bonus value unit suffix per building type
const BONUS_UNIT: Record<string, string> = {
  MOTOR_POOL:      '%',
  AD_AGENCY:       '%',
  CITY_BANK:       '%',
  BUSINESS_SCHOOL: '%',
  STATE_ACADEMY:   '%',
  VIP_CLUB:        '',
  VIP_HOTEL:       '',
};

// Game image icons per bonus type
const BONUS_ICON: Record<string, any> = {
  MOTOR_POOL:      require('../../assets/img/DeliverytruckIcon.png'),
  AD_AGENCY:       require('../../assets/img/MarketingIcon.png'),
  CITY_BANK:       require('../../assets/img/coin.png'),
  BUSINESS_SCHOOL: require('../../assets/img/xpIcon.png'),
  STATE_ACADEMY:   require('../../assets/img/xpIcon.png'),
  VIP_CLUB:        require('../../assets/img/diamond.png'),
  VIP_HOTEL:       require('../../assets/img/worker.png'),
};

const BUILDING_ORDER = [
  'MOTOR_POOL', 'AD_AGENCY', 'CITY_BANK', 'BUSINESS_SCHOOL',
  'STATE_ACADEMY', 'VIP_CLUB', 'VIP_HOTEL',
];

const MAX_LEVEL = 15;

function getTimeLeft(isoDate: string | null, nowMs: number): string {
  if (!isoDate) return '';
  const diff = Math.max(0, new Date(isoDate).getTime() - nowMs);
  const totalSecs = Math.floor(diff / 1000);
  const d = Math.floor(totalSecs / 86400);
  const h = Math.floor((totalSecs % 86400) / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  if (d > 0) return `${d}д ${h}г`;
  if (h > 0) return `${h}г ${m}хв`;
  return `${m}хв`;
}

function getHoursLeft(isoDate: string | null, nowMs: number): number {
  if (!isoDate) return 0;
  return Math.ceil(Math.max(0, new Date(isoDate).getTime() - nowMs) / 3_600_000);
}

export default function CityBuildingsScreen() {
  const { id: cityId } = useLocalSearchParams<{ id: string }>();
  const { t }  = useTranslation('tabs');
  const theme  = useAppTheme();
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const now    = useGameClock(10_000);

  const [buildings, setBuildings] = useState<CityBuildingDto[]>([]);
  const [loading,   setLoading]   = useState(true);

  const load = useCallback(async () => {
    if (!cityId) return;
    try {
      const data = await api.getCityBuildings(cityId);
      const sorted = BUILDING_ORDER
        .map(k => data.find(b => b.buildingType === k))
        .filter(Boolean) as CityBuildingDto[];
      setBuildings(sorted);
    } catch {
      Alert.alert('', t('city.buildings.loadError'));
    } finally {
      setLoading(false);
    }
  }, [cityId, t]);

  useEffect(() => { load(); }, [load]);

  const activeCount = buildings.filter(b => b.state === 'ACTIVE').length;

  return (
    <View style={styles.container}>
      <AppBackground style={[styles.bg, isDark && styles.bgDark]}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero ── */}
          <View style={[styles.hero, { backgroundColor: isDark ? '#1A2E3E' : '#FFFFFF' }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
              <LocaleText style={[styles.backText, { color: isDark ? '#8AAFD4' : PRIMARY }]}>‹</LocaleText>
            </TouchableOpacity>
            <View style={styles.heroCenter}>
              <Image source={BUILDINGS_ICON} style={styles.heroIcon} contentFit="contain" />
              <View style={styles.heroTextWrap}>
                <LocaleText style={[styles.heroTitle, { color: theme.text }]}>
                  {t('city.sections.buildings')}
                </LocaleText>
                <LocaleText style={[styles.heroSub, { color: theme.textMuted }]}>
                  {t('city.buildings.headerDesc', { active: activeCount, total: 7 })}
                </LocaleText>
              </View>
            </View>
            <View style={{ width: 36 }} />
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={isDark ? '#6BAED0' : PRIMARY} />
            </View>
          ) : (
            buildings.map(b => {
              const scheme     = BUILDING_ACCENT[b.buildingType] ?? { light: PRIMARY, dark: PRIMARY };
              const accent     = isDark ? scheme.dark : scheme.light;
              const isBuild    = b.state === 'BUILDING';
              const maxed      = b.level >= MAX_LEVEL;
              const boostHours = getHoursLeft(b.boostFinishesAt, now);
              const isGemBoost = (b.boostMultiplier ?? 0) >= 2;
              const cardBg     = isDark ? '#1E2C42' : '#FFFFFF';

              return (
                <TouchableOpacity
                  key={b.buildingType}
                  activeOpacity={0.75}
                  onPress={() => router.push({
                    pathname: '/city/building/[type]',
                    params: { type: b.buildingType, id: cityId },
                  })}
                  style={[styles.card, { backgroundColor: cardBg, borderLeftColor: accent, borderLeftWidth: 4 }]}
                >
                  <View style={styles.cap}>
                    {/* Icon */}
                    <View style={[styles.iconWrap, { backgroundColor: accent + '28' }]}>
                      <Image
                        source={b.level === 0 ? NO_BUILDING_ICON : BUILDING_ICONS[b.buildingType]}
                        style={styles.capIcon}
                        contentFit="contain"
                      />
                    </View>

                    {/* Text block */}
                    <View style={styles.capBody}>
                      <LocaleText style={[styles.capName, { color: theme.text }]}>
                        {t(`city.buildings.names.${b.buildingType}`)}
                      </LocaleText>

                      {/* Bonus row */}
                      <View style={styles.bonusRow}>
                        <LocaleText style={[styles.bonusLabel, { color: theme.textMuted }]}>
                          {t('city.buildings.bonusLabel')}
                        </LocaleText>
                        <Image
                          source={BONUS_ICON[b.buildingType]}
                          style={styles.bonusIcon}
                          contentFit="contain"
                        />
                        <LocaleText style={[styles.bonusValue, { color: b.currentBonus > 0 ? accent : theme.textMuted }]}>
                          {`+${Math.round(b.currentBonus)}${BONUS_UNIT[b.buildingType] ?? '%'}`}
                        </LocaleText>
                        {isBuild && (
                          <View style={[styles.buildingTag, { backgroundColor: COIN_COLOR + '22' }]}>
                            <LocaleText style={[styles.buildingTagText, { color: COIN_COLOR }]}>
                              {t('city.buildings.building')}
                            </LocaleText>
                          </View>
                        )}
                      </View>

                      {/* Boost / Timer line */}
                      {b.isBoosted && boostHours > 0 && (
                        <View style={styles.boostLine}>
                          <Image
                            source={isGemBoost ? GEM_ICON : COIN_ICON}
                            style={styles.boostLineIcon}
                            contentFit="contain"
                          />
                          <LocaleText style={[styles.boostLineText, { color: isGemBoost ? GEM_COLOR : COIN_COLOR }]}>
                            ×{b.boostMultiplier}{'  '}{boostHours}{t('city.buildings.hoursUnit')}
                          </LocaleText>
                        </View>
                      )}
                      {isBuild && b.buildFinishesAt && (
                        <LocaleText style={[styles.boostLineText, { color: COIN_COLOR }]}>
                          ⏱ {getTimeLeft(b.buildFinishesAt, now)}
                        </LocaleText>
                      )}
                    </View>

                    {/* Right side: level circle + chevron */}
                    <View style={styles.cardRight}>
                      {maxed ? (
                        <View style={[styles.levelCircle, { backgroundColor: accent }]}>
                          <LocaleText style={styles.levelTextSmall}>MAX</LocaleText>
                        </View>
                      ) : (
                        <View style={[styles.levelCircle, { backgroundColor: accent }]}>
                          <LocaleText style={styles.levelText}>{isBuild ? b.level - 1 : b.level}</LocaleText>
                        </View>
                      )}
                      <LocaleText style={[styles.chevron, { color: isDark ? '#4A6A8A' : '#AACCDD' }]}>›</LocaleText>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </AppBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bg:        { flex: 1, backgroundColor: '#DCEFF6' },
  bgDark:    { backgroundColor: '#0D1F2D' },
  center:    { paddingVertical: 48, alignItems: 'center' },
  scroll:    { paddingHorizontal: 14, gap: 10 },

  /* Hero */
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  backBtn:      { width: 36 },
  backText:     { fontSize: 28, lineHeight: 32, fontFamily: 'Fredoka_600SemiBold' },
  heroCenter:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  heroIcon:     { width: 36, height: 36 },
  heroTextWrap: { gap: 1 },
  heroTitle:    { fontFamily: 'Fredoka_700Bold', fontSize: 20 },
  heroSub:      { fontFamily: 'Fredoka_400Regular', fontSize: 12 },

  /* Card */
  card: { borderRadius: 18, overflow: 'hidden' },

  /* Cap */
  cap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  iconWrap:  { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  capIcon:   { width: 50, height: 50 },


  capBody: { flex: 1, gap: 4 },
  capName: { fontFamily: 'Fredoka_600SemiBold', fontSize: 16 },

  /* Bonus row */
  bonusRow:   { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  bonusLabel: { fontFamily: 'Fredoka_400Regular', fontSize: 13 },
  bonusIcon:  { width: 16, height: 16 },
  bonusValue: { fontFamily: 'Fredoka_700Bold', fontSize: 14 },
  bonusDesc:  { fontFamily: 'Fredoka_400Regular', fontSize: 12 },

  buildingTag:     { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1 },
  buildingTagText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 11 },

  /* Boost inline */
  boostLine:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  boostLineIcon: { width: 12, height: 12 },
  boostLineText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 12 },

  /* Level circle */
  levelCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelText: { fontFamily: 'Fredoka_700Bold', fontSize: 15, color: '#FFFFFF' },

  cardRight: { alignItems: 'center', gap: 4 },
  chevron: { fontSize: 22, lineHeight: 24, fontFamily: 'Fredoka_600SemiBold' },

  levelTextSmall: { fontFamily: 'Fredoka_700Bold', fontSize: 10, color: '#FFFFFF' },
});
