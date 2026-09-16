import React, { useEffect, useState } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, useColorScheme,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import LocaleText from '../../src/components/LocaleText';
import AppBackground from '../../src/components/AppBackground';
import { useCityStore } from '../../src/stores/cityStore';
import { useAuthStore } from '../../src/stores/authStore';
import { useGameStore } from '../../src/stores/gameStore';
import type { CityXpStats, CityXpStatMember } from '../../src/services/api';

const XP_ICON = require('../../assets/img/xpIcon.png');

function formatPeriodStart(dateStr: string, locale: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(locale === 'uk' ? 'uk-UA' : 'en-US', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function CityXpStatsScreen() {
  const { t, i18n } = useTranslation('tabs');
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const player = useAuthStore((s) => s.player);
  const { getCityXpStats, resetCityXpPeriod } = useCityStore();
  const showCityConfirm = useGameStore((s) => s.showCityConfirm);
  const showCityAlert = useGameStore((s) => s.showCityAlert);

  const [stats, setStats] = useState<CityXpStats | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [data, cityDetail] = await Promise.all([
        getCityXpStats(id),
        useCityStore.getState().getCityById(id),
      ]);
      setStats(data);
      setMyRole(cityDetail.myRole);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleReset = () => {
    showCityConfirm({
      title: t('city.xpStats.resetTitle'),
      message: t('city.xpStats.resetConfirm'),
      confirmText: t('city.xpStats.resetBtn'),
      danger: true,
      onConfirm: async () => {
        setResetting(true);
        try {
          await resetCityXpPeriod(id!);
          await load();
        } catch {
          showCityAlert({ message: t('city.xpStats.resetError') });
        } finally {
          setResetting(false);
        }
      },
    });
  };

  const isMayor = myRole === 'MAYOR';

  if (loading) {
    return (
      <AppBackground style={[styles.bg, isDark && styles.bgDark]}>
        <View style={styles.center}>
          <ActivityIndicator color={isDark ? '#6BAED0' : '#2E6EC9'} />
        </View>
      </AppBackground>
    );
  }

  if (!stats) {
    return (
      <AppBackground style={[styles.bg, isDark && styles.bgDark]}>
        <View style={styles.center}>
          <LocaleText style={styles.errorText}>{t('city.errors.load')}</LocaleText>
        </View>
      </AppBackground>
    );
  }

  return (
    <AppBackground style={[styles.bg, isDark && styles.bgDark]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top - 8 }]} showsVerticalScrollIndicator={false}>

        {/* ── HEADER ── */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <LocaleText style={[styles.backIcon, isDark && { color: '#6BAED0' }]}>‹</LocaleText>
          </TouchableOpacity>
          <LocaleText style={[styles.title, isDark && { color: '#DDE8D8' }]}>
            {t('city.xpStats.title')}
          </LocaleText>
          <View style={{ width: 40 }} />
        </View>

        {/* ── TOTAL XP CARD ── */}
        <View style={[styles.totalCard, isDark && styles.totalCardDark]}>
          <LocaleText style={[styles.totalLabel, isDark && { color: '#8A9A80' }]}>
            {t('city.xpStats.totalLabel')}
          </LocaleText>
          <LocaleText style={[styles.totalXp, isDark && { color: '#6BAED0' }]}>
            {stats.totalXpPeriod.toLocaleString()} XP
          </LocaleText>
        </View>

        {/* ── MEMBERS LIST ── */}
        <View style={styles.listBlock}>
          {stats.members.map((member, idx) => (
            <MemberRow
              key={member.playerId}
              member={member}
              rank={idx + 1}
              isMe={member.playerId === player?.id}
              isDark={isDark}
              t={t}
            />
          ))}

          {stats.members.length === 0 && (
            <View style={styles.emptyBox}>
              <LocaleText style={[styles.emptyText, isDark && { color: '#5A7090' }]}>
                {t('city.xpStats.empty')}
              </LocaleText>
            </View>
          )}
        </View>

        {/* ── FOOTER: period start + reset ── */}
        <View style={[styles.footer, isDark && styles.footerDark]}>
          <LocaleText style={[styles.periodLabel, isDark && { color: '#6A8A70' }]}>
            {t('city.xpStats.since', {
              date: formatPeriodStart(stats.periodStart, i18n.language),
            })}
          </LocaleText>

          {isMayor && (
            <TouchableOpacity
              style={[styles.resetBtn, resetting && styles.resetBtnOff]}
              onPress={handleReset}
              disabled={resetting}
              activeOpacity={0.7}
            >
              <LocaleText style={styles.resetBtnText}>
                {resetting ? t('city.xpStats.resetting') : t('city.xpStats.resetBtn')}
              </LocaleText>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 48 }} />
      </ScrollView>
    </AppBackground>
  );
}

function MemberRow({
  member, rank, isMe, isDark, t,
}: {
  member: CityXpStatMember;
  rank: number;
  isMe: boolean;
  isDark: boolean;
  t: any;
}) {
  const rankColor = rank === 1 ? '#F0A000' : rank === 2 ? '#8888A0' : rank === 3 ? '#C07040' : undefined;

  return (
    <View style={[styles.memberRow, isDark && styles.memberRowDark]}>
      <LocaleText style={[styles.rank, isDark && { color: '#5A7090' }, rankColor ? { color: rankColor } : null]}>
        {rank}
      </LocaleText>

      <View style={styles.memberInfo}>
        <View style={styles.nameRow}>
          <LocaleText style={[styles.memberName, isDark && { color: '#DDE8D8' }]}>
            {member.playerName}
          </LocaleText>
          <LocaleText style={[styles.memberMeta, isDark && { color: '#8A9A80' }]}>
            · {t('city.detail.level', { level: member.playerLevel })} · {t(`city.roles.${member.role}`)}
          </LocaleText>
        </View>

        {/* percent bar */}
        <View style={[styles.barBg, isDark && styles.barBgDark]}>
          <View style={[styles.barFill, { width: `${member.percent}%` as any }]} />
        </View>
      </View>

      <View style={styles.xpCol}>
        <View style={styles.xpRow}>
          <LocaleText style={[styles.xpValue, isDark && { color: '#6BAED0' }]}>
            {member.xpPeriod.toLocaleString()}
          </LocaleText>
          <Image source={XP_ICON} style={styles.xpIcon} contentFit="contain" />
        </View>
        <LocaleText style={[styles.xpPercent, isDark && { color: '#5A7090' }]}>
          {member.percent}%
        </LocaleText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#F0F8FF' },
  bgDark: { backgroundColor: '#0D1F2D' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontFamily: 'Fredoka_500Medium', fontSize: 15, color: '#7A8A80' },
  scroll: { paddingTop: 8, paddingBottom: 8 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    marginBottom: 4,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontFamily: 'Fredoka_700Bold', fontSize: 30, color: '#2E6EC9', lineHeight: 34 },
  title: { fontFamily: 'Fredoka_700Bold', fontSize: 20, color: '#0A1C30', flex: 1, textAlign: 'center' },

  totalCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    gap: 4,
  },
  totalCardDark: { backgroundColor: '#1A2E3E' },
  totalLabel: { fontFamily: 'Fredoka_400Regular', fontSize: 13, color: '#5A7090' },
  totalXp: { fontFamily: 'Fredoka_700Bold', fontSize: 28, color: '#2E6EC9' },

  listBlock: { marginHorizontal: 16, gap: 8, marginBottom: 16 },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  memberRowDark: { backgroundColor: '#1A2E3E' },
  rank: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 16,
    color: '#8A9A80',
    minWidth: 24,
    textAlign: 'center',
  },
  memberInfo: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 2 },
  memberName: { fontFamily: 'Fredoka_600SemiBold', fontSize: 15, color: '#0A1C30' },
  memberMeta: { fontFamily: 'Fredoka_400Regular', fontSize: 13, color: '#8A9A80' },
  barBg: { height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.08)', overflow: 'hidden' },
  barBgDark: { backgroundColor: 'rgba(255,255,255,0.08)' },
  barFill: { height: '100%', backgroundColor: '#2E6EC9', borderRadius: 3 },

  xpCol: { alignItems: 'flex-end', gap: 2 },
  xpRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  xpValue: { fontFamily: 'Fredoka_600SemiBold', fontSize: 14, color: '#2E6EC9' },
  xpIcon: { width: 16, height: 16 },
  xpPercent: { fontFamily: 'Fredoka_400Regular', fontSize: 12, color: '#5A7090' },

  footer: {
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 14,
  },
  footerDark: { backgroundColor: '#1A2E3E' },
  periodLabel: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
    color: '#5A8060',
    textAlign: 'center',
  },

  resetBtn: {
    backgroundColor: '#FCE8E8',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  resetBtnOff: { opacity: 0.5 },
  resetBtnText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 14, color: '#C03030' },

  emptyBox: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontFamily: 'Fredoka_400Regular', fontSize: 14, color: '#8A9A80' },
});
