import React, { useEffect } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  Share, ActivityIndicator, ImageBackground,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useReferralStore, type ReferralEntry } from '../stores/referralStore';
import { getUserIcon } from '../utils/userIcon';

const DEEP_LINK_BASE = 'tinytower://ref?code=';

const ICON_OK       = require('../../assets/img/OkIcon.png');
const ICON_CLOCK    = require('../../assets/img/sandClock.png');
const ICON_GEM_BONUS = require('../../assets/img/diamond+percent.png');

function MilestoneRow({
  label,
  gems,
  claimed,
  reachable,
  currentLevel,
}: {
  label: string;
  gems: number;
  claimed: boolean;
  reachable: boolean;
  currentLevel?: number;
}) {
  return (
    <View style={styles.milestoneRow}>
      <Image source={claimed ? ICON_OK : ICON_CLOCK} style={styles.milestoneIcon} contentFit="contain" />
      <Text style={styles.milestoneLabel}>{label}</Text>
      <View style={{ flex: 1 }} />
      {claimed ? (
        <Text style={styles.milestoneEarned}>+{gems} 💎 Claimed</Text>
      ) : reachable ? (
        <Text style={styles.milestonePending}>+{gems} 💎 Pending</Text>
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
        gems={5}
        claimed={!!entry.milestones.registered.claimedAt}
        reachable={false}
      />
      <MilestoneRow
        label="Level 30"
        gems={50}
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
  const { code, referrals, isLoading, fetchReferral } = useReferralStore();
  const [copied, setCopied] = React.useState(false);

  useEffect(() => {
    fetchReferral();
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

  return (
    <ImageBackground
      source={require('../../assets/welcome-bg.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3FA535" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.heading}>Referrals</Text>
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
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heading: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 28,
    color: '#27331F',
    marginBottom: 6,
  },
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
});
