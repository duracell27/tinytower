import React, { useEffect, useState, useCallback } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, useColorScheme,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import LocaleText from '../../src/components/LocaleText';
import AppBackground from '../../src/components/AppBackground';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { useCityStore } from '../../src/stores/cityStore';
import { useGameStore, useBalance } from '../../src/stores/gameStore';
import { useGameClock } from '../../src/hooks/useGameClock';
import { formatNum } from '../../src/utils/format';
import type { DonateBudgetPayload } from '../../src/services/api';

const PRIMARY   = '#2E6EC9';
const BANK_ICON = require('../../assets/img/city/cityBank.png');
const COIN_ICON = require('../../assets/img/coin.png');
const GEM_ICON  = require('../../assets/img/diamond.png');
const TOOL_ICONS: Record<string, any> = {
  briks:  require('../../assets/img/tools/briks.png'),
  glass:  require('../../assets/img/tools/glass.png'),
  nails:  require('../../assets/img/tools/nails.png'),
  screw:  require('../../assets/img/tools/screw.png'),
  wood:   require('../../assets/img/tools/wood.png'),
  cement: require('../../assets/img/tools/cement.png'),
};

const TOOL_KEYS = ['briks', 'glass', 'nails', 'screw', 'wood', 'cement'] as const;
type ToolKey    = typeof TOOL_KEYS[number];

function getCountdown(targetMs: number, nowMs: number) {
  const diff      = Math.max(0, targetMs - nowMs);
  const totalSecs = Math.floor(diff / 1000);
  const days      = Math.floor(totalSecs / 86400);
  const hours     = Math.floor((totalSecs % 86400) / 3600);
  const mins      = Math.floor((totalSecs % 3600) / 60);
  return { days, hours, mins };
}

export default function CityBudgetScreen() {
  const { id: cityId } = useLocalSearchParams<{ id: string }>();
  const { t }    = useTranslation('tabs');
  const theme    = useAppTheme();
  const isDark   = useColorScheme() === 'dark';
  const router   = useRouter();
  const insets   = useSafeAreaInsets();

  const { budget, budgetLoading, budgetError, fetchBudget, donate } = useCityStore();
  const balance  = useBalance();
  const gems     = useGameStore((s) => s.gems);
  const tools    = useGameStore((s) => s.tools);
  const now      = useGameClock(60_000);

  const [coins,       setCoins]       = useState('');
  const [gemAmt,      setGemAmt]      = useState('');
  const [selectedTool, setSelectedTool] = useState<ToolKey>('briks');
  const [toolAmt,     setToolAmt]     = useState('');
  const [donating,    setDonating]    = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  useEffect(() => { if (cityId) fetchBudget(cityId); }, [cityId]);

  const countdown = budget ? getCountdown(new Date(budget.weekResetAt).getTime(), now) : null;

  const coinsNum = parseInt(coins,   10) || 0;
  const gemNum   = parseInt(gemAmt,  10) || 0;
  const toolNum  = parseInt(toolAmt, 10) || 0;
  const hasAmount = coinsNum > 0 || gemNum > 0 || toolNum > 0;

  const handleDonate = useCallback(async () => {
    if (!cityId || !hasAmount) return;
    setError(null);
    setDonating(true);
    const payload: DonateBudgetPayload = {
      ...(coinsNum > 0 && { coins: coinsNum }),
      ...(gemNum   > 0 && { gems: gemNum }),
      ...(toolNum  > 0 && { tools: { [selectedTool]: toolNum } }),
    };
    try {
      await donate(cityId, payload);
      setCoins('');
      setGemAmt('');
      setToolAmt('');
    } catch (e: any) {
      const msg = (e?.message ?? '').toLowerCase();
      if (msg.includes('gem') && msg.includes('limit'))
        setError(t('city.budget.errors.gemLimitExceeded'));
      else if (msg.includes('coins'))
        setError(t('city.budget.errors.notEnoughCoins'));
      else if (msg.includes('gems'))
        setError(t('city.budget.errors.notEnoughGems'));
      else if (msg.includes('tools'))
        setError(t('city.budget.errors.notEnoughTools'));
      else
        setError(t('city.budget.errors.donateFailed'));
    } finally {
      setDonating(false);
    }
  }, [cityId, coinsNum, gemNum, toolNum, selectedTool, hasAmount, donate, t]);

  const cardBg = isDark ? '#1A2E3E' : '#FFFFFF';

  return (
    <AppBackground style={[styles.bg, isDark && styles.bgDark]}>
      {budgetLoading && !budget ? (
        <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: insets.top + 80 }} />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Floating header (no white bar) ── */}
          <View style={styles.floatingHeader}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
              <LocaleText style={[styles.backText, { color: PRIMARY }]}>‹</LocaleText>
            </TouchableOpacity>
            <View style={styles.titleRow}>
              <Image source={BANK_ICON} style={styles.titleIcon} contentFit="contain" />
              <LocaleText style={[styles.titleText, { color: theme.text }]}>
                {t('city.budget.title')}
              </LocaleText>
            </View>
            <View style={{ width: 36 }} />
          </View>

          {budgetError && (
            <View style={[styles.errorBanner, { backgroundColor: theme.surfaceDanger }]}>
              <LocaleText style={[styles.errorBannerText, { color: theme.text }]}>{budgetError}</LocaleText>
            </View>
          )}

          {/* ── Current Budget ── */}
          <LocaleText style={[styles.sectionLabel, { color: theme.text }]}>
            {t('city.budget.currentBudget')}
          </LocaleText>

          <View style={[styles.card, { backgroundColor: cardBg }]}>
            <View style={styles.budgetRow}>
              <Image source={COIN_ICON} style={styles.budgetIcon} contentFit="contain" />
              <LocaleText style={[styles.budgetNum, { color: theme.text }]}>
                {formatNum(budget?.budgetCoins ?? 0)}
              </LocaleText>
              <LocaleText style={[styles.budgetUnit, { color: theme.textMuted }]}>
                {t('city.budget.coins')}
              </LocaleText>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: cardBg }]}>
            <View style={styles.budgetRow}>
              <Image source={GEM_ICON} style={styles.budgetIcon} contentFit="contain" />
              <LocaleText style={[styles.budgetNum, { color: theme.text }]}>
                {String(budget?.budgetGems ?? 0)}
              </LocaleText>
              <LocaleText style={[styles.budgetUnit, { color: theme.textMuted }]}>
                {t('city.budget.gems')}
              </LocaleText>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: cardBg }]}>
            <LocaleText style={[styles.cardLabel, { color: theme.textMuted }]}>
              {t('city.budget.tools')}
            </LocaleText>
            {([0, 1] as const).map((row) => (
              <View key={row}>
                {row === 1 && <View style={[styles.toolRowDivider, { backgroundColor: theme.divider }]} />}
                <View style={styles.toolsRow}>
                  {TOOL_KEYS.slice(row * 3, row * 3 + 3).map((k, col) => {
                    const budgetKey = `budget${k.charAt(0).toUpperCase() + k.slice(1)}` as keyof typeof budget;
                    const val = budget ? (budget[budgetKey] as number ?? 0) : 0;
                    return (
                      <React.Fragment key={k}>
                        {col > 0 && <View style={[styles.toolColDivider, { backgroundColor: theme.divider }]} />}
                        <View style={styles.toolCell}>
                          <Image source={TOOL_ICONS[k]} style={styles.toolIcon} contentFit="contain" />
                          <LocaleText style={[styles.toolVal, { color: theme.text }]}>{String(val)}</LocaleText>
                        </View>
                      </React.Fragment>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>

          {/* ── My Donation ── */}
          <LocaleText style={[styles.sectionLabel, { color: theme.text }]}>
            {t('city.budget.myDonation')}
          </LocaleText>

          <View style={[styles.card, { backgroundColor: cardBg }]}>
            {/* Coins input */}
            <View style={styles.inputRow}>
              <Image source={COIN_ICON} style={styles.inputIcon} contentFit="contain" />
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.divider, backgroundColor: theme.surfaceSub }]}
                value={coins}
                onChangeText={setCoins}
                placeholder="0"
                placeholderTextColor={theme.textMuted}
                keyboardType="numeric"
              />
              <LocaleText style={[styles.inputHint, { color: theme.textMuted }]}>
                {formatNum(balance)}
              </LocaleText>
            </View>

            {/* Gems input */}
            <View style={styles.inputRow}>
              <Image source={GEM_ICON} style={styles.inputIcon} contentFit="contain" />
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.divider, backgroundColor: theme.surfaceSub }]}
                value={gemAmt}
                onChangeText={setGemAmt}
                placeholder="0"
                placeholderTextColor={theme.textMuted}
                keyboardType="numeric"
              />
              <LocaleText style={[styles.inputHint, { color: theme.textMuted }]}>
                {String(budget?.myRemaining ?? 100)}
              </LocaleText>
            </View>

            <View style={[styles.toolRowDivider, { backgroundColor: theme.divider, marginVertical: 10 }]} />

            {/* Tool picker */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.toolPickerRow}
            >
              {TOOL_KEYS.map((k) => {
                const active = selectedTool === k;
                return (
                  <TouchableOpacity
                    key={k}
                    style={[
                      styles.toolChip,
                      { borderColor: active ? PRIMARY : theme.divider },
                      active && { backgroundColor: PRIMARY + '18' },
                    ]}
                    onPress={() => setSelectedTool(k)}
                    activeOpacity={0.7}
                  >
                    <Image source={TOOL_ICONS[k]} style={styles.chipIcon} contentFit="contain" />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Tool input */}
            <View style={[styles.inputRow, { marginTop: 8 }]}>
              <Image source={TOOL_ICONS[selectedTool]} style={styles.inputIcon} contentFit="contain" />
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.divider, backgroundColor: theme.surfaceSub }]}
                value={toolAmt}
                onChangeText={setToolAmt}
                placeholder="0"
                placeholderTextColor={theme.textMuted}
                keyboardType="numeric"
              />
              <LocaleText style={[styles.inputHint, { color: theme.textMuted }]}>
                {String((tools as any)?.[selectedTool] ?? 0)}
              </LocaleText>
            </View>

            {error ? (
              <LocaleText style={styles.errorText}>{error}</LocaleText>
            ) : null}

            <TouchableOpacity
              style={[
                styles.donateBtn,
                { backgroundColor: hasAmount && !donating ? PRIMARY : theme.divider },
              ]}
              onPress={handleDonate}
              disabled={!hasAmount || donating}
              activeOpacity={0.8}
            >
              {donating
                ? <ActivityIndicator color="#FFFFFF" />
                : <LocaleText style={styles.donateBtnText}>{t('city.budget.donateButton')}</LocaleText>
              }
            </TouchableOpacity>
          </View>

          {/* ── Weekly Timer (small, centered) ── */}
          {countdown && (
            <LocaleText style={[styles.timerText, { color: theme.textMuted }]}>
              {t('city.budget.resetIn')}: {countdown.days}{t('city.budget.days')} {countdown.hours}{t('city.budget.hours')} {countdown.mins}{t('city.budget.minutes')}
            </LocaleText>
          )}

          <View style={{ height: 80 }} />
        </ScrollView>
      )}
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  bg:     { flex: 1, backgroundColor: '#F0F8FF' },
  bgDark: { backgroundColor: '#0D1F2D' },

  scroll: { paddingHorizontal: 16 },

  floatingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backBtn:   { width: 36, alignItems: 'center' },
  backText:  { fontSize: 28, lineHeight: 32, fontFamily: 'Fredoka_600SemiBold' },
  titleRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleIcon: { width: 30, height: 30 },
  titleText: { fontFamily: 'Fredoka_700Bold', fontSize: 26 },

  sectionLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 8,
    marginTop: 4,
  },

  card:      { borderRadius: 16, padding: 16, marginBottom: 10 },
  cardLabel: { fontFamily: 'Fredoka_500Medium', fontSize: 13, marginBottom: 10, textAlign: 'center' },

  budgetRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  budgetIcon: { width: 30, height: 30 },
  budgetNum:  { fontFamily: 'Fredoka_700Bold', fontSize: 22, flex: 1 },
  budgetUnit: { fontFamily: 'Fredoka_400Regular', fontSize: 14 },

  toolsRow:       { flexDirection: 'row' },
  toolRowDivider: { height: 1, marginVertical: 2 },
  toolColDivider: { width: 1, marginHorizontal: 2 },
  toolCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  toolIcon: { width: 28, height: 28 },
  toolVal:  { fontFamily: 'Fredoka_600SemiBold', fontSize: 14 },

  inputRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  inputIcon:  { width: 28, height: 28 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: 'Fredoka_500Medium',
    fontSize: 18,
  },
  inputHint: { fontFamily: 'Fredoka_400Regular', fontSize: 12, minWidth: 44, textAlign: 'right' },

  toolPickerRow: { gap: 8, paddingBottom: 4 },
  toolChip: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipIcon: { width: 26, height: 26 },

  errorBanner: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  errorBannerText: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 13,
    textAlign: 'center',
  },
  errorText: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 13,
    color: '#C03030',
    marginBottom: 10,
    textAlign: 'center',
  },

  donateBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  donateBtnText: { fontFamily: 'Fredoka_700Bold', fontSize: 16, color: '#FFFFFF' },

  timerText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 6,
  },
});
