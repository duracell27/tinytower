import React, { useEffect, useState, useCallback } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import LocaleText from '../../src/components/LocaleText';
import AppBackground from '../../src/components/AppBackground';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { api, CityBuildingDto } from '../../src/services/api';
import { useGameClock } from '../../src/hooks/useGameClock';

const HEADER_ICON = require('../../assets/img/city/cityBuildings.png');

const BUILDING_ICONS: Record<string, any> = {
  MOTOR_POOL:       require('../../assets/img/city/cityBuildingAutopark.png'),
  AD_AGENCY:        require('../../assets/img/city/cityBuildingAdvertisingagency.png'),
  CITY_BANK:        require('../../assets/img/city/cityBuildingCityBank.png'),
  BUSINESS_SCHOOL:  require('../../assets/img/city/cityBuildingSchoolofBusiness.png'),
  STATE_ACADEMY:    require('../../assets/img/city/cityBuildingStateAcademy.png'),
  VIP_CLUB:         require('../../assets/img/city/cityBuildingVIPClub.png'),
  VIP_HOTEL:        require('../../assets/img/city/cityBuildingVIPHotel.png'),
};

const BUILDING_ORDER = [
  'MOTOR_POOL', 'AD_AGENCY', 'CITY_BANK', 'BUSINESS_SCHOOL',
  'STATE_ACADEMY', 'VIP_CLUB', 'VIP_HOTEL',
];

function getTimeLeft(isoDate: string | null, nowMs: number) {
  if (!isoDate) return null;
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
  const { t } = useTranslation('tabs');
  const isDark = useAppTheme();
  const insets = useSafeAreaInsets();
  const now = useGameClock(10_000);

  const [buildings, setBuildings] = useState<CityBuildingDto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!cityId) return;
    try {
      const data = await api.getCityBuildings(cityId);
      const sorted = BUILDING_ORDER.map(key => data.find(b => b.buildingType === key)).filter(Boolean) as CityBuildingDto[];
      setBuildings(sorted);
    } catch {
      Alert.alert('', t('city.buildings.loadError'));
    } finally {
      setLoading(false);
    }
  }, [cityId]);

  useEffect(() => { load(); }, [load]);

  const handleUpgrade = async (type: string) => {
    try {
      await api.startCityBuildingUpgrade(cityId!, type);
      load();
    } catch (e: any) {
      Alert.alert('', e?.message ?? 'Error');
    }
  };

  const handleSkip = async (type: string) => {
    try {
      await api.skipCityBuilding(cityId!, type);
      load();
    } catch (e: any) {
      Alert.alert('', e?.message ?? 'Error');
    }
  };

  const handleBoost = async (type: string, boostType: 'coins' | 'gems') => {
    try {
      await api.activateCityBuildingBoost(cityId!, type, boostType);
      load();
    } catch (e: any) {
      Alert.alert('', e?.message ?? 'Error');
    }
  };

  const nowMs = now;

  if (loading) {
    return (
      <AppBackground>
        <ActivityIndicator style={{ flex: 1 }} color={isDark ? '#fff' : '#2E6EC9'} />
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Image source={HEADER_ICON} style={styles.headerIcon} contentFit="contain" />
          <LocaleText style={[styles.headerTitle, isDark && { color: '#DDE8D8' }]}>
            {t('city.buildings.title')}
          </LocaleText>
        </View>

        {buildings.map(b => {
          const name = t(`city.buildings.names.${b.buildingType}`, { defaultValue: b.buildingType });
          const bonusLabel = t(`city.buildings.bonusLabels.${b.buildingType}`, { defaultValue: '' });
          const isBuilding = b.state === 'BUILDING';
          const isActive = b.state === 'ACTIVE';
          const maxed = b.level >= 15;

          const hoursLeft = getHoursLeft(b.buildFinishesAt, nowMs);
          const skipGems = hoursLeft * 10;
          const boostHoursLeft = getHoursLeft(b.boostFinishesAt, nowMs);

          return (
            <View key={b.buildingType} style={[styles.card, isDark && styles.cardDark]}>
              {/* Top row: icon + name + level */}
              <View style={styles.cardTop}>
                <Image source={BUILDING_ICONS[b.buildingType]} style={styles.buildingIcon} contentFit="contain" />
                <View style={styles.cardInfo}>
                  <LocaleText style={[styles.cardName, isDark && { color: '#e2e8f0' }]}>{name}</LocaleText>
                  <LocaleText style={[styles.cardBonus, isDark && { color: '#8a9bbf' }]}>{bonusLabel}</LocaleText>
                  <LocaleText style={[styles.cardLevel, isDark && { color: '#6b7a99' }]}>
                    {t('city.buildings.levelOf', { level: b.level })}
                  </LocaleText>
                </View>
              </View>

              {/* Active bonus */}
              {b.currentBonus > 0 && (
                <LocaleText style={styles.activeBonus}>
                  +{Math.round(b.currentBonus)}{b.isBoosted ? ` ×${b.boostMultiplier}` : ''}
                </LocaleText>
              )}

              {/* Building timer */}
              {isBuilding && b.buildFinishesAt && (
                <View style={styles.row}>
                  <LocaleText style={styles.timer}>
                    {t('city.buildings.building')} {getTimeLeft(b.buildFinishesAt, nowMs)}
                  </LocaleText>
                  <TouchableOpacity style={styles.btn} activeOpacity={0.7} onPress={() => handleSkip(b.buildingType)}>
                    <LocaleText style={styles.btnText}>
                      {t('city.buildings.skipBtn', { gems: skipGems })}
                    </LocaleText>
                  </TouchableOpacity>
                </View>
              )}

              {/* Upgrade button */}
              {(b.level === 0 || isActive) && !maxed && (
                <TouchableOpacity style={styles.btn} activeOpacity={0.7} onPress={() => handleUpgrade(b.buildingType)}>
                  <LocaleText style={styles.btnText}>
                    {b.level === 0
                      ? t('city.buildings.build')
                      : t('city.buildings.upgrade', { next: b.level + 1 })}
                  </LocaleText>
                </TouchableOpacity>
              )}

              {/* Boost buttons */}
              {isActive && !b.isBoosted && (
                <View style={styles.row}>
                  <TouchableOpacity style={[styles.btn, styles.boostBtnCoins]} activeOpacity={0.7} onPress={() => handleBoost(b.buildingType, 'coins')}>
                    <LocaleText style={styles.btnText}>{t('city.buildings.boostCoins')}</LocaleText>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, styles.boostBtnGems]} activeOpacity={0.7} onPress={() => handleBoost(b.buildingType, 'gems')}>
                    <LocaleText style={styles.btnText}>{t('city.buildings.boostGems')}</LocaleText>
                  </TouchableOpacity>
                </View>
              )}

              {/* Boost countdown */}
              {b.isBoosted && b.boostFinishesAt && (
                <LocaleText style={styles.boostTimer}>
                  {t('city.buildings.boostActive', { mult: b.boostMultiplier, hours: boostHoursLeft })}
                </LocaleText>
              )}
            </View>
          );
        })}
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  headerIcon: { width: 36, height: 36 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1a2540' },
  card: {
    backgroundColor: '#f2f6fc',
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  cardDark: { backgroundColor: '#1c2235' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  buildingIcon: { width: 52, height: 52, borderRadius: 10 },
  cardInfo: { flex: 1, gap: 2 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#1a2540' },
  cardBonus: { fontSize: 12, color: '#5a6a8a' },
  cardLevel: { fontSize: 12, color: '#8090a4' },
  activeBonus: { fontSize: 13, color: '#34d399', fontWeight: '600' },
  timer: { fontSize: 13, color: '#f5a623', flex: 1 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  btn: {
    backgroundColor: '#2E6EC9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignSelf: 'flex-start',
  },
  boostBtnCoins: { backgroundColor: '#f5a623' },
  boostBtnGems:  { backgroundColor: '#c084fc' },
  btnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  boostTimer: { fontSize: 12, color: '#c084fc', fontWeight: '600' },
});
