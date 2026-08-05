import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import AppBackground from '../../src/components/AppBackground';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { api, type PlayerProfile } from '../../src/services/api';
import { getUserIcon } from '../../src/utils/userIcon';
import { xpForLevel } from '../../shared/engine/xp';
import { ACHIEVEMENT_CATEGORIES } from '../../shared/config/achievementCategories';
import { formatNum } from '../../src/utils/format';

const STAR_FULL  = require('../../assets/img/starFull.png');
const STAR_66    = require('../../assets/img/star66.png');
const STAR_33    = require('../../assets/img/star33.png');
const STAR_EMPTY = require('../../assets/img/starEmpty.png');

const BUSINESS_NAMES: Record<string, string> = {
  green:  'Зелений',
  blue:   'Синій',
  yellow: 'Жовтий',
  purple: 'Фіолетовий',
  red:    'Червоний',
};

const BUSINESS_COLORS: Record<string, string> = {
  green: '#3FA535', blue: '#3376E5', yellow: '#E5A72E', purple: '#9A6FD0', red: '#E05A4A',
};

const FLOOR_TYPES = ['green', 'blue', 'yellow', 'purple', 'red'] as const;

function starSource(avg: number, idx: number) {
  const rem = avg - idx;
  if (rem >= 1)     return STAR_FULL;
  if (rem >= 2 / 3) return STAR_66;
  if (rem >= 1 / 3) return STAR_33;
  return STAR_EMPTY;
}

function FloorStarsRow({ avg }: { avg: number }) {
  return (
    <View style={pStyles.starsRow}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Image key={i} source={starSource(avg, i)} style={pStyles.star} contentFit="contain" />
      ))}
    </View>
  );
}

function SectionHeader({ label }: { label: string }) {
  return <Text style={pStyles.sectionHeader}>{label}</Text>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={pStyles.infoRow}>
      <Text style={pStyles.infoLabel}>{label}</Text>
      <Text style={pStyles.infoValue}>{value}</Text>
    </View>
  );
}

function formatLastSeen(lastSeenAt: string): string {
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  if (diff < 5 * 60 * 1000) return 'Онлайн';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} хв тому`;
  const hrs = Math.floor(diff / 3_600_000);
  if (hrs < 24) return `${hrs} год тому`;
  return `${Math.floor(diff / 86_400_000)} дн тому`;
}

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [achievementsOpen, setAchievementsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getPlayerProfile(id)
      .then((p) => { if (!cancelled) setProfile(p); })
      .catch(() => { if (!cancelled) setError('Не вдалося завантажити профіль'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  const isOnline = profile
    ? Date.now() - new Date(profile.lastSeenAt).getTime() < 5 * 60 * 1000
    : false;

  const daysInGame = profile
    ? Math.floor((Date.now() - new Date(profile.createdAt).getTime()) / 86_400_000)
    : 0;

  const xpNeeded = profile ? xpForLevel(profile.playerLevel) : 1;
  const xpProgress = profile ? Math.min(1, profile.playerXp / xpNeeded) : 0;

  const totalAchievementLevels = profile
    ? ACHIEVEMENT_CATEGORIES.reduce(
        (sum, cat) => sum + (profile.categoryProgress[cat.key] ?? 0), 0)
    : 0;

  return (
    <AppBackground style={{ flex: 1 }}>
      {/* Back button */}
      <Pressable onPress={() => router.back()} style={pStyles.backBtn} hitSlop={12}>
        <Text style={pStyles.backChevron}>{'‹'}</Text>
        <Text style={pStyles.backText}>Назад</Text>
      </Pressable>

      {loading && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#3FA535" />
        </View>
      )}

      {error && !loading && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={pStyles.errorText}>{error}</Text>
        </View>
      )}

      {!loading && !error && profile && (
        <ScrollView contentContainerStyle={pStyles.scroll} showsVerticalScrollIndicator={false}>

          {/* Block 1: Header card */}
          <View style={[pStyles.card, { backgroundColor: theme.surface }]}>
            <FloorStarsRow avg={profile.avgStars} />
            <View style={pStyles.profileRow}>
              <Image source={getUserIcon(profile.playerLevel)} style={pStyles.avatar} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={[pStyles.name, { color: theme.text }]}>{profile.playerName}</Text>
                {profile.city ? (
                  <Text style={[pStyles.cityLabel, { color: theme.textMuted }]}>{profile.city}</Text>
                ) : null}
              </View>
            </View>

            {/* Level + XP bar */}
            <View style={pStyles.levelRow}>
              <Text style={[pStyles.levelValue, { color: theme.text }]}>{profile.playerLevel}</Text>
              <Image source={require('../../assets/img/lvlIcon.png')} style={{ width: 28, height: 28 }} contentFit="contain" />
            </View>
            <View style={pStyles.xpBar}>
              <View style={[pStyles.xpFill, { width: `${xpProgress * 100}%` as any }]} />
            </View>

            {/* Floor count */}
            <View style={[pStyles.floorRow, { borderTopColor: theme.divider }]}>
              <Text style={[pStyles.floorLabel, { color: theme.textMuted }]}>Поверхів</Text>
              <Text style={[pStyles.floorValue, { color: theme.text }]}>{profile.openedFloorsCount}</Text>
            </View>

            {/* Happy / Specialist */}
            <View style={[pStyles.workerRow, { borderTopColor: theme.divider }]}>
              <View style={pStyles.workerItem}>
                <Image source={require('../../assets/img/happySmile.png')} style={pStyles.workerIcon} contentFit="contain" />
                <View>
                  <Text style={[pStyles.workerLabel, { color: theme.textMuted }]}>Щасливі</Text>
                  <Text style={[pStyles.workerValue, { color: theme.text }]}>{profile.happyWorkers}/{profile.totalWorkers}</Text>
                </View>
              </View>
              <View style={pStyles.workerItem}>
                <Image source={require('../../assets/img/specialistWorker.png')} style={pStyles.workerIcon} contentFit="contain" />
                <View>
                  <Text style={[pStyles.workerLabel, { color: theme.textMuted }]}>Спеціалісти</Text>
                  <Text style={[pStyles.workerValue, { color: theme.text }]}>{profile.specialistWorkers}/{profile.totalWorkers}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Block 2: Actions */}
          <Pressable style={[pStyles.actionBtn, { backgroundColor: theme.surface }]}>
            <Text style={[pStyles.actionBtnText, { color: theme.text }]}>Написати повідомлення</Text>
          </Pressable>
          <Pressable style={[pStyles.actionBtn, { backgroundColor: theme.surface }]}>
            <Text style={[pStyles.actionBtnText, { color: '#3FA535' }]}>Додати до друзів</Text>
          </Pressable>

          {/* Block 3: Achievements */}
          <Pressable
            style={[pStyles.actionBtn, { backgroundColor: theme.surface }]}
            onPress={() => setAchievementsOpen((v) => !v)}
          >
            <Image source={require('../../assets/img/profile/achivProfileIcon.png')} style={pStyles.actionIcon} contentFit="contain" />
            <Text style={[pStyles.actionBtnText, { flex: 1, color: theme.text }]}>
              Досягнення ({totalAchievementLevels})
            </Text>
            <Text style={{ color: theme.textMuted, fontSize: 18 }}>{achievementsOpen ? '▲' : '▼'}</Text>
          </Pressable>

          {achievementsOpen && (
            <View style={[pStyles.dropdownCard, { backgroundColor: theme.surface }]}>
              {ACHIEVEMENT_CATEGORIES.map((cat) => {
                const level = profile.categoryProgress[cat.key] ?? 0;
                return (
                  <View key={cat.key} style={pStyles.achieveRow}>
                    <Text style={[pStyles.achieveName, { color: level > 0 ? theme.text : theme.textMuted }]}>
                      {cat.title}
                    </Text>
                    <Text style={[pStyles.achieveLevel, { color: level > 0 ? '#3FA535' : theme.textMuted }]}>
                      L{level}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Block 4: Business */}
          <SectionHeader label="Бізнес" />
          <View style={[pStyles.card, { backgroundColor: theme.surface }]}>
            {FLOOR_TYPES.map((ft) => {
              const level = profile.businessUpgrades[ft] ?? 0;
              const pct = Math.round((level / 40) * 100);
              return (
                <View key={ft} style={pStyles.businessRow}>
                  <View style={[pStyles.businessDot, { backgroundColor: BUSINESS_COLORS[ft] }]} />
                  <Text style={[pStyles.businessName, { color: theme.text }]}>{BUSINESS_NAMES[ft]}</Text>
                  <Text style={[pStyles.businessPct, { color: BUSINESS_COLORS[ft] }]}>{pct}%</Text>
                </View>
              );
            })}
          </View>

          {/* Block 5: Revenue */}
          <SectionHeader label="Виручка" />
          <View style={[pStyles.card, { backgroundColor: theme.surface }]}>
            <InfoRow label="Поточна / хв" value={formatNum(profile.revenuePerMin)} />
            <InfoRow label="Бонус монети" value={`${profile.coinBonusPercent}%`} />
            <InfoRow label="Бонус досвід" value={`${profile.xpBonusPercent}%`} />
            <InfoRow label="Рекорд / хв" value={formatNum(profile.maxRevenuePerMin)} />
          </View>

          {/* Block 6: Status */}
          <SectionHeader label="Статус" />
          <View style={[pStyles.card, { backgroundColor: theme.surface }]}>
            <View style={pStyles.statusRow}>
              <View style={[pStyles.statusDot, { backgroundColor: isOnline ? '#52B847' : '#A6ACB8' }]} />
              <Text style={[pStyles.statusText, { color: theme.text }]}>{formatLastSeen(profile.lastSeenAt)}</Text>
            </View>
            <InfoRow label="Днів в грі" value={String(daysInGame)} />
          </View>

        </ScrollView>
      )}
    </AppBackground>
  );
}

const pStyles = StyleSheet.create({
  scroll: { paddingBottom: 80 },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 8,
  },
  backChevron: {
    fontFamily: 'Fredoka_600SemiBold', fontSize: 24, color: '#2A3344', lineHeight: 26,
  },
  backText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 16, color: '#2A3344' },
  errorText: { fontFamily: 'Fredoka_500Medium', fontSize: 16, color: '#E05A4A' },
  starsRow: { flexDirection: 'row', gap: 4, marginBottom: 10 },
  star: { width: 20, height: 20 },
  card: {
    marginHorizontal: 20, marginTop: 12, backgroundColor: '#fff',
    borderRadius: 24, paddingHorizontal: 15, paddingTop: 20, paddingBottom: 14,
    shadowColor: 'rgba(60,80,45,1)', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 3, borderColor: '#fff', overflow: 'hidden',
  },
  name: { fontFamily: 'Fredoka_600SemiBold', fontSize: 22, color: '#27331F' },
  cityLabel: { fontFamily: 'Fredoka_400Regular', fontSize: 14, color: '#7C8A6E', marginTop: 2 },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  levelValue: { fontFamily: 'Fredoka_700Bold', fontSize: 36, color: '#27331F', lineHeight: 36 },
  xpBar: {
    width: '100%', height: 8, borderRadius: 4, marginTop: 10,
    backgroundColor: 'rgba(60,120,40,0.12)', overflow: 'hidden',
  },
  xpFill: { height: '100%', borderRadius: 4, backgroundColor: '#3FA535' },
  floorRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 12, paddingTop: 12, borderTopWidth: 1,
  },
  floorLabel: { fontFamily: 'Fredoka_500Medium', fontSize: 14, color: '#7C8A6E' },
  floorValue: { fontFamily: 'Fredoka_700Bold', fontSize: 18, color: '#27331F' },
  workerRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 12,
    paddingTop: 12, borderTopWidth: 1,
  },
  workerItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  workerIcon: { width: 36, height: 36 },
  workerLabel: { fontFamily: 'Fredoka_500Medium', fontSize: 12, color: '#7C8A6E' },
  workerValue: { fontFamily: 'Fredoka_700Bold', fontSize: 16, color: '#27331F' },
  actionBtn: {
    marginHorizontal: 20, marginTop: 10, backgroundColor: '#fff', borderRadius: 18,
    paddingVertical: 14, paddingLeft: 15, paddingRight: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    shadowColor: 'rgba(60,80,45,1)', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  actionIcon: { width: 36, height: 36 },
  actionBtnText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 16, color: '#27331F' },
  dropdownCard: {
    marginHorizontal: 20, marginTop: 2, borderRadius: 18, paddingVertical: 8,
    paddingHorizontal: 15,
    shadowColor: 'rgba(60,80,45,1)', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
  },
  achieveRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  achieveName: { fontFamily: 'Fredoka_500Medium', fontSize: 14 },
  achieveLevel: { fontFamily: 'Fredoka_700Bold', fontSize: 14 },
  sectionHeader: {
    marginHorizontal: 24, marginTop: 18, marginBottom: 2,
    fontFamily: 'Fredoka_600SemiBold', fontSize: 13,
    color: '#9098A6', textTransform: 'uppercase', letterSpacing: 0.5,
  },
  businessRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  businessDot: { width: 10, height: 10, borderRadius: 5 },
  businessName: { flex: 1, fontFamily: 'Fredoka_500Medium', fontSize: 14 },
  businessPct: { fontFamily: 'Fredoka_700Bold', fontSize: 14 },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  infoLabel: { fontFamily: 'Fredoka_500Medium', fontSize: 14, color: '#7C8A6E' },
  infoValue: { fontFamily: 'Fredoka_700Bold', fontSize: 14, color: '#27331F' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 14 },
});
