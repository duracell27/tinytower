import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Modal, KeyboardAvoidingView, TextInput, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import Svg, { Polyline, Path } from 'react-native-svg';
import AppBackground from '../../src/components/AppBackground';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { api, type PlayerProfile } from '../../src/services/api';
import { getUserIcon } from '../../src/utils/userIcon';
import { ACHIEVEMENT_CATEGORIES } from '../../shared/config/achievementCategories';
import { formatNum } from '../../src/utils/format';
import { useAuthStore } from '../../src/stores/authStore';
import { useFriendStore } from '../../src/stores/friendStore';
import { useMailStore } from '../../src/stores/mailStore';

const STAR_FULL      = require('../../assets/img/starFull.png');
const STAR_66        = require('../../assets/img/star66.png');
const STAR_33        = require('../../assets/img/star33.png');
const STAR_EMPTY     = require('../../assets/img/starEmpty.png');
const LVL_ICON       = require('../../assets/img/lvlIcon.png');
const FLOOR_ICON     = require('../../assets/img/floorIcon.png');
const ACHIV_ICON     = require('../../assets/img/profile/achivProfileIcon.png');
const MAIL_ICON      = require('../../assets/img/mail.png');
const FRIEND_ICON       = require('../../assets/img/addfriend.png');
const REMOVE_FRIEND_ICON = require('../../assets/img/removefriend.png');
const COIN_ICON      = require('../../assets/img/coin.png');
const BEST_RPM_ICON  = require('../../assets/img/bestRPM.png');
const SAND_CLOCK     = require('../../assets/img/sandClock.png');
const HAPPY_ICON     = require('../../assets/img/happySmile.png');
const SPEC_ICON      = require('../../assets/img/specialistWorker.png');
const MARKETING_ICON = require('../../assets/img/MarketingIcon.png');
const PR_ICON        = require('../../assets/img/PRIcon.png');

const TIER_ICONS: Record<number, any> = {
  0: require('../../assets/img/achivment/0TierAchive.png'),
  1: require('../../assets/img/achivment/1TierAchive.png'),
  2: require('../../assets/img/achivment/2TierAchive.png'),
  3: require('../../assets/img/achivment/3TierAchive.png'),
  4: require('../../assets/img/achivment/4TierAchive.png'),
  5: require('../../assets/img/achivment/5TierAchive.png'),
  6: require('../../assets/img/achivment/6TierAchive.png'),
  7: require('../../assets/img/achivment/7TierAchive.png'),
};

const CAT_ICONS: Record<string, any> = {
  buy:      require('../../assets/img/achivment/achivBuyCategory.png'),
  list:     require('../../assets/img/achivment/achivDeliverCategory.png'),
  collect:  require('../../assets/img/achivment/achivCollectcoinsCategory.png'),
  elevator: require('../../assets/img/achivment/achivLiftCategory.png'),
};

const BIZ_ICONS: Record<string, any> = {
  green:  require('../../assets/img/flourTypes/products.png'),
  blue:   require('../../assets/img/flourTypes/service.png'),
  yellow: require('../../assets/img/flourTypes/rest.png'),
  purple: require('../../assets/img/flourTypes/fashion.png'),
  red:    require('../../assets/img/flourTypes/electronics.png'),
};

const BUSINESS_LABELS: Record<string, string> = {
  green: 'Products', blue: 'Service', yellow: 'Rest', purple: 'Fashion', red: 'Electronics',
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
  const theme = useAppTheme();
  return <Text style={[pStyles.sectionHeader, { color: theme.text }]}>{label}</Text>;
}

function InfoRow({ icons, label, value, noBorder }: { icons?: any[]; label: string; value: string; noBorder?: boolean }) {
  const theme = useAppTheme();
  return (
    <View style={[pStyles.infoRow, { borderBottomColor: theme.divider }, noBorder && { borderBottomWidth: 0 }]}>
      <View style={pStyles.infoLeft}>
        {icons?.map((src, i) => (
          <Image key={i} source={src} style={pStyles.infoIcon} contentFit="contain" />
        ))}
        <Text style={[pStyles.infoLabel, { color: theme.textMuted }]}>{label}</Text>
      </View>
      <Text style={[pStyles.infoValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

function formatLastSeen(lastSeenAt: string): string {
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  if (diff < 5 * 60 * 1000) return 'Online';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `Last seen ${mins}m ago`;
  const hrs = Math.floor(diff / 3_600_000);
  if (hrs < 24) return `Last seen ${hrs}h ago`;
  return `Last seen ${Math.floor(diff / 86_400_000)}d ago`;
}

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [achievementsOpen, setAchievementsOpen] = useState(false);

  const currentPlayerId = useAuthStore(s => s.player?.id);
  const statusCache = useFriendStore(s => s.statusCache);
  const fetchStatus = useFriendStore(s => s.fetchStatus);
  const sendRequest = useFriendStore(s => s.sendRequest);
  const cancelRequest = useFriendStore(s => s.cancelRequest);
  const acceptRequest = useFriendStore(s => s.acceptRequest);
  const rejectRequest = useFriendStore(s => s.rejectRequest);
  const removeFriend = useFriendStore(s => s.removeFriend);

  const friendStatus = id ? statusCache[id] : undefined;
  const [friendActionLoading, setFriendActionLoading] = useState(false);

  const sendMail = useMailStore(s => s.sendMail);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [sendLoading, setSendLoading] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState(false);

  const closeCompose = () => {
    setComposeOpen(false);
    setComposeSubject('');
    setComposeBody('');
    setSendError('');
    setSendSuccess(false);
  };

  const handleSend = async () => {
    if (!composeSubject.trim() || !composeBody.trim()) {
      setSendError('Please fill in subject and message');
      return;
    }
    setSendLoading(true);
    setSendError('');
    try {
      await sendMail(id, composeSubject.trim(), composeBody.trim());
      setSendSuccess(true);
      setTimeout(() => {
        setComposeOpen(false);
        setSendSuccess(false);
        setComposeSubject('');
        setComposeBody('');
      }, 1200);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSendLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getPlayerProfile(id)
      .then((p) => { if (!cancelled) setProfile(p); })
      .catch(() => { if (!cancelled) setError('Failed to load profile'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    if (id && currentPlayerId && id !== currentPlayerId) {
      fetchStatus(id);
    }
    return () => { cancelled = true; };
  }, [id, currentPlayerId, fetchStatus]);

  const isOnline = profile
    ? Date.now() - new Date(profile.lastSeenAt).getTime() < 5 * 60 * 1000
    : false;

  const daysInGame = profile
    ? Math.floor((Date.now() - new Date(profile.createdAt).getTime()) / 86_400_000)
    : 0;

  const totalAchievementLevels = profile
    ? ACHIEVEMENT_CATEGORIES.reduce(
        (sum, cat) => sum + (profile.categoryProgress[cat.key] ?? 0), 0)
    : 0;

  return (
    <AppBackground style={{ flex: 1 }}>

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

          <SectionHeader label="Profile" />

          {/* Block 1: Header card */}
          <View style={[pStyles.card, { backgroundColor: theme.surface }]}>

            <FloorStarsRow avg={profile.avgStars} />

            {/* Avatar + Name centered */}
            <View style={pStyles.profileCenter}>
              <Image source={getUserIcon(profile.playerLevel)} style={pStyles.avatar} contentFit="cover" />
              <Text style={[pStyles.name, { color: theme.text }]}>{profile.playerName}</Text>
              {profile.city ? (
                <Text style={[pStyles.cityLabel, { color: theme.textMuted }]}>{profile.city}</Text>
              ) : null}
            </View>

            {/* Level + Floors — icon inline with number, label below */}
            <View style={[pStyles.statsRow, { borderTopColor: theme.divider }]}>
              <View style={pStyles.statCol}>
                <View style={pStyles.statIconNum}>
                  <Image source={LVL_ICON} style={pStyles.statIcon} contentFit="contain" />
                  <Text style={[pStyles.statValue, { color: theme.text }]}>{profile.playerLevel}</Text>
                </View>
                <Text style={[pStyles.statLabel, { color: theme.textMuted }]}>Level</Text>
              </View>
              <View style={[pStyles.statDivider, { backgroundColor: theme.divider }]} />
              <View style={pStyles.statCol}>
                <View style={pStyles.statIconNum}>
                  <Image source={FLOOR_ICON} style={pStyles.statIcon} contentFit="contain" />
                  <Text style={[pStyles.statValue, { color: theme.text }]}>{profile.openedFloorsCount}</Text>
                </View>
                <Text style={[pStyles.statLabel, { color: theme.textMuted }]}>Floors</Text>
              </View>
            </View>

            {/* Happy / Specialists */}
            <View style={[pStyles.workerRow, { borderTopColor: theme.divider }]}>
              <View style={pStyles.workerItem}>
                <Image source={HAPPY_ICON} style={pStyles.workerIcon} contentFit="contain" />
                <View>
                  <Text style={[pStyles.workerLabel, { color: theme.textMuted }]}>Happy</Text>
                  <Text style={[pStyles.workerValue, { color: theme.text }]}>{profile.happyWorkers}/{profile.totalWorkers}</Text>
                </View>
              </View>
              <View style={pStyles.workerItem}>
                <Image source={SPEC_ICON} style={pStyles.workerIcon} contentFit="contain" />
                <View>
                  <Text style={[pStyles.workerLabel, { color: theme.textMuted }]}>Specialists</Text>
                  <Text style={[pStyles.workerValue, { color: theme.text }]}>{profile.specialistWorkers}/{profile.totalWorkers}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Block 2: Actions */}
          {currentPlayerId && id !== currentPlayerId && (
            <Pressable
              style={[pStyles.actionBtn, { backgroundColor: theme.surface }]}
              onPress={() => setComposeOpen(true)}
            >
              <Image source={MAIL_ICON} style={pStyles.actionIcon} contentFit="contain" />
              <Text style={[pStyles.actionBtnText, { color: theme.text }]}>Send Message</Text>
            </Pressable>
          )}
          {/* Friend action — only shown if viewing someone else's profile */}
          {currentPlayerId && id !== currentPlayerId && (
            <>
              {(!friendStatus || friendStatus.status === 'none') && (
                <Pressable
                  style={[pStyles.actionBtn, { backgroundColor: theme.surface }]}
                  onPress={async () => {
                    setFriendActionLoading(true);
                    try { await sendRequest(id); } catch { /* silent */ }
                    setFriendActionLoading(false);
                  }}
                  disabled={friendActionLoading}
                >
                  <Image source={FRIEND_ICON} style={pStyles.actionIcon} contentFit="contain" />
                  <Text style={[pStyles.actionBtnText, { color: theme.text }]}>Add Friend</Text>
                </Pressable>
              )}

              {friendStatus?.status === 'pending_sent' && (
                <View style={[pStyles.actionBtn, { backgroundColor: theme.surface }]}>
                  <Image source={FRIEND_ICON} style={pStyles.actionIcon} contentFit="contain" />
                  <Text style={[pStyles.actionBtnText, { flex: 1, color: theme.textMuted }]}>Request Sent</Text>
                  <Pressable
                    style={pStyles.cancelBtn}
                    onPress={async () => {
                      if (!friendStatus.requestId) return;
                      setFriendActionLoading(true);
                      try { await cancelRequest(friendStatus.requestId, id); } catch { /* silent */ }
                      setFriendActionLoading(false);
                    }}
                    disabled={friendActionLoading}
                  >
                    <Text style={pStyles.cancelBtnText}>Cancel</Text>
                  </Pressable>
                </View>
              )}

              {friendStatus?.status === 'pending_received' && (
                <View style={[pStyles.actionBtn, { backgroundColor: theme.surface, gap: 8 }]}>
                  <Image source={FRIEND_ICON} style={pStyles.actionIcon} contentFit="contain" />
                  <Pressable
                    style={pStyles.acceptBtn}
                    onPress={async () => {
                      if (!friendStatus.requestId) return;
                      setFriendActionLoading(true);
                      try { await acceptRequest(friendStatus.requestId, id); } catch { /* silent */ }
                      setFriendActionLoading(false);
                    }}
                    disabled={friendActionLoading}
                  >
                    <Text style={pStyles.acceptBtnText}>Accept</Text>
                  </Pressable>
                  <Pressable
                    style={pStyles.rejectBtn}
                    onPress={async () => {
                      if (!friendStatus.requestId) return;
                      setFriendActionLoading(true);
                      try { await rejectRequest(friendStatus.requestId, id); } catch { /* silent */ }
                      setFriendActionLoading(false);
                    }}
                    disabled={friendActionLoading}
                  >
                    <Text style={pStyles.rejectBtnText}>Reject</Text>
                  </Pressable>
                </View>
              )}

              {friendStatus?.status === 'friends' && (
                <Pressable
                  style={[pStyles.actionBtn, { backgroundColor: theme.surface }]}
                  onPress={async () => {
                    if (!friendStatus.requestId) return;
                    setFriendActionLoading(true);
                    try { await removeFriend(friendStatus.requestId, id); } catch { /* silent */ }
                    setFriendActionLoading(false);
                  }}
                  disabled={friendActionLoading}
                >
                  <Image source={REMOVE_FRIEND_ICON} style={pStyles.actionIcon} contentFit="contain" />
                  <Text style={[pStyles.actionBtnText, { flex: 1, color: theme.text }]}>Remove from Friends</Text>
                </Pressable>
              )}
            </>
          )}

          {/* Block 3: Achievements */}
          <Pressable
            style={[pStyles.actionBtn, { backgroundColor: theme.surface }]}
            onPress={() => setAchievementsOpen((v) => !v)}
          >
            <Image source={ACHIV_ICON} style={pStyles.actionIcon} contentFit="contain" />
            <Text style={[pStyles.actionBtnText, { flex: 1, color: theme.text }]}>
              Achievements ({totalAchievementLevels})
            </Text>
            <Svg width={20} height={20} viewBox="0 0 24 24">
              <Polyline
                points={achievementsOpen ? '6 15 12 9 18 15' : '6 9 12 15 18 9'}
                stroke={theme.textMuted as string}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          </Pressable>

          {achievementsOpen && (
            <View style={[pStyles.dropdownCard, { backgroundColor: theme.surface }]}>
              {ACHIEVEMENT_CATEGORIES.map((cat, idx) => {
                const level = profile.categoryProgress[cat.key] ?? 0;
                const rankTitle = level > 0
                  ? (cat.levels.find((l) => l.level === level)?.title ?? `Level ${level}`)
                  : 'Locked';
                const isLast = idx === ACHIEVEMENT_CATEGORIES.length - 1;
                return (
                  <View key={cat.key} style={[pStyles.achieveRow, { borderBottomColor: theme.divider }, isLast && { borderBottomWidth: 0 }]}>
                    <Image source={CAT_ICONS[cat.key]} style={pStyles.achieveCatIcon} contentFit="contain" />
                    <View style={{ flex: 1 }}>
                      <Text style={[pStyles.achieveName, { color: theme.text }]}>{cat.title}</Text>
                      <Text style={[pStyles.achieveRank, { color: level > 0 ? '#3FA535' : theme.textMuted }]}>
                        {rankTitle}
                      </Text>
                    </View>
                    <Image source={TIER_ICONS[Math.min(level, 7)]} style={pStyles.achieveTierIcon} contentFit="contain" />
                  </View>
                );
              })}
            </View>
          )}

          {/* Block 4: Business */}
          <SectionHeader label="Business" />
          <View style={[pStyles.compactCard, { backgroundColor: theme.surface }]}>
            {FLOOR_TYPES.map((ft, idx) => {
              const level = profile.businessUpgrades[ft] ?? 0;
              const pct = level * 5;
              const isLast = idx === FLOOR_TYPES.length - 1;
              return (
                <View key={ft} style={[pStyles.businessRow, { borderBottomColor: theme.divider }, isLast && { borderBottomWidth: 0 }]}>
                  <Image source={BIZ_ICONS[ft]} style={pStyles.bizIcon} contentFit="contain" />
                  <Text style={[pStyles.businessName, { color: theme.text }]}>{BUSINESS_LABELS[ft]}</Text>
                  <Text style={[pStyles.businessPct, { color: BUSINESS_COLORS[ft] }]}>+{pct}%</Text>
                </View>
              );
            })}
          </View>

          {/* Block 5: Revenue */}
          <SectionHeader label="Revenue" />
          <View style={[pStyles.compactCard, { backgroundColor: theme.surface }]}>
            {/* Coin bonus + XP bonus on one row */}
            <View style={[pStyles.bonusRow, { borderBottomColor: theme.divider }]}>
              <View style={pStyles.bonusHalf}>
                <Image source={MARKETING_ICON} style={pStyles.infoIcon} contentFit="contain" />
                <View>
                  <Text style={[pStyles.infoLabel, { color: theme.textMuted }]}>Coin bonus</Text>
                  <Text style={[pStyles.infoValue, { color: theme.text }]}>+{profile.coinBonusPercent}%</Text>
                </View>
              </View>
              <View style={[pStyles.bonusDivider, { backgroundColor: theme.divider }]} />
              <View style={pStyles.bonusHalf}>
                <Image source={PR_ICON} style={pStyles.infoIcon} contentFit="contain" />
                <View>
                  <Text style={[pStyles.infoLabel, { color: theme.textMuted }]}>XP bonus</Text>
                  <Text style={[pStyles.infoValue, { color: theme.text }]}>+{profile.xpBonusPercent}%</Text>
                </View>
              </View>
            </View>

            <InfoRow icons={[COIN_ICON]} label="Current / min" value={formatNum(profile.revenuePerMin)} />
            <InfoRow icons={[BEST_RPM_ICON]} label="Best / min" value={formatNum(profile.maxRevenuePerMin)} noBorder />
          </View>

          {/* Block 6: Status */}
          <SectionHeader label="Status" />
          <View style={[pStyles.compactCard, { backgroundColor: theme.surface }]}>
            <View style={[pStyles.statusRow, { borderBottomColor: theme.divider }]}>
              <View style={[pStyles.statusDot, { backgroundColor: isOnline ? '#52B847' : '#A6ACB8' }]} />
              <Text style={[pStyles.statusText, { color: theme.text }]}>{formatLastSeen(profile.lastSeenAt)}</Text>
            </View>
            <InfoRow icons={[SAND_CLOCK]} label="Days in game" value={String(daysInGame)} noBorder />
          </View>

        </ScrollView>
      )}

      <Modal
        visible={composeOpen}
        transparent
        animationType="fade"
        onRequestClose={closeCompose}
      >
        <KeyboardAvoidingView
          style={cStyles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={cStyles.backdrop} onPress={closeCompose} />
          <View style={[cStyles.card, { backgroundColor: theme.surface }]}>
            <Text style={[cStyles.title, { color: theme.text }]}>Send Message</Text>
            <View style={cStyles.costRow}>
              <Text style={[cStyles.costLabel, { color: theme.textMuted }]}>Cost: 100</Text>
              <Image source={COIN_ICON} style={cStyles.costIcon} contentFit="contain" />
            </View>

            {sendSuccess ? (
              <Text style={cStyles.successText}>Sent!</Text>
            ) : (
              <>
                {sendError ? <Text style={cStyles.errorText}>{sendError}</Text> : null}

                <Text style={[cStyles.fieldLabel, { color: theme.textMuted }]}>Subject</Text>
                <TextInput
                  style={[cStyles.input, { borderColor: theme.divider, color: theme.text, backgroundColor: theme.surfaceSub }]}
                  value={composeSubject}
                  onChangeText={setComposeSubject}
                  placeholder="Subject (max 100 chars)"
                  placeholderTextColor={theme.textMuted as string}
                  maxLength={100}
                  editable={!sendLoading}
                />

                <Text style={[cStyles.fieldLabel, { color: theme.textMuted }]}>Message</Text>
                <TextInput
                  style={[cStyles.textArea, { borderColor: theme.divider, color: theme.text, backgroundColor: theme.surfaceSub }]}
                  value={composeBody}
                  onChangeText={setComposeBody}
                  placeholder="Your message (max 1000 chars)"
                  placeholderTextColor={theme.textMuted as string}
                  multiline
                  maxLength={1000}
                  editable={!sendLoading}
                />

                <View style={cStyles.btnRow}>
                  <Pressable
                    style={({ pressed }) => [cStyles.cancelBtn, pressed && { opacity: 0.7 }]}
                    onPress={closeCompose}
                    disabled={sendLoading}
                  >
                    <Text style={cStyles.cancelBtnText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [cStyles.sendBtn, pressed && { opacity: 0.85 }]}
                    onPress={handleSend}
                    disabled={sendLoading}
                  >
                    {sendLoading
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={cStyles.sendBtnText}>Send</Text>
                    }
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Close button — bottom center, black circle */}
      <View style={pStyles.closeBtnWrap} pointerEvents="box-none">
        <Pressable onPress={() => router.back()} style={pStyles.closeBtn} hitSlop={8}>
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path
              d="M18 6L6 18M6 6l12 12"
              stroke="#fff"
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          </Svg>
        </Pressable>
      </View>

    </AppBackground>
  );
}

const pStyles = StyleSheet.create({
  scroll: { paddingTop: 56, paddingBottom: 110 },
  errorText: { fontFamily: 'Fredoka_500Medium', fontSize: 16, color: '#E05A4A' },

  /* Stars */
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 4, marginBottom: 14 },
  star: { width: 22, height: 22 },

  /* Cards */
  card: {
    marginHorizontal: 20, marginTop: 12,
    borderRadius: 24, paddingHorizontal: 15, paddingTop: 20, paddingBottom: 14,
    shadowColor: 'rgba(60,80,45,1)', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
  },
  compactCard: {
    marginHorizontal: 20, marginTop: 12,
    borderRadius: 24, paddingHorizontal: 15, paddingTop: 10, paddingBottom: 8,
    shadowColor: 'rgba(60,80,45,1)', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
  },

  /* Profile header */
  profileCenter: { alignItems: 'center', gap: 6, marginBottom: 4 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 3, borderColor: '#fff', overflow: 'hidden',
  },
  name: { fontFamily: 'Fredoka_600SemiBold', fontSize: 22, textAlign: 'center' },
  cityLabel: { fontFamily: 'Fredoka_400Regular', fontSize: 14, textAlign: 'center' },

  /* Level + Floors */
  statsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    marginTop: 14, paddingTop: 14, borderTopWidth: 1,
  },
  statCol: { flex: 1, alignItems: 'center', gap: 4 },
  statIconNum: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statIcon: { width: 30, height: 30 },
  statValue: { fontFamily: 'Fredoka_700Bold', fontSize: 28, lineHeight: 30 },
  statLabel: { fontFamily: 'Fredoka_500Medium', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.3 },
  statDivider: { width: 1, height: 48, opacity: 0.15 },

  /* Workers */
  workerRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 12,
    paddingTop: 12, borderTopWidth: 1,
  },
  workerItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  workerIcon: { width: 36, height: 36 },
  workerLabel: { fontFamily: 'Fredoka_500Medium', fontSize: 12 },
  workerValue: { fontFamily: 'Fredoka_700Bold', fontSize: 16 },

  /* Action buttons */
  actionBtn: {
    marginHorizontal: 20, marginTop: 10, borderRadius: 18,
    paddingVertical: 14, paddingLeft: 15, paddingRight: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    shadowColor: 'rgba(60,80,45,1)', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  actionIcon: { width: 36, height: 36 },
  actionBtnText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 16 },

  /* Achievements dropdown */
  dropdownCard: {
    marginHorizontal: 20, marginTop: 10, borderRadius: 18,
    paddingVertical: 4, paddingHorizontal: 15,
    shadowColor: 'rgba(60,80,45,1)', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
  },
  achieveRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  achieveCatIcon: { width: 32, height: 32 },
  achieveName: { fontFamily: 'Fredoka_600SemiBold', fontSize: 14 },
  achieveRank: { fontFamily: 'Fredoka_400Regular', fontSize: 12, marginTop: 1 },
  achieveTierIcon: { width: 36, height: 36 },

  /* Section header — centered, dark */
  sectionHeader: {
    marginHorizontal: 24, marginTop: 18, marginBottom: 2,
    fontFamily: 'Fredoka_600SemiBold', fontSize: 13,
    color: '#27331F', textTransform: 'uppercase', letterSpacing: 0.5,
    textAlign: 'center',
  },

  /* Business */
  businessRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  bizIcon: { width: 28, height: 28 },
  businessName: { flex: 1, fontFamily: 'Fredoka_500Medium', fontSize: 14 },
  businessPct: { fontFamily: 'Fredoka_700Bold', fontSize: 14 },

  /* Info rows */
  infoRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  infoLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoIcon: { width: 22, height: 22 },
  infoLabel: { fontFamily: 'Fredoka_500Medium', fontSize: 14, color: '#7C8A6E' },
  infoValue: { fontFamily: 'Fredoka_700Bold', fontSize: 14, color: '#27331F' },

  /* Coin + XP bonus combined */
  bonusRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  bonusHalf: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  bonusDivider: { width: 1, height: 36, backgroundColor: 'rgba(0,0,0,0.1)' },

  /* Status */
  statusRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  statusDot: { width: 9, height: 9, borderRadius: 5 },
  statusText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 14 },

  /* Friend action buttons */
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#F0EDE5',
  },
  cancelBtnText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
    color: '#7C8A6E',
  },
  acceptBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#3FA535',
    alignItems: 'center',
  },
  acceptBtnText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: '#fff',
  },
  rejectBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E05A4A',
    alignItems: 'center',
  },
  rejectBtnText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: '#E05A4A',
  },
  /* Close button */
  closeBtnWrap: {
    position: 'absolute', bottom: 36, left: 0, right: 0,
    alignItems: 'center', zIndex: 10,
  },
  closeBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#1A2030',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 6,
  },
});

const cStyles = StyleSheet.create({
  overlay: {
    flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24,
  },
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  card: {
    width: '100%', borderRadius: 24, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25, shadowRadius: 24, elevation: 12,
  },
  title: {
    fontFamily: 'Fredoka_700Bold', fontSize: 20, textAlign: 'center', marginBottom: 2,
  },
  costRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, marginBottom: 16,
  },
  costLabel: {
    fontFamily: 'Nunito_600SemiBold', fontSize: 13,
  },
  costIcon: { width: 18, height: 18 },
  fieldLabel: {
    fontFamily: 'Fredoka_500Medium', fontSize: 13, marginBottom: 5, marginTop: 10,
  },
  input: {
    height: 48, borderRadius: 13, borderWidth: 2, paddingHorizontal: 14,
    fontFamily: 'Nunito_600SemiBold', fontSize: 15,
  },
  textArea: {
    minHeight: 100, borderRadius: 13, borderWidth: 2, paddingHorizontal: 14,
    paddingTop: 12, fontFamily: 'Nunito_400Regular', fontSize: 14,
    textAlignVertical: 'top',
  },
  btnRow: {
    flexDirection: 'row', gap: 10, marginTop: 20,
  },
  cancelBtn: {
    flex: 1, height: 48, borderRadius: 14, borderWidth: 1.5,
    borderColor: '#C5C5C5', alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: {
    fontFamily: 'Fredoka_600SemiBold', fontSize: 15, color: '#7C8A6E',
  },
  sendBtn: {
    flex: 2, height: 48, borderRadius: 14, backgroundColor: '#3FA535',
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnText: {
    fontFamily: 'Fredoka_600SemiBold', fontSize: 16, color: '#fff',
  },
  errorText: {
    fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: '#C62828',
    textAlign: 'center', marginBottom: 10,
  },
  successText: {
    fontFamily: 'Fredoka_700Bold', fontSize: 22, color: '#3FA535',
    textAlign: 'center', paddingVertical: 20,
  },
});
