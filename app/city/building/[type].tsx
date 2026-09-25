import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, useColorScheme, Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import LocaleText from '../../../src/components/LocaleText';
import AppBackground from '../../../src/components/AppBackground';
import { useAppTheme } from '../../../src/hooks/useAppTheme';
import { api, CityBuildingDto } from '../../../src/services/api';
import { useCityStore } from '../../../src/stores/cityStore';
import { useGameClock } from '../../../src/hooks/useGameClock';
import { formatCompact, formatNumFull } from '../../../src/utils/format';

// ─── Static config (mirrors server city-building.constants.ts) ───────────────

interface ClientLevelConfig {
  coinsCost: number | null;
  gemsCost: number | null;
  vipGems: number;
  boostCoins: number;
  boostGems: number;
  durationH: number;
}

const LEVEL_CONFIGS: ClientLevelConfig[] = [
  { coinsCost: null,           gemsCost: 1_000,   vipGems: 10_000, boostCoins: 100_000,   boostGems: 100,  durationH: 15  },
  { coinsCost: 10_000_000,     gemsCost: null,    vipGems: 10_000, boostCoins: 200_000,   boostGems: 200,  durationH: 30  },
  { coinsCost: null,           gemsCost: 5_000,   vipGems: 10_000, boostCoins: 300_000,   boostGems: 300,  durationH: 45  },
  { coinsCost: 100_000_000,    gemsCost: null,    vipGems: 10_000, boostCoins: 400_000,   boostGems: 400,  durationH: 60  },
  { coinsCost: null,           gemsCost: 15_000,  vipGems: 10_000, boostCoins: 500_000,   boostGems: 500,  durationH: 74  },
  { coinsCost: 500_000_000,    gemsCost: null,    vipGems: 10_000, boostCoins: 600_000,   boostGems: 600,  durationH: 89  },
  { coinsCost: null,           gemsCost: 25_000,  vipGems: 10_000, boostCoins: 700_000,   boostGems: 700,  durationH: 104 },
  { coinsCost: 2_500_000_000,  gemsCost: null,    vipGems: 10_000, boostCoins: 800_000,   boostGems: 800,  durationH: 119 },
  { coinsCost: null,           gemsCost: 50_000,  vipGems: 10_000, boostCoins: 900_000,   boostGems: 900,  durationH: 134 },
  { coinsCost: 10_000_000_000, gemsCost: null,    vipGems: 10_000, boostCoins: 1_000_000, boostGems: 1000, durationH: 149 },
  { coinsCost: null,           gemsCost: 75_000,  vipGems: 10_000, boostCoins: 1_100_000, boostGems: 1100, durationH: 164 },
  { coinsCost: 25_000_000_000, gemsCost: null,    vipGems: 10_000, boostCoins: 1_200_000, boostGems: 1200, durationH: 179 },
  { coinsCost: null,           gemsCost: 100_000, vipGems: 10_000, boostCoins: 1_300_000, boostGems: 1300, durationH: 194 },
  { coinsCost: 50_000_000_000, gemsCost: null,    vipGems: 10_000, boostCoins: 1_400_000, boostGems: 1400, durationH: 209 },
  { coinsCost: null,           gemsCost: 150_000, vipGems: 10_000, boostCoins: 1_500_000, boostGems: 1500, durationH: 224 },
];

const VIP_BUILDINGS = new Set(['VIP_CLUB', 'VIP_HOTEL']);

const BONUS_PER_LEVEL: Record<string, number> = {
  MOTOR_POOL: 2, AD_AGENCY: 2, CITY_BANK: 2,
  BUSINESS_SCHOOL: 5, STATE_ACADEMY: 5,
  VIP_CLUB: 1, VIP_HOTEL: 3,
};

const BONUS_UNIT: Record<string, string> = {
  MOTOR_POOL: '%', AD_AGENCY: '%', CITY_BANK: '%',
  BUSINESS_SCHOOL: '%', STATE_ACADEMY: '%',
  VIP_CLUB: '', VIP_HOTEL: '',
};

// ─── Visual config ────────────────────────────────────────────────────────────

const PRIMARY    = '#2E6EC9';
const COIN_COLOR = '#C87E00';
const GEM_COLOR  = '#2592AB';

const BUILDING_ACCENT: Record<string, { light: string; dark: string }> = {
  MOTOR_POOL:      { light: '#5E8F42', dark: '#6BA34A' },
  AD_AGENCY:       { light: '#2E6EC9', dark: '#3A7ED8' },
  CITY_BANK:       { light: '#E7A52B', dark: '#F0B030' },
  BUSINESS_SCHOOL: { light: '#9A6FD0', dark: '#A87EDE' },
  STATE_ACADEMY:   { light: '#E05050', dark: '#E86060' },
  VIP_CLUB:        { light: '#C8920A', dark: '#D4A820' },
  VIP_HOTEL:       { light: '#C8920A', dark: '#D4A820' },
};

const BUILDING_ICONS: Record<string, any> = {
  MOTOR_POOL:      require('../../../assets/img/city/cityBuildingAutopark.png'),
  AD_AGENCY:       require('../../../assets/img/city/cityBuildingAdvertisingagency.png'),
  CITY_BANK:       require('../../../assets/img/city/cityBuildingCityBank.png'),
  BUSINESS_SCHOOL: require('../../../assets/img/city/cityBuildingSchoolofBusiness.png'),
  STATE_ACADEMY:   require('../../../assets/img/city/cityBuildingStateAcademy.png'),
  VIP_CLUB:        require('../../../assets/img/city/cityBuildingVIPClub.png'),
  VIP_HOTEL:       require('../../../assets/img/city/cityBuildingVIPHotel.png'),
};

const BONUS_ICON: Record<string, any> = {
  MOTOR_POOL:      require('../../../assets/img/DeliverytruckIcon.png'),
  AD_AGENCY:       require('../../../assets/img/MarketingIcon.png'),
  CITY_BANK:       require('../../../assets/img/coin.png'),
  BUSINESS_SCHOOL: require('../../../assets/img/xpIcon.png'),
  STATE_ACADEMY:   require('../../../assets/img/xpIcon.png'),
  VIP_CLUB:        require('../../../assets/img/diamond.png'),
  VIP_HOTEL:       require('../../../assets/img/worker.png'),
};

const COIN_ICON = require('../../../assets/img/coin.png');
const GEM_ICON  = require('../../../assets/img/diamond.png');

const MAX_LEVEL = 15;

const ROLE_RANK = ['NEWBIE', 'CITIZEN', 'BUSINESSMAN', 'ADVISOR', 'VICE_MAYOR', 'ACTING_MAYOR', 'MAYOR'];
function isAdvisorOrHigher(role: string | null | undefined): boolean {
  if (!role) return false;
  return ROLE_RANK.indexOf(role) >= ROLE_RANK.indexOf('ADVISOR');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTimeLeft(isoDate: string | null, nowMs: number, dUnit: string, hUnit: string, mUnit: string): string {
  if (!isoDate) return '';
  const diff = Math.max(0, new Date(isoDate).getTime() - nowMs);
  const totalSecs = Math.floor(diff / 1000);
  const d = Math.floor(totalSecs / 86400);
  const h = Math.floor((totalSecs % 86400) / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  if (d > 0) return `${d}${dUnit} ${h}${hUnit}`;
  if (h > 0) return `${h}${hUnit} ${m}${mUnit}`;
  return `${m}${mUnit}`;
}

function getHoursLeft(isoDate: string | null, nowMs: number): number {
  if (!isoDate) return 0;
  return Math.ceil(Math.max(0, new Date(isoDate).getTime() - nowMs) / 3_600_000);
}

function formatDuration(hours: number, hUnit: string, dUnit: string): string {
  if (hours >= 24) {
    const d = Math.floor(hours / 24);
    const h = hours % 24;
    return h > 0 ? `${d}${dUnit} ${h}${hUnit}` : `${d}${dUnit}`;
  }
  return `${hours}${hUnit}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BuildingDetailScreen() {
  const { type, id: cityId } = useLocalSearchParams<{ type: string; id: string }>();
  const { t }  = useTranslation('tabs');
  const theme  = useAppTheme();
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const now    = useGameClock(5_000);

  const myRole = useCityStore((s) => s.city?.myRole);
  const canAct = isAdvisorOrHigher(myRole);

  const [building, setBuilding] = useState<CityBuildingDto | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [busy,     setBusy]     = useState(false);

  const load = useCallback(async () => {
    if (!cityId || !type) return;
    try {
      const data = await api.getCityBuildings(cityId);
      const found = data.find(b => b.buildingType === type);
      setBuilding(found ?? null);
    } catch {
      Alert.alert('', t('city.buildings.loadError'));
    } finally {
      setLoading(false);
    }
  }, [cityId, type, t]);

  useEffect(() => { load(); }, [load]);

  async function act(fn: () => Promise<any>) {
    setBusy(true);
    try { await fn(); await load(); }
    catch (e: any) { Alert.alert('', e?.message ?? 'Error'); }
    finally { setBusy(false); }
  }

  const btype   = type ?? '';
  const scheme  = BUILDING_ACCENT[btype] ?? { light: PRIMARY, dark: PRIMARY };
  const accent  = isDark ? scheme.dark : scheme.light;
  const isVip   = VIP_BUILDINGS.has(btype);
  const unit    = BONUS_UNIT[btype] ?? '%';
  const bplv    = BONUS_PER_LEVEL[btype] ?? 0;

  const level   = building?.level ?? 0;
  const state   = building?.state ?? 'IDLE';
  const maxed   = level >= MAX_LEVEL;

  const nextCfg       = level < MAX_LEVEL ? LEVEL_CONFIGS[level] : null;
  const currentCfg    = level > 0 ? LEVEL_CONFIGS[level - 1] : null;

  const boostHoursLeft  = getHoursLeft(building?.boostFinishesAt ?? null, now);
  const buildTimeLeft   = getTimeLeft(
    building?.buildFinishesAt ?? null, now,
    t('city.buildings.detail.daysUnit'),
    t('city.buildings.detail.hoursUnitShort'),
    t('city.buildings.detail.minsUnitShort'),
  );
  const skipGems        = getHoursLeft(building?.buildFinishesAt ?? null, now) * 10;

  const isGemBoost = (building?.boostMultiplier ?? 0) >= 2;

  const blinkAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (state !== 'BUILDING') { blinkAnim.setValue(1); return; }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 0.15, duration: 1500, useNativeDriver: true }),
        Animated.timing(blinkAnim, { toValue: 1,    duration: 1500, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [state]);

  const cardBg   = isDark ? '#1E2C42' : '#FFFFFF';
  const pageBg   = isDark ? '#0D1F2D' : '#DCEFF6';

  return (
    <View style={styles.container}>
      <AppBackground style={[styles.bg, { backgroundColor: pageBg }]}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Card 1: назва + кнопка назад ── */}
          <View style={[styles.nameCard, { backgroundColor: cardBg }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
              <LocaleText style={[styles.backText, { color: isDark ? '#8AAFD4' : PRIMARY }]}>‹</LocaleText>
            </TouchableOpacity>
            <LocaleText style={[styles.headerName, { color: accent }]} numberOfLines={1}>
              {t(`city.buildings.names.${btype}`)}
            </LocaleText>
            <View style={{ width: 36 }} />
          </View>

          {/* ── Card 2: іконка зліва, рівень справа, прогрес знизу ── */}
          <View style={[styles.iconCard, { backgroundColor: cardBg }]}>
            <View style={styles.iconCardTop}>
              <View style={[styles.headerIconWrap, { backgroundColor: accent + '28' }]}>
                <Image
                  source={BUILDING_ICONS[btype]}
                  style={styles.headerIcon}
                  contentFit="contain"
                />
              </View>
              <View style={styles.levelCircleGroup}>
                <View style={[styles.levelCircle, { backgroundColor: accent }]}>
                  <LocaleText style={styles.levelCircleText}>
                    {maxed ? 'MAX' : (state === 'BUILDING' ? level - 1 : level)}
                  </LocaleText>
                </View>
                <View style={styles.levelBonusRow}>
                  <LocaleText style={[styles.levelBonusLabel, { color: theme.textMuted }]}>
                    {t('city.buildings.bonusLabel')}
                  </LocaleText>
                  <Image source={BONUS_ICON[btype]} style={styles.levelBonusIcon} contentFit="contain" />
                  <LocaleText style={[styles.levelBonusText, { color: accent }]}>
                    {`+${Math.round(building?.currentBonus ?? 0)}${unit}`}
                  </LocaleText>
                </View>
              </View>
            </View>
            <View style={styles.progressSegments}>
              {Array.from({ length: MAX_LEVEL }, (_, i) => {
                const filledLevel = state === 'BUILDING' ? level - 1 : level;
                const isBuilding  = state === 'BUILDING' && i === level - 1;
                if (isBuilding) {
                  return (
                    <Animated.View
                      key={i}
                      style={[styles.progressSegment, { backgroundColor: accent, opacity: blinkAnim }]}
                    />
                  );
                }
                return (
                  <View
                    key={i}
                    style={[styles.progressSegment, { backgroundColor: i < filledLevel ? accent : accent + '35' }]}
                  />
                );
              })}
            </View>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={isDark ? '#6BAED0' : PRIMARY} />
            </View>
          ) : (
            <>

              {/* ── About ── */}
              <View style={[styles.section, { backgroundColor: cardBg }]}>
                <LocaleText style={[styles.sectionTitle, { color: accent }]}>
                  {t('city.buildings.detail.aboutTitle')}
                </LocaleText>
                <LocaleText style={[styles.descText, { color: theme.textMuted }]}>
                  {t(`city.buildings.descriptions.${btype}`)}
                </LocaleText>
              </View>

              {/* ── Building in progress ── */}
              {canAct && state === 'BUILDING' && building?.buildFinishesAt && (
                <View style={[styles.section, { backgroundColor: cardBg }]}>
                  <LocaleText style={[styles.sectionTitle, { color: accent }]}>
                    {t('city.buildings.detail.buildingTitle')}
                  </LocaleText>

                  <View style={styles.infoTiles}>
                    <View style={[styles.infoTile, { backgroundColor: isDark ? '#243248' : '#F4F8FF' }]}>
                      <LocaleText style={[styles.infoTileLabel, { color: theme.textMuted }]}>
                        {t('city.buildings.detail.tileTimeLeft')}
                      </LocaleText>
                      <LocaleText style={[styles.infoTileValue, { color: COIN_COLOR }]}>
                        {buildTimeLeft}
                      </LocaleText>
                    </View>
                    <View style={[styles.infoTile, { backgroundColor: isDark ? '#243248' : '#F4F8FF' }]}>
                      <View style={styles.infoTileIconRow}>
                        <Image source={GEM_ICON} style={styles.infoTileIcon} contentFit="contain" />
                        <LocaleText style={[styles.infoTileLabel, { color: theme.textMuted }]}>
                          {t('city.buildings.detail.tileSkip')}
                        </LocaleText>
                      </View>
                      <LocaleText style={[styles.infoTileValue, { color: GEM_COLOR }]}>
                        {formatNumFull(skipGems)}
                      </LocaleText>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: GEM_COLOR }, busy && styles.disabled]}
                    activeOpacity={0.78}
                    disabled={busy}
                    onPress={() => act(() => api.skipCityBuilding(cityId!, btype))}
                  >
                    <Image source={GEM_ICON} style={styles.btnIcon} contentFit="contain" />
                    <LocaleText style={styles.btnText}>
                      {t('city.buildings.detail.skipBtn')}
                    </LocaleText>
                  </TouchableOpacity>
                </View>
              )}

              {/* ── Upgrade / Build ── */}
              {canAct && (state === 'IDLE' || (state === 'ACTIVE' && !maxed)) && nextCfg && (
                <View style={[styles.section, { backgroundColor: cardBg }]}>
                  <LocaleText style={[styles.sectionTitle, { color: accent }]}>
                    {state === 'IDLE'
                      ? t('city.buildings.detail.buildTitle')
                      : t('city.buildings.detail.upgradeTitle')}
                  </LocaleText>

                  <View style={styles.infoTiles}>
                    {/* Cost tile */}
                    <View style={[styles.infoTile, { backgroundColor: isDark ? '#243248' : '#F4F8FF' }]}>
                      <View style={styles.infoTileIconRow}>
                        <Image
                          source={isVip || nextCfg.gemsCost != null ? GEM_ICON : COIN_ICON}
                          style={styles.infoTileIcon}
                          contentFit="contain"
                        />
                        <LocaleText style={[styles.infoTileLabel, { color: theme.textMuted }]}>
                          {t('city.buildings.detail.fromBudget')}
                        </LocaleText>
                      </View>
                      <LocaleText style={[styles.infoTileValue, {
                        color: (isVip || nextCfg.gemsCost != null) ? GEM_COLOR : COIN_COLOR,
                      }]}>
                        {formatNumFull(isVip
                          ? nextCfg.vipGems
                          : nextCfg.gemsCost ?? nextCfg.coinsCost!)}
                      </LocaleText>
                    </View>

                    {/* Duration tile */}
                    <View style={[styles.infoTile, { backgroundColor: isDark ? '#243248' : '#F4F8FF' }]}>
                      <LocaleText style={[styles.infoTileLabel, { color: theme.textMuted }]}>
                        {t('city.buildings.detail.tileBuildTime')}
                      </LocaleText>
                      <LocaleText style={[styles.infoTileValue, { color: theme.text }]}>
                        {formatDuration(nextCfg.durationH, t('city.buildings.detail.hoursUnitShort'), t('city.buildings.detail.daysUnit'))}
                      </LocaleText>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: accent }, busy && styles.disabled]}
                    activeOpacity={0.78}
                    disabled={busy}
                    onPress={() => {
                      const isIdle = state === 'IDLE';
                      Alert.alert(
                        t('city.buildings.detail.confirmTitle'),
                        isIdle
                          ? t('city.buildings.detail.confirmBuildMsg')
                          : t('city.buildings.detail.confirmUpgradeMsg', { next: level + 1 }),
                        [
                          { text: t('city.buildings.detail.confirmNo'), style: 'cancel' },
                          {
                            text: isIdle
                              ? t('city.buildings.detail.confirmYes')
                              : t('city.buildings.detail.confirmUpgradeYes'),
                            onPress: () => act(() => api.startCityBuildingUpgrade(cityId!, btype)),
                          },
                        ],
                      );
                    }}
                  >
                    <LocaleText style={styles.btnText}>
                      {state === 'IDLE'
                        ? t('city.buildings.detail.buildBtn')
                        : t('city.buildings.detail.upgradeBtn', { next: level + 1 })}
                    </LocaleText>
                  </TouchableOpacity>
                </View>
              )}

              {/* ── Max level ── */}
              {maxed && (
                <View style={[styles.section, { backgroundColor: cardBg }]}>
                  <LocaleText style={[styles.sectionTitle, { color: accent }]}>
                    {t('city.buildings.detail.maxLevelTitle')}
                  </LocaleText>
                  <LocaleText style={[styles.descText, { color: theme.textMuted }]}>
                    {t('city.buildings.detail.maxLevelDesc')}
                  </LocaleText>
                </View>
              )}

              {/* ── Boost ── */}
              {canAct && state === 'ACTIVE' && !building?.isBoosted && currentCfg && (
                <View style={[styles.section, { backgroundColor: cardBg }]}>
                  <LocaleText style={[styles.sectionTitle, { color: accent }]}>
                    {t('city.buildings.detail.boostTitle')}
                  </LocaleText>
                  <LocaleText style={[styles.descText, { color: theme.textMuted }]}>
                    {t('city.buildings.detail.fromBudget')}
                  </LocaleText>

                  <View style={styles.boostBtns}>
                    <TouchableOpacity
                      style={[styles.boostBtn, { backgroundColor: COIN_COLOR }, busy && styles.disabled]}
                      activeOpacity={0.78}
                      disabled={busy}
                      onPress={() => act(() => api.activateCityBuildingBoost(cityId!, btype, 'coins'))}
                    >
                      <View style={styles.boostBtnInner}>
                        <LocaleText style={styles.btnText}>
                          {t('city.buildings.detail.boostCoinBtn')}
                        </LocaleText>
                        <View style={styles.boostBtnCostRow}>
                          <LocaleText style={styles.boostBtnCost}>
                            {formatCompact(currentCfg.boostCoins)}
                          </LocaleText>
                          <Image source={COIN_ICON} style={styles.boostBtnCostIcon} contentFit="contain" />
                        </View>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.boostBtn, { backgroundColor: GEM_COLOR }, busy && styles.disabled]}
                      activeOpacity={0.78}
                      disabled={busy}
                      onPress={() => act(() => api.activateCityBuildingBoost(cityId!, btype, 'gems'))}
                    >
                      <View style={styles.boostBtnInner}>
                        <LocaleText style={styles.btnText}>
                          {t('city.buildings.detail.boostGemBtn')}
                        </LocaleText>
                        <View style={styles.boostBtnCostRow}>
                          <LocaleText style={styles.boostBtnCost}>
                            {formatCompact(currentCfg.boostGems)}
                          </LocaleText>
                          <Image source={GEM_ICON} style={styles.boostBtnCostIcon} contentFit="contain" />
                        </View>
                      </View>
                    </TouchableOpacity>
                  </View>
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
  bg:        { flex: 1 },
  scroll:    { paddingHorizontal: 14, gap: 12 },
  center:    { paddingVertical: 48, alignItems: 'center' },

  /* Card 1 — назва */
  nameCard: {
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn:    { width: 36 },
  backText:   { fontSize: 28, lineHeight: 32, fontFamily: 'Fredoka_600SemiBold' },
  headerName: { flex: 1, fontFamily: 'Fredoka_700Bold', fontSize: 20, textAlign: 'center' },

  /* Card 2 — іконка + рівень + прогрес */
  iconCard: {
    borderRadius: 20,
    paddingTop: 24,
    paddingBottom: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  iconCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  headerIconWrap: {
    width: 160,
    height: 160,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: { width: 126, height: 126 },
  levelCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelCircleText: { fontFamily: 'Fredoka_700Bold', fontSize: 26, color: '#FFFFFF' },
  levelCircleGroup: { alignItems: 'center', gap: 18 },
  levelBonusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  levelBonusLabel: { fontFamily: 'Fredoka_600SemiBold', fontSize: 16 },
  levelBonusIcon: { width: 18, height: 18 },
  levelBonusText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 16 },

  progressSegments: {
    flexDirection: 'row',
    gap: 2,
  },
  progressSegment: {
    flex: 1,
    height: 8,
    borderRadius: 3,
  },

  /* Section card */
  section: {
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  sectionTitle: { fontFamily: 'Fredoka_700Bold', fontSize: 16 },
  sectionDivider: { height: StyleSheet.hairlineWidth },
  descText: { fontFamily: 'Fredoka_400Regular', fontSize: 14, lineHeight: 20 },

  /* Bonus */
  bonusInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bonusIcon:    { width: 22, height: 22 },
  bonusPerLvl:  { fontFamily: 'Fredoka_600SemiBold', fontSize: 14 },

  bonusCurrent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bonusCurrentLabel: { fontFamily: 'Fredoka_400Regular', fontSize: 14 },
  bonusCurrentValue: { fontFamily: 'Fredoka_700Bold', fontSize: 20 },

  boostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  boostBadgeIcon: { width: 16, height: 16 },
  boostBadgeText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 14 },

  /* Info tiles */
  infoTiles: { flexDirection: 'row', gap: 10 },
  infoTile: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTileIconRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  infoTileIcon: { width: 14, height: 14 },
  infoTileLabel: { fontFamily: 'Fredoka_400Regular', fontSize: 12, textAlign: 'center' },
  infoTileValue: { fontFamily: 'Fredoka_700Bold', fontSize: 18, textAlign: 'center' },

  /* Boost buttons */
  boostBtns: { flexDirection: 'row', gap: 10 },
  boostBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 8,
  },
  boostBtnInner: { alignItems: 'center', gap: 8 },
  boostBtnCostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  boostBtnCost: { color: '#FFFFFF', fontFamily: 'Fredoka_600SemiBold', fontSize: 15 },
  boostBtnCostIcon: { width: 13, height: 13 },

  /* Action button */
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 13,
    gap: 8,
  },
  btnText: { color: '#FFFFFF', fontFamily: 'Fredoka_700Bold', fontSize: 18 },
  btnIcon: { width: 18, height: 18 },

  disabled: { opacity: 0.5 },
});
