import React, { useEffect, useState, useCallback } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity, Modal, Pressable,
  TextInput, ActivityIndicator, useColorScheme,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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

const PRIMARY    = '#2E6EC9';
const COIN_COLOR = '#F5A623';
const GEM_COLOR  = '#2592AB';
const BANK_ICON      = require('../../assets/img/city/cityBank.png');
const COIN_ICON      = require('../../assets/img/coin.png');
const GEM_ICON       = require('../../assets/img/diamond.png');
const RATING_ICON    = require('../../assets/img/menu/rating.png');
const SANDCLOCK_ICON = require('../../assets/img/sandClock.png');
const CANCEL_ICON    = require('../../assets/img/CancellIcon.png');
const OK_ICON        = require('../../assets/img/OkIcon.png');
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

function sanitizeNum(v: string): string {
  const digits = v.replace(/[^0-9]/g, '');
  return digits === '' ? '' : String(parseInt(digits, 10));
}

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

  const {
    budget, budgetLoading, budgetError, fetchBudget, donate,
    fetchBudgetContribs,
  } = useCityStore();
  const balance  = useBalance();
  const gems     = useGameStore((s) => s.gems);
  const tools    = useGameStore((s) => s.tools);
  const now      = useGameClock(60_000);

  const [coins,          setCoins]          = useState('');
  const [gemAmt,         setGemAmt]         = useState('');
  const [selectedTool,   setSelectedTool]   = useState<ToolKey>('briks');
  const [toolPickerOpen, setToolPickerOpen] = useState(false);
  const [toolAmt,        setToolAmt]        = useState('');
  const [donating, setDonating] = useState(false);
  const [popup,    setPopup]    = useState<{
    message: string;
    ok?: boolean;
    donated?: { coins?: number; gems?: number; tool?: string; toolAmt?: number };
  } | null>(null);

  useEffect(() => {
    if (!cityId) return;
    fetchBudget(cityId);
    fetchBudgetContribs(cityId);
  }, [cityId]);

  const countdown = budget ? getCountdown(new Date(budget.weekResetAt).getTime(), now) : null;

  const coinsNum  = parseInt(coins,   10) || 0;
  const gemNum    = parseInt(gemAmt,  10) || 0;
  const toolNum   = parseInt(toolAmt, 10) || 0;
  const handleDonate = useCallback(async () => {
    if (!cityId) return;
    setDonating(true);
    const payload: DonateBudgetPayload = {
      ...(coinsNum > 0 && { coins: coinsNum }),
      ...(gemNum   > 0 && { gems: gemNum }),
      ...(toolNum  > 0 && { tools: { [selectedTool]: toolNum } }),
    };
    try {
      await donate(cityId, payload);
      setPopup({
        message: t('city.budget.donated'),
        ok: true,
        donated: {
          ...(coinsNum > 0 && { coins: coinsNum }),
          ...(gemNum   > 0 && { gems:  gemNum }),
          ...(toolNum  > 0 && { tool: selectedTool, toolAmt: toolNum }),
        },
      });
      setCoins('');
      setGemAmt('');
      setToolAmt('');
    } catch (e: any) {
      const msg = (e?.message ?? '').toLowerCase();
      let errMsg = t('city.budget.errors.donateFailed');
      if (msg.includes('gem') && msg.includes('limit')) {
        const remaining = budget?.myRemaining ?? 0;
        errMsg = remaining > 0
          ? t('city.budget.gemAvailable', { count: remaining, total: budget?.myWeekLimit ?? 0 })
          : t('city.budget.gemLimitReached');
      } else if (msg.includes('coins'))  errMsg = t('city.budget.errors.notEnoughCoins');
      else if (msg.includes('gems'))     errMsg = t('city.budget.errors.notEnoughGems');
      else if (msg.includes('tools'))    errMsg = t('city.budget.errors.notEnoughTools');
      setPopup({ message: errMsg });
    } finally {
      setDonating(false);
    }
  }, [cityId, coinsNum, gemNum, toolNum, selectedTool, donate, t]);

  return (
    <AppBackground style={[styles.bg, isDark && styles.bgDark]}>
      {budgetLoading && !budget ? (
        <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: insets.top + 80 }} />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Header ── */}
          <View style={[styles.hero, { backgroundColor: isDark ? '#1A2E3E' : '#FFFFFF' }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
              <LocaleText style={[styles.backText, { color: isDark ? '#8AAFD4' : PRIMARY }]}>‹</LocaleText>
            </TouchableOpacity>

            <View style={styles.heroCenter}>
              <Image source={BANK_ICON} style={styles.heroIcon} contentFit="contain" />
              <View style={styles.heroTextWrap}>
                <LocaleText style={[styles.heroTitle, { color: theme.text }]}>
                  {t('city.budget.title')}
                </LocaleText>
                <LocaleText style={[styles.heroSub, { color: theme.textMuted }]}>
                  {t('city.budget.headerDesc')}
                </LocaleText>
              </View>
            </View>

            <View style={{ width: 36 }} />
          </View>

          {budgetError && (
            <View style={[styles.errorBanner, { backgroundColor: theme.surfaceDanger }]}>
              <LocaleText style={[styles.errorBannerText, { color: theme.text }]}>{budgetError}</LocaleText>
            </View>
          )}

          {/* ── Section: Current Budget ── */}
          <View style={[styles.sectionHeaderBlock, { backgroundColor: PRIMARY }]}>
            <LocaleText style={styles.sectionHeader}>
              {t('city.budget.currentBudget')}
            </LocaleText>
          </View>

          <View style={[styles.card, styles.cardNoTopRadius, { backgroundColor: isDark ? '#1A2E3E' : '#FFFFFF' }]}>
            {/* Coins */}
            <View style={[styles.statRow, { backgroundColor: isDark ? '#2A1F00' : '#FFE99A' }]}>
              <View style={[styles.statIconWrap, { backgroundColor: COIN_COLOR + '44' }]}>
                <Image source={COIN_ICON} style={styles.statIcon} contentFit="contain" />
              </View>
              <LocaleText style={[styles.statLabel, { color: isDark ? '#C8A040' : '#7A5000' }]}>
                {t('city.budget.coins')}
              </LocaleText>
              <LocaleText style={[styles.statNum, { color: isDark ? '#FFD060' : '#5A3800' }]}>
                {formatNum(budget?.budgetCoins ?? 0)}
              </LocaleText>
            </View>

            {/* Gems */}
            <View style={[styles.statRow, { backgroundColor: isDark ? '#1E0A30' : '#E8D0FF' }]}>
              <View style={[styles.statIconWrap, { backgroundColor: GEM_COLOR + '44' }]}>
                <Image source={GEM_ICON} style={styles.statIcon} contentFit="contain" />
              </View>
              <LocaleText style={[styles.statLabel, { color: isDark ? '#B080D0' : '#6A2A90' }]}>
                {t('city.budget.gems')}
              </LocaleText>
              <LocaleText style={[styles.statNum, { color: isDark ? '#D090FF' : '#4A1870' }]}>
                {String(budget?.budgetGems ?? 0)}
              </LocaleText>
            </View>

            {/* Tools — 3 per row */}
            <View style={styles.toolsGrid}>
              {TOOL_KEYS.map((k) => {
                const budgetKey = `budget${k.charAt(0).toUpperCase() + k.slice(1)}` as keyof typeof budget;
                const val = budget ? (budget[budgetKey] as number ?? 0) : 0;
                return (
                  <View key={k} style={[styles.toolCard, { backgroundColor: isDark ? '#0D1F2D' : '#EAF1FB' }]}>
                    <Image source={TOOL_ICONS[k]} style={styles.toolCardIcon} contentFit="contain" />
                    <LocaleText style={[styles.toolCardVal, { color: theme.text }]}>{String(val)}</LocaleText>
                  </View>
                );
              })}
            </View>
          </View>

          {/* ── Section: My Donation ── */}
          <View style={[styles.sectionHeaderBlock, { backgroundColor: PRIMARY }]}>
            <LocaleText style={styles.sectionHeader}>
              {t('city.budget.myDonation')}
            </LocaleText>
          </View>

          <View style={[styles.card, styles.cardNoTopRadius, { backgroundColor: isDark ? '#1A2E3E' : '#FFFFFF' }]}>
            {/* Balance row */}
            <View style={styles.balanceRow}>
              <Image source={COIN_ICON} style={styles.balanceIcon} contentFit="contain" />
              <LocaleText style={[styles.balanceVal, { color: COIN_COLOR }]}>{formatNum(balance)}</LocaleText>
              <LocaleText style={[styles.balanceSep, { color: theme.textMuted }]}>·</LocaleText>
              <Image source={GEM_ICON} style={styles.balanceIcon} contentFit="contain" />
              <LocaleText style={[styles.balanceVal, { color: GEM_COLOR }]}>{String(gems)}</LocaleText>
            </View>

            {/* Coins input */}
            <View style={styles.donateRow}>
              <View style={[styles.donateIconWrap, { backgroundColor: COIN_COLOR + '18' }]}>
                <Image source={COIN_ICON} style={styles.donateIcon} contentFit="contain" />
              </View>
              <TextInput
                style={[styles.donateInput, { color: theme.text, backgroundColor: theme.surfaceSub, flex: 1 }]}
                value={coins}
                onChangeText={(v) => setCoins(sanitizeNum(v))}
                placeholder="0"
                placeholderTextColor={theme.textMuted}
                keyboardType="number-pad"
              />
            </View>

            {/* Gems input */}
            <View style={styles.donateRow}>
              <View style={[styles.donateIconWrap, { backgroundColor: GEM_COLOR + '18' }]}>
                <Image source={GEM_ICON} style={styles.donateIcon} contentFit="contain" />
              </View>
              <TextInput
                style={[styles.donateInput, { color: theme.text, backgroundColor: theme.surfaceSub, flex: 1 }]}
                value={gemAmt}
                onChangeText={(v) => setGemAmt(sanitizeNum(v))}
                placeholder="0"
                placeholderTextColor={theme.textMuted}
                keyboardType="number-pad"
              />
            </View>
            {budget && (
              <View style={styles.gemLimitRow}>
                <Image source={GEM_ICON} style={styles.gemLimitIcon} contentFit="contain" />
                {budget.myRemaining <= 0
                  ? <LocaleText style={[styles.gemLimit, { color: '#C03030' }]}>
                      {t('city.budget.gemLimitReached')}
                    </LocaleText>
                  : <LocaleText style={[styles.gemLimit, { color: theme.textMuted }]}>
                      {t('city.budget.gemAvailable', { count: budget.myRemaining, total: budget.myWeekLimit })}
                    </LocaleText>
                }
              </View>
            )}

            <View style={[styles.rowDivider, { backgroundColor: theme.divider }]} />

            {/* Tools — row 1: available counts */}
            <View style={[styles.toolAvailRow, { backgroundColor: isDark ? '#0D1F2D' : '#F6F8FB' }]}>
              {TOOL_KEYS.map((k) => {
                const count = (tools as any)?.[k] ?? 0;
                const isSelected = selectedTool === k;
                return (
                  <TouchableOpacity
                    key={k}
                    style={[styles.toolAvailItem, isSelected && styles.toolAvailItemSelected]}
                    onPress={() => setSelectedTool(k)}
                    activeOpacity={0.7}
                  >
                    <Image source={TOOL_ICONS[k]} style={styles.toolAvailIcon} contentFit="contain" />
                    <LocaleText style={[styles.toolAvailCount, { color: isSelected ? PRIMARY : theme.textMuted }]}>
                      {String(count)}
                    </LocaleText>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Tools — row 2: picker + input */}
            <View style={styles.donateRow}>
              <TouchableOpacity
                style={[
                  styles.toolPickerBtn,
                  { borderColor: toolPickerOpen ? PRIMARY : theme.divider, backgroundColor: theme.surfaceSub },
                ]}
                onPress={() => setToolPickerOpen((v) => !v)}
                activeOpacity={0.7}
              >
                <Image source={TOOL_ICONS[selectedTool]} style={styles.toolPickerIcon} contentFit="contain" />
                <View style={[styles.chevron, { borderColor: theme.textMuted }, toolPickerOpen && styles.chevronUp]} />
              </TouchableOpacity>
              <TextInput
                style={[styles.donateInput, { color: theme.text, backgroundColor: theme.surfaceSub, flex: 1 }]}
                value={toolAmt}
                onChangeText={(v) => setToolAmt(sanitizeNum(v))}
                placeholder="0"
                placeholderTextColor={theme.textMuted}
                keyboardType="number-pad"
              />
            </View>

            {toolPickerOpen && (
              <View style={[styles.toolDropdown, { backgroundColor: theme.surfaceSub, borderColor: theme.divider }]}>
                {([0, 1] as const).map((row) => (
                  <View key={row} style={styles.toolDropdownRow}>
                    {TOOL_KEYS.slice(row * 3, row * 3 + 3).map((k) => (
                      <TouchableOpacity
                        key={k}
                        style={[styles.toolDropdownCell, selectedTool === k && { backgroundColor: PRIMARY + '25' }]}
                        onPress={() => { setSelectedTool(k); setToolPickerOpen(false); }}
                        activeOpacity={0.7}
                      >
                        <Image source={TOOL_ICONS[k]} style={styles.toolDropdownIcon} contentFit="contain" />
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              onPress={handleDonate}
              disabled={donating}
              activeOpacity={0.85}
              style={{ marginTop: 6 }}
            >
              <LinearGradient
                colors={donating ? [theme.divider, theme.divider] : ['#3A80D8', '#1E5BB5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.donateBtn}
              >
                {donating
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <LocaleText style={styles.donateBtnText}>{t('city.budget.donateButton')}</LocaleText>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* ── Top Contributors nav row ── */}
          <TouchableOpacity
            style={[styles.navRow, { backgroundColor: isDark ? '#1A2E3E' : '#FFFFFF' }]}
            onPress={() => router.push({ pathname: '/city/budget-contribs', params: { id: cityId } })}
            activeOpacity={0.75}
          >
            <View style={[styles.navIconWrap, { backgroundColor: PRIMARY + '18' }]}>
              <Image source={RATING_ICON} style={styles.navIcon} contentFit="contain" />
            </View>
            <LocaleText style={[styles.navLabel, { color: theme.text }]}>
              {t('city.budget.contribs')}
            </LocaleText>
            <View style={[styles.navChevron, { borderColor: theme.textMuted }]} />
          </TouchableOpacity>

          {/* ── Weekly reset timer ── */}
          {countdown && (
            <View style={styles.timerRow}>
              <Image source={SANDCLOCK_ICON} style={styles.timerIcon} contentFit="contain" />
              <LocaleText style={[styles.timerText, { color: theme.textMuted }]}>
                {t('city.budget.gemResetIn')} {countdown.days}{t('city.budget.days')} {countdown.hours}{t('city.budget.hours')} {countdown.mins}{t('city.budget.minutes')}
              </LocaleText>
            </View>
          )}

          <View style={{ height: 80 }} />
        </ScrollView>
      )}

      {/* ── Popup ── */}
      <Modal visible={!!popup} transparent animationType="fade" onRequestClose={() => setPopup(null)}>
        <Pressable style={styles.popupOverlay} onPress={() => setPopup(null)}>
          <Pressable style={[styles.popupCard, { backgroundColor: isDark ? '#1A2E3E' : '#FFFFFF' }]}>
            <Image
              source={popup?.ok ? OK_ICON : CANCEL_ICON}
              style={styles.popupIcon}
              contentFit="contain"
            />
            <LocaleText style={[styles.popupText, { color: theme.text }]}>
              {popup?.message}
            </LocaleText>

            {popup?.ok && popup.donated && (
              <View style={[styles.popupDonated, { backgroundColor: isDark ? '#0D1F2D' : '#F4F8FF' }]}>
                {popup.donated.coins != null && (
                  <View style={styles.popupDonatedRow}>
                    <Image source={COIN_ICON} style={styles.popupDonatedIcon} contentFit="contain" />
                    <LocaleText style={[styles.popupDonatedVal, { color: COIN_COLOR }]}>
                      {formatNum(popup.donated.coins)}
                    </LocaleText>
                  </View>
                )}
                {popup.donated.gems != null && (
                  <View style={styles.popupDonatedRow}>
                    <Image source={GEM_ICON} style={styles.popupDonatedIcon} contentFit="contain" />
                    <LocaleText style={[styles.popupDonatedVal, { color: GEM_COLOR }]}>
                      {String(popup.donated.gems)}
                    </LocaleText>
                  </View>
                )}
                {popup.donated.tool != null && popup.donated.toolAmt != null && (
                  <View style={styles.popupDonatedRow}>
                    <Image source={TOOL_ICONS[popup.donated.tool]} style={styles.popupDonatedIcon} contentFit="contain" />
                    <LocaleText style={[styles.popupDonatedVal, { color: theme.text }]}>
                      {String(popup.donated.toolAmt)}
                    </LocaleText>
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity
              style={[styles.popupBtn, { backgroundColor: PRIMARY }]}
              onPress={() => setPopup(null)}
              activeOpacity={0.8}
            >
              <LocaleText style={styles.popupBtnText}>OK</LocaleText>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  bg:     { flex: 1, backgroundColor: '#EEF4FB' },
  bgDark: { backgroundColor: '#0D1520' },

  scroll: { paddingHorizontal: 0 },

  /* Header */
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 10,
    marginHorizontal: 14,
  },
  backBtn:  { width: 36 },
  backText: { fontSize: 28, lineHeight: 32, fontFamily: 'Fredoka_600SemiBold' },
  heroCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  heroIcon:     { width: 36, height: 36 },
  heroTextWrap: { gap: 1 },
  heroTitle:    { fontFamily: 'Fredoka_700Bold', fontSize: 20 },
  heroSub:      { fontFamily: 'Fredoka_400Regular', fontSize: 12 },

  /* Section headers */
  sectionHeaderBlock: {
    marginHorizontal: 14,
    marginTop: 14,
    marginBottom: 0,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  sectionHeader: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 17,
    color: '#FFFFFF',
  },

  /* Cards */
  card: {
    borderRadius: 14,
    padding: 12,
    gap: 8,
    marginHorizontal: 14,
  },
  cardNoTopRadius: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },

  /* Stat rows (current budget) */
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  statIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIcon:  { width: 24, height: 24 },
  statLabel: { flex: 1, fontFamily: 'Fredoka_600SemiBold', fontSize: 14 },
  statNum:   { fontFamily: 'Fredoka_700Bold', fontSize: 18 },

  toolsCardLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toolCard: {
    width: '30%',
    flexGrow: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 4,
  },
  toolCardIcon: { width: 28, height: 28 },
  toolCardVal:  { fontFamily: 'Fredoka_700Bold', fontSize: 15 },

  /* Donation card */
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  balanceIcon: { width: 15, height: 15 },
  balanceVal:  { fontFamily: 'Fredoka_600SemiBold', fontSize: 13 },
  balanceSep:  { fontFamily: 'Fredoka_400Regular', fontSize: 13, marginHorizontal: 2 },

  donateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  donateIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donateIcon: { width: 26, height: 26 },
  donateInput: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 18,
  },
  gemLimitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    marginLeft: 54,
  },
  gemLimitIcon: { width: 12, height: 12 },
  gemLimit: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 11,
  },

  rowDivider: { height: 1, marginVertical: 2 },

  /* Tools section */
  toolsSection: { gap: 8 },
  toolsTopRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },

  toolPickerBtn: {
    width: 50,
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  toolPickerIcon: { width: 26, height: 26 },
  chevron: {
    width: 7,
    height: 7,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    transform: [{ rotate: '45deg' }],
    marginBottom: 3,
  },
  chevronUp: {
    transform: [{ rotate: '-135deg' }],
    marginBottom: -3,
  },

  toolAvailRow: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 4,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  toolAvailItem: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: 5,
    paddingHorizontal: 5,
    borderRadius: 8,
    flex: 1,
  },
  toolAvailItemSelected: {
    backgroundColor: PRIMARY + '25',
    paddingHorizontal: 8,
  },
  toolAvailIcon:  { width: 20, height: 20 },
  toolAvailCount: { fontFamily: 'Fredoka_600SemiBold', fontSize: 11 },

  toolDropdown: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 6,
    gap: 4,
  },
  toolDropdownRow:  { flexDirection: 'row', justifyContent: 'space-around' },
  toolDropdownCell: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  toolDropdownIcon: { width: 28, height: 28 },

  errorBanner: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    marginHorizontal: 14,
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
    marginBottom: 6,
    textAlign: 'center',
  },

  donateBtn:     { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  donateBtnText: { fontFamily: 'Fredoka_700Bold', fontSize: 16, color: '#FFFFFF' },

  /* Top Contributors nav row */
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginTop: 12,
    marginHorizontal: 14,
  },
  navIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIcon:  { width: 22, height: 22 },
  navLabel: { flex: 1, fontFamily: 'Fredoka_600SemiBold', fontSize: 16 },
  navChevron: {
    width: 9,
    height: 9,
    borderRightWidth: 2,
    borderTopWidth: 2,
    transform: [{ rotate: '45deg' }],
  },

  /* Popup */
  popupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupCard: {
    width: 280,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  popupMessage: { fontFamily: 'Fredoka_700Bold', fontSize: 36 },
  popupIcon:    { width: 56, height: 56 },
  popupDonated: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    gap: 6,
    alignItems: 'center',
    width: '100%',
  },
  popupDonatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  popupDonatedIcon: { width: 20, height: 20 },
  popupDonatedVal:  { fontFamily: 'Fredoka_700Bold', fontSize: 18 },
  popupText:    { fontFamily: 'Fredoka_500Medium', fontSize: 15, textAlign: 'center', lineHeight: 21 },
  popupBtn: {
    marginTop: 6,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 40,
  },
  popupBtnText: { fontFamily: 'Fredoka_700Bold', fontSize: 15, color: '#FFFFFF' },

  /* Reset timer */
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  timerIcon: { width: 14, height: 14, opacity: 0.5 },
  timerText: { fontFamily: 'Fredoka_400Regular', fontSize: 12 },
});
