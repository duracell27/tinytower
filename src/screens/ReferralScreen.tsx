import React, { useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  Share, ActivityIndicator, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { InfoSection } from '../components/InfoSection';
import { Image } from 'expo-image';
import AppBackground from '../components/AppBackground';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { createMMKV } from 'react-native-mmkv';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useReferralStore, type ReferralEntry } from '../stores/referralStore';
import { getUserIcon } from '../utils/userIcon';

const DEEP_LINK_BASE = 'tinytower://ref?code=';
const authStorage = createMMKV({ id: 'auth' });

const ICON_OK       = require('../../assets/img/OkIcon.png');
const ICON_CLOCK    = require('../../assets/img/sandClock.png');
const ICON_GEM_BONUS = require('../../assets/img/diamond+percent.png');

function MilestoneRow({
  label,
  rewardAmount,
  rewardType,
  claimed,
  reachable,
  currentLevel,
}: {
  label: string;
  rewardAmount: number;
  rewardType: 'gems' | 'coins';
  claimed: boolean;
  reachable: boolean;
  currentLevel?: number;
}) {
  const rewardIcon =
    rewardType === 'coins'
      ? require('../../assets/img/coin.png')
      : require('../../assets/img/diamond.png');
  const rewardLabel =
    rewardType === 'coins'
      ? `+${rewardAmount.toLocaleString()}`
      : `+${rewardAmount}`;

  return (
    <View style={styles.milestoneRow}>
      <Image source={claimed ? ICON_OK : ICON_CLOCK} style={styles.milestoneIcon} contentFit="contain" />
      <Text style={styles.milestoneLabel}>{label}</Text>
      <View style={{ flex: 1 }} />
      {claimed ? (
        <View style={styles.milestoneValueRow}>
          <Text style={styles.milestoneEarned}>{rewardLabel} </Text>
          <Image source={rewardIcon} style={styles.diamondIcon} contentFit="contain" />
          <Text style={styles.milestoneEarned}> Claimed</Text>
        </View>
      ) : reachable ? (
        <View style={styles.milestoneValueRow}>
          <Text style={styles.milestonePending}>{rewardLabel} </Text>
          <Image source={rewardIcon} style={styles.diamondIcon} contentFit="contain" />
          <Text style={styles.milestonePending}> Pending</Text>
        </View>
      ) : currentLevel !== undefined ? (
        <Text style={styles.milestonePending}>lv {currentLevel}</Text>
      ) : (
        <Text style={styles.milestonePending}>Not reached</Text>
      )}
    </View>
  );
}

function ReferralCard({ entry }: { entry: ReferralEntry }) {
  return (
    <View style={styles.referralCard}>
      <View style={styles.referralNameRow}>
        <Image source={getUserIcon(entry.referredLevel)} style={styles.referralAvatar} contentFit="cover" />
        <Text style={styles.referralName}>{entry.referredName}</Text>
      </View>
      <MilestoneRow
        label="Registration"
        rewardAmount={10000}
        rewardType="coins"
        claimed={!!entry.milestones.registered.claimedAt}
        reachable={!entry.milestones.registered.claimedAt}
      />
      <MilestoneRow
        label="Level 10"
        rewardAmount={20}
        rewardType="gems"
        claimed={!!entry.milestones.level10.claimedAt}
        reachable={!!entry.milestones.level10.reachedAt}
        currentLevel={entry.milestones.level10.reachedAt ? undefined : entry.referredLevel}
      />
      <MilestoneRow
        label="Level 30"
        rewardAmount={50}
        rewardType="gems"
        claimed={!!entry.milestones.level30.claimedAt}
        reachable={!!entry.milestones.level30.reachedAt}
        currentLevel={entry.milestones.level30.reachedAt ? undefined : entry.referredLevel}
      />
      {entry.gemBonusEarned > 0 && (
        <View style={styles.milestoneRow}>
          <Image source={ICON_GEM_BONUS} style={styles.milestoneIcon} contentFit="contain" />
          <Text style={styles.milestoneLabel}>Purchase bonus</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.milestoneEarned}>+{entry.gemBonusEarned} 💎</Text>
        </View>
      )}
    </View>
  );
}

export default function ReferralScreen() {
  const { code, referrals, isLoading, hasUsedCode, referrerName, isApplying, fetchReferral, applyReferralCode } = useReferralStore();
  const [copied, setCopied] = React.useState(false);
  const [inputCode, setInputCode] = React.useState('');
  const [applyError, setApplyError] = React.useState('');
  const [codeExpanded, setCodeExpanded] = React.useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const chevronRotation = useSharedValue(0);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value}deg` }],
  }));

  const handleToggle = () => {
    const next = !codeExpanded;
    setCodeExpanded(next);
    chevronRotation.value = withTiming(next ? 180 : 0, { duration: 200 });
  };

  useEffect(() => {
    fetchReferral();
    const pending = authStorage.getString('referral.pendingCode');
    if (pending) {
      setInputCode(pending);
      setCodeExpanded(true);
      chevronRotation.value = 180;
    }
  }, []);

  const shareLink = code ? `${DEEP_LINK_BASE}${code}` : '';

  const handleCopy = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (!shareLink) return;
    Share.share({
      message: `Play TinyTower with me! My referral code: ${code}\n${shareLink}`,
    });
  };

  const handleApplyCode = async () => {
    setApplyError('');
    try {
      await applyReferralCode(inputCode);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid or already used code';
      setApplyError(msg);
    }
  };

  return (
    <AppBackground style={styles.container}>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3FA535" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.headingRow}>
            <Text style={styles.heading}>Referrals</Text>
            <Pressable onPress={() => setInfoVisible(true)} hitSlop={10}>
              <Image
                source={require('../../assets/img/InformationIcon.png')}
                style={styles.infoIcon}
                contentFit="contain"
              />
            </Pressable>
          </View>

          {hasUsedCode === false && (
            <View style={styles.applyCard}>
              <Pressable
                onPress={handleToggle}
                style={styles.applyHeader}
              >
                <Text style={styles.applyLabel}>Have a referral code?</Text>
                <Animated.View style={chevronStyle}>
                  <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                    <Path
                      d="M3 5.5L8 10.5L13 5.5"
                      stroke="#9BA3B0"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </Animated.View>
              </Pressable>
              {codeExpanded && (
                <>
                  <View style={styles.applyRow}>
                    <TextInput
                      style={styles.applyInput}
                      value={inputCode}
                      onChangeText={(t) => { setInputCode(t.toUpperCase()); setApplyError(''); }}
                      autoCapitalize="characters"
                      maxLength={6}
                      placeholder="XXXXXX"
                      placeholderTextColor="#B7B3A2"
                      editable={!isApplying}
                    />
                    <Pressable
                      onPress={handleApplyCode}
                      style={({ pressed }) => [
                        styles.applyBtn,
                        (isApplying || inputCode.length < 6) && styles.applyBtnDisabled,
                        pressed && { opacity: 0.75 },
                      ]}
                      disabled={isApplying || inputCode.length < 6}
                    >
                      {isApplying ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.applyBtnText}>Apply</Text>
                      )}
                    </Pressable>
                  </View>
                  {applyError ? <Text style={styles.applyError}>{applyError}</Text> : null}
                </>
              )}
            </View>
          )}

          {hasUsedCode && referrerName && (
            <View style={styles.referredByCard}>
              <Text style={styles.referredByLabel}>Invited by</Text>
              <View style={styles.referredByRow}>
                <Image
                  source={require('../../assets/img/profile/ReferralProfileIcon.png')}
                  style={styles.referredByIcon}
                  contentFit="contain"
                />
                <Text style={styles.referredByName}>{referrerName}</Text>
              </View>
            </View>
          )}

          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Your code</Text>
            <View style={styles.codeRow}>
              <Text style={styles.codeText}>{code ?? '------'}</Text>
              <Pressable onPress={handleCopy} style={({ pressed }) => [styles.copyBtn, pressed && { opacity: 0.7 }]}>
                <Text style={styles.copyBtnText}>{copied ? 'Copied!' : 'Copy'}</Text>
              </Pressable>
            </View>
            <Pressable onPress={handleShare} style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.85 }]}>
              <Text style={styles.shareBtnText}>Share link</Text>
            </Pressable>
          </View>

          {referrals.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No invited players yet.{'\n'}Share your link!</Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Invited players</Text>
              {referrals.map((entry) => (
                <ReferralCard key={entry.id} entry={entry} />
              ))}
            </>
          )}
        </ScrollView>
      )}

      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
      >
        <Text style={styles.closeBtnText}>✕</Text>
      </Pressable>

      {infoVisible && (
        <View style={styles.infoOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setInfoVisible(false)} />
          <View style={styles.infoCard}>
            <LinearGradient colors={['#C9637E', '#A8475F']} style={styles.infoCardHeader}>
              <Text style={styles.infoCardTitle}>Referrals</Text>
              <Pressable onPress={() => setInfoVisible(false)} hitSlop={10}>
                <Text style={styles.infoCardClose}>✕</Text>
              </Pressable>
            </LinearGradient>
            <View style={styles.infoCardBody}>
              <InfoSection
                icon={require('../../assets/img/profile/ReferralProfileIcon.png')}
                title="Your Referral Code"
                text="Share your unique code or link with friends. They enter it when registering to link you as their referrer."
                accentColor="rgba(201,99,126,0.3)"
              />
              <InfoSection
                icon={require('../../assets/img/OkIcon.png')}
                title="Milestone Rewards"
                text="Earn coins when your friend registers, and gems when they reach level 10 or level 30."
                accentColor="rgba(201,99,126,0.3)"
              />
              <InfoSection
                icon={require('../../assets/img/diamond+percent.png')}
                title="Purchase Bonus"
                text="You receive a gem bonus whenever a player you referred makes an in-game purchase."
                accentColor="rgba(201,99,126,0.3)"
              />
              <InfoSection
                icon={require('../../assets/img/sandClock.png')}
                title="Have a Referral Code?"
                text="If someone shared a code with you, tap the section below to enter it — both players receive a bonus."
                accentColor="rgba(201,99,126,0.3)"
                isLast
              />
            </View>
          </View>
        </View>
      )}
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  heading: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 28,
    color: '#27331F',
  },
  infoIcon: { width: 20, height: 20, opacity: 0.8 },
  infoOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(18,26,44,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  infoCard: { width: '100%', backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden' },
  infoCardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 13,
  },
  infoCardTitle: { fontFamily: 'Fredoka_700Bold', fontSize: 17, color: '#fff' },
  infoCardClose: { color: 'rgba(255,255,255,0.85)', fontSize: 16, fontFamily: 'Fredoka_600SemiBold' },
  infoCardBody: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8 },
  scroll: { paddingTop: 64, paddingHorizontal: 20, paddingBottom: 120, gap: 12 },
  closeBtn: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  closeBtnPressed: { opacity: 0.7 },
  closeBtnText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 20,
    color: '#fff',
    lineHeight: 22,
  },
  codeCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    gap: 12,
    shadowColor: 'rgba(60,80,45,1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  codeLabel: { fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: '#7C8A6E', textTransform: 'uppercase', letterSpacing: 0.5 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  codeText: { fontFamily: 'Fredoka_700Bold', fontSize: 28, color: '#1A3D6B', letterSpacing: 4, flex: 1 },
  copyBtn: { backgroundColor: '#F0F7FF', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  copyBtnText: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: '#2592AB' },
  shareBtn: {
    backgroundColor: '#2592AB',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  shareBtnText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 16, color: '#fff' },
  sectionTitle: { fontFamily: 'Fredoka_600SemiBold', fontSize: 18, color: '#27331F', marginTop: 4 },
  referralCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 8,
    shadowColor: 'rgba(60,80,45,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  referralNameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  referralAvatar: { width: 32, height: 32, borderRadius: 16 },
  referralName: { fontFamily: 'Fredoka_600SemiBold', fontSize: 16, color: '#27331F' },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  milestoneIcon: { width: 18, height: 18 },
  milestoneLabel: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: '#3E4A35' },
  milestoneValueRow: { flexDirection: 'row', alignItems: 'center' },
  diamondIcon: { width: 13, height: 13 },
  milestoneEarned: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: '#3FA535' },
  milestonePending: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: '#9BA3B0' },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: 'rgba(60,80,45,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyText: { fontFamily: 'Nunito_600SemiBold', fontSize: 14, color: '#9BA3B0', textAlign: 'center', lineHeight: 22 },
  applyCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    gap: 10,
    shadowColor: 'rgba(60,80,45,1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  applyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  applyLabel: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 13,
    color: '#5A6650',
  },
  applyRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  applyInput: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E4E1D3',
    backgroundColor: '#FBFAF5',
    paddingHorizontal: 14,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 20,
    color: '#1A3D6B',
    letterSpacing: 3,
  },
  applyBtn: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#3FA535',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
  },
  applyBtnDisabled: {
    opacity: 0.45,
  },
  applyBtnText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
    color: '#fff',
  },
  applyError: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 12,
    color: '#C62828',
  },
  referredByCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 8,
    shadowColor: 'rgba(60,80,45,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  referredByLabel: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 11,
    color: '#9BA3B0',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  referredByRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  referredByIcon: {
    width: 28,
    height: 28,
  },
  referredByName: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 17,
    color: '#27331F',
  },
});
