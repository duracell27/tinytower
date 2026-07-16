import React, { useEffect } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  Share, ActivityIndicator, ImageBackground,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useReferralStore, type ReferralEntry } from '../stores/referralStore';
import { GemIcon } from '../components/CurrencyIcons';

const DEEP_LINK_BASE = 'tinytower://ref?code=';

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
      <Text style={styles.milestoneDot}>{claimed ? '✅' : reachable ? '✅' : '⏳'}</Text>
      <Text style={styles.milestoneLabel}>{label}</Text>
      <View style={{ flex: 1 }} />
      {claimed ? (
        <Text style={styles.milestoneEarned}>+{gems} 💎 Отримано</Text>
      ) : reachable ? (
        <Text style={styles.milestoneEarned}>+{gems} 💎 Отримано</Text>
      ) : currentLevel !== undefined ? (
        <Text style={styles.milestonePending}>{currentLevel} рівень</Text>
      ) : (
        <Text style={styles.milestonePending}>Не виконано</Text>
      )}
    </View>
  );
}

function ReferralCard({ entry }: { entry: ReferralEntry }) {
  return (
    <View style={styles.referralCard}>
      <Text style={styles.referralName}>👤 {entry.referredName}</Text>
      <MilestoneRow
        label="Реєстрація  +5 💎"
        gems={5}
        claimed={!!entry.milestones.registered.claimedAt}
        reachable={false}
      />
      <MilestoneRow
        label="Рівень 30  +50 💎"
        gems={50}
        claimed={!!entry.milestones.level30.claimedAt}
        reachable={!!entry.milestones.level30.reachedAt}
        currentLevel={entry.milestones.level30.reachedAt ? undefined : entry.referredLevel}
      />
      {entry.gemBonusEarned > 0 && (
        <View style={styles.milestoneRow}>
          <Text style={styles.milestoneDot}>💰</Text>
          <Text style={styles.milestoneLabel}>Бонус з покупок</Text>
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
      message: `Грай зі мною у TinyTower! Мій код: ${code}\n${shareLink}`,
    });
  };

  return (
    <ImageBackground
      source={require('../../assets/welcome-bg.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Реферали</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3FA535" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Твій код</Text>
            <View style={styles.codeRow}>
              <Text style={styles.codeText}>{code ?? '------'}</Text>
              <Pressable onPress={handleCopy} style={({ pressed }) => [styles.copyBtn, pressed && { opacity: 0.7 }]}>
                <Text style={styles.copyBtnText}>{copied ? 'Скопійовано!' : '📋 Копіювати'}</Text>
              </Pressable>
            </View>
            <Pressable onPress={handleShare} style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.85 }]}>
              <Text style={styles.shareBtnText}>🔗 Поділитися посиланням</Text>
            </Pressable>
          </View>

          {referrals.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Ще немає запрошених гравців.{'\n'}Поділись посиланням!</Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Запрошені гравці</Text>
              {referrals.map((entry) => (
                <ReferralCard key={entry.id} entry={entry} />
              ))}
            </>
          )}
        </ScrollView>
      )}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 8,
  },
  backBtn: { padding: 4, marginRight: 4 },
  backArrow: { fontSize: 32, color: '#27331F', lineHeight: 36 },
  headerTitle: { fontFamily: 'Fredoka_700Bold', fontSize: 26, color: '#27331F' },
  scroll: { paddingHorizontal: 20, paddingBottom: 120, gap: 12, paddingTop: 8 },
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
  referralName: { fontFamily: 'Fredoka_600SemiBold', fontSize: 16, color: '#27331F', marginBottom: 4 },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  milestoneDot: { fontSize: 14 },
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
