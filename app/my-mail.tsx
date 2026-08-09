import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import AppBackground from '../src/components/AppBackground';
import { useAppTheme } from '../src/hooks/useAppTheme';
import { InfoSection } from '../src/components/InfoSection';
import { useMailStore } from '../src/stores/mailStore';
import { getUserIcon } from '../src/utils/userIcon';
import type { MailMessage } from '../src/services/api';

const DELETE_ICON = require('../assets/img/CancellIcon.png');
const INFO_ICON   = require('../assets/img/InformationIcon.png');

function formatDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function MailRow({
  mail,
  onDelete,
  onMarkRead,
  theme,
}: {
  mail: MailMessage;
  onDelete: () => void;
  onMarkRead: () => void;
  theme: ReturnType<typeof useAppTheme>;
}) {
  const [expanded, setExpanded] = useState(false);

  const handlePress = () => {
    setExpanded((v) => !v);
    if (!mail.isRead) onMarkRead();
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: theme.divider },
        !mail.isRead && styles.rowUnread,
        pressed && { opacity: 0.85 },
      ]}
      onPress={handlePress}
    >
      {/* Avatar */}
      <View style={styles.avatarWrap}>
        <Image
          source={getUserIcon(mail.fromLevel)}
          style={styles.avatar}
          contentFit="cover"
        />
        {!mail.isRead && <View style={styles.unreadDot} />}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text
            style={[
              styles.fromName,
              { color: theme.text },
              !mail.isRead && styles.fromNameBold,
            ]}
            numberOfLines={1}
          >
            {mail.fromName}
          </Text>
          <Text style={[styles.date, { color: theme.textMuted }]}>
            {formatDate(mail.createdAt)}
          </Text>
        </View>

        <Text
          style={[
            styles.subject,
            { color: mail.isRead ? (theme.textMuted as string) : (theme.text as string) },
            !mail.isRead && styles.subjectBold,
          ]}
          numberOfLines={expanded ? undefined : 1}
        >
          {mail.subject}
        </Text>

        {expanded && (
          <View style={[styles.bodyWrap, { borderTopColor: theme.divider }]}>
            <Text style={[styles.body, { color: theme.text }]}>{mail.body}</Text>
            <Pressable
              onPress={onDelete}
              style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.7 }]}
              hitSlop={6}
            >
              <Image source={DELETE_ICON} style={styles.deleteIcon} contentFit="contain" />
              <Text style={styles.deleteBtnText}>Delete</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function MyMailScreen() {
  const theme = useAppTheme();
  const mails = useMailStore((s) => s.mails);
  const fetchInbox = useMailStore((s) => s.fetchInbox);
  const markRead = useMailStore((s) => s.markRead);
  const deleteMail = useMailStore((s) => s.deleteMail);
  const [loading, setLoading] = useState(true);
  const [infoVisible, setInfoVisible] = useState(false);

  useEffect(() => {
    fetchInbox().finally(() => setLoading(false));
  }, [fetchInbox]);

  return (
    <AppBackground style={{ flex: 1 }}>
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#3FA535" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.screenTitle}>My Mail</Text>
            <Pressable onPress={() => setInfoVisible(true)} hitSlop={10}>
              <Image source={INFO_ICON} style={styles.infoIcon} contentFit="contain" />
            </Pressable>
          </View>
          <Text style={styles.screenSubtitle}>Messages from other players</Text>

          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            {mails.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyEmoji}>📭</Text>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>No messages yet</Text>
                <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
                  When someone sends you a message it'll show up here
                </Text>
              </View>
            ) : (
              mails.map((mail, idx) => (
                <MailRow
                  key={mail.id}
                  mail={mail}
                  theme={theme}
                  onMarkRead={() => markRead(mail.id)}
                  onDelete={() => deleteMail(mail.id).catch(() => {})}
                />
              ))
            )}
          </View>
        </ScrollView>
      )}

      {infoVisible && (
        <View style={styles.infoOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setInfoVisible(false)} />
          <View style={styles.infoCard}>
            <LinearGradient colors={['#3FA535', '#2C7A25']} style={styles.infoCardHeader}>
              <Text style={styles.infoCardTitle}>My Mail</Text>
              <Pressable onPress={() => setInfoVisible(false)} hitSlop={10}>
                <Text style={styles.infoCardClose}>✕</Text>
              </Pressable>
            </LinearGradient>
            <View style={styles.infoCardBody}>
              <InfoSection
                icon={require('../assets/img/mail.png')}
                title="Inbox"
                text="Receive messages from any player in the game. Messages are sorted from newest to oldest."
                accentColor="rgba(63,165,53,0.2)"
              />
              <InfoSection
                icon={require('../assets/img/userIcons/user1-29.png')}
                title="Read & Unread"
                text="Unread messages are highlighted in green. Tap a message to open and read it — it will be marked as read automatically."
                accentColor="rgba(63,165,53,0.2)"
              />
              <InfoSection
                icon={require('../assets/img/CancellIcon.png')}
                title="Delete"
                text="You can delete any message after reading it. Deletion is permanent."
                accentColor="rgba(63,165,53,0.2)"
              />
              <InfoSection
                icon={require('../assets/img/coin.png')}
                title="Sending Cost"
                text="Sending a message to another player costs 100 coins. Find any player's profile to send them a message."
                accentColor="rgba(63,165,53,0.2)"
                isLast
              />
            </View>
          </View>
        </View>
      )}

      <View style={styles.closeBtnWrap} pointerEvents="box-none">
        <Pressable onPress={() => router.back()} style={styles.closeBtn} hitSlop={8}>
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

const styles = StyleSheet.create({
  scroll: { paddingBottom: 110 },

  header: { flexDirection: 'row', alignItems: 'center', marginTop: 60, marginHorizontal: 20, gap: 12 },
  screenTitle: { fontFamily: 'Fredoka_700Bold', fontSize: 24, color: '#27331F' },
  screenSubtitle: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: '#7C8A6E', marginHorizontal: 20, marginTop: 6, marginBottom: 6 },
  infoIcon: { width: 20, height: 20, opacity: 0.8 },
  infoOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(18,26,44,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 20,
  },
  infoCard: { width: '100%', backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden' },
  infoCardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 13,
  },
  infoCardTitle: { fontFamily: 'Fredoka_700Bold', fontSize: 17, color: '#fff' },
  infoCardClose: { color: 'rgba(255,255,255,0.85)', fontSize: 16, fontFamily: 'Fredoka_600SemiBold' },
  infoCardBody: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8 },

  card: {
    marginHorizontal: 16,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: 'rgba(60,80,45,1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },

  /* Row */
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  rowUnread: {
    backgroundColor: 'rgba(63,165,53,0.13)',
  },

  /* Avatar */
  avatarWrap: { position: 'relative', flexShrink: 0 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: '#fff',
    overflow: 'hidden',
  },
  unreadDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3FA535',
    borderWidth: 2,
    borderColor: '#fff',
  },

  /* Content */
  content: { flex: 1, minWidth: 0 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  fromName: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 15,
    flex: 1,
    marginRight: 6,
  },
  fromNameBold: { fontFamily: 'Fredoka_700Bold' },
  date: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    flexShrink: 0,
  },
  subject: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
  },
  subjectBold: { fontFamily: 'Fredoka_600SemiBold' },

  /* Expanded body */
  bodyWrap: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  body: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  deleteBtn: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  deleteIcon: { width: 16, height: 16 },
  deleteBtnText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: '#E05A4A',
  },

  /* Empty state */
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 18,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },

  /* Close button */
  closeBtnWrap: {
    position: 'absolute',
    bottom: 36,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  closeBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1A2030',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
});
