import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import LocaleText from '../src/components/LocaleText';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import AppBackground from '../src/components/AppBackground';
import { useAppTheme } from '../src/hooks/useAppTheme';
import { useTranslation } from 'react-i18next';
import { InfoSection } from '../src/components/InfoSection';
import { useMailStore } from '../src/stores/mailStore';
import { useCityStore } from '../src/stores/cityStore';
import { getUserIcon } from '../src/utils/userIcon';
import { api } from '../src/services/api';
import type { MailMessage, SentMailMessage } from '../src/services/api';

const CITY_ICON = require('../assets/img/city/cityBuildings.png');
const OK_ICON   = require('../assets/img/OkIcon.png');
const NO_ICON   = require('../assets/img/CancellIcon.png');

const DELETE_ICON   = require('../assets/img/CancellIcon.png');
const INFO_ICON     = require('../assets/img/InformationIcon.png');
const INBOX_ICON    = require('../assets/img/incomeMailIcon.png');
const SENT_ICON     = require('../assets/img/sendMailIcon.png');

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
  const { t } = useTranslation('tabs');
  const [expanded, setExpanded] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<'pending' | 'accepted' | 'declined' | 'loading'>(
    mail.cityInvite?.status === 'PENDING' ? 'pending' :
    mail.cityInvite?.status === 'ACCEPTED' ? 'accepted' :
    mail.cityInvite?.status === 'DECLINED' ? 'declined' : 'pending'
  );
  const fetchMyCityInfo = useCityStore(s => s.fetchMyCityInfo);

  const handlePress = () => {
    setExpanded((v) => !v);
    if (!mail.isRead) onMarkRead();
  };

  const handleInviteRespond = async (accept: boolean) => {
    if (!mail.cityInvite) return;
    setInviteStatus('loading');
    try {
      if (accept) {
        await api.acceptCityInvite(mail.cityInvite.token);
        await fetchMyCityInfo();
        setInviteStatus('accepted');
      } else {
        await api.declineCityInvite(mail.cityInvite.token);
        setInviteStatus('declined');
      }
    } catch {
      setInviteStatus(accept ? 'pending' : 'pending');
    }
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
      <Pressable
        onPress={() => router.push(`/user-profile/${mail.fromId}`)}
        style={styles.avatarWrap}
        hitSlop={4}
      >
        <Image source={INBOX_ICON} style={styles.directionBadge} contentFit="contain" />
        <View style={styles.avatarInner}>
          <Image
            source={getUserIcon(mail.fromLevel)}
            style={[styles.avatar, { borderColor: theme.surface }]}
            contentFit="cover"
          />
          {!mail.isRead && <View style={[styles.unreadDot, { borderColor: theme.surface }]} />}
        </View>
      </Pressable>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.push(`/user-profile/${mail.fromId}`)}
            hitSlop={6}
            style={styles.fromNameBtn}
          >
            <LocaleText
              style={[
                styles.fromName,
                { color: theme.text },
                !mail.isRead && styles.fromNameBold,
              ]}
              numberOfLines={1}
            >
              {mail.fromName}
            </LocaleText>
          </Pressable>
          <LocaleText style={[styles.date, { color: theme.textMuted }]}>
            {formatDate(mail.createdAt)}
          </LocaleText>
        </View>

        <LocaleText
          style={[
            styles.subject,
            { color: mail.isRead ? (theme.textMuted as string) : (theme.text as string) },
            !mail.isRead && styles.subjectBold,
          ]}
          numberOfLines={expanded ? undefined : 1}
        >
          {mail.subject}
        </LocaleText>

        {expanded && (
          <View style={[styles.bodyWrap, { borderTopColor: theme.divider }]}>
            {mail.cityInvite ? (
              <View style={[styles.inviteCard, { backgroundColor: theme.surfaceCard ?? theme.surfaceSub }]}>
                <View style={styles.inviteHeader}>
                  <Image source={CITY_ICON} style={styles.inviteCityIcon} contentFit="contain" />
                  <View style={{ flex: 1 }}>
                    <LocaleText style={[styles.inviteCityName, { color: theme.text }]}>
                      {mail.cityInvite.cityName}
                    </LocaleText>
                    <LocaleText style={[styles.inviteCityLevel, { color: theme.textMuted }]}>
                      {t('mail.cityLevel', { level: mail.cityInvite.cityLevel })}
                    </LocaleText>
                  </View>
                </View>
                {inviteStatus === 'pending' && (
                  <View style={styles.inviteActions}>
                    <Pressable
                      style={[styles.inviteAccept]}
                      onPress={() => handleInviteRespond(true)}
                    >
                      <Image source={OK_ICON} style={styles.inviteActionIcon} contentFit="contain" />
                      <LocaleText style={styles.inviteAcceptText}>{t('mail.accept')}</LocaleText>
                    </Pressable>
                    <Pressable
                      style={[styles.inviteDecline]}
                      onPress={() => handleInviteRespond(false)}
                    >
                      <Image source={NO_ICON} style={styles.inviteActionIcon} contentFit="contain" />
                      <LocaleText style={styles.inviteDeclineText}>{t('mail.decline')}</LocaleText>
                    </Pressable>
                  </View>
                )}
                {inviteStatus === 'loading' && <ActivityIndicator size="small" color="#3FA535" style={{ marginTop: 8 }} />}
                {inviteStatus === 'accepted' && <LocaleText style={[styles.inviteResult, { color: '#3FA535' }]}>{t('mail.inviteAccepted')}</LocaleText>}
                {inviteStatus === 'declined' && <LocaleText style={[styles.inviteResult, { color: theme.textMuted }]}>{t('mail.inviteDeclined')}</LocaleText>}
              </View>
            ) : (
              <LocaleText style={[styles.body, { color: theme.text }]}>{mail.body}</LocaleText>
            )}
            <View style={styles.bodyActions}>
              <Pressable
                onPress={onDelete}
                style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.7 }]}
                hitSlop={6}
              >
                <Image source={DELETE_ICON} style={styles.deleteIcon} contentFit="contain" />
                <LocaleText style={styles.deleteBtnText}>{t('mail.delete')}</LocaleText>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function SentRow({ mail, theme }: { mail: SentMailMessage; theme: ReturnType<typeof useAppTheme> }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Pressable
      style={({ pressed }) => [styles.row, { borderBottomColor: theme.divider }, pressed && { opacity: 0.85 }]}
      onPress={() => setExpanded(v => !v)}
    >
      <Pressable
        onPress={() => router.push(`/user-profile/${mail.toId}`)}
        style={styles.avatarWrap}
        hitSlop={4}
      >
        <Image source={SENT_ICON} style={styles.directionBadge} contentFit="contain" />
        <View style={styles.avatarInner}>
          <Image source={getUserIcon(mail.toLevel)} style={[styles.avatar, { borderColor: theme.surface }]} contentFit="cover" />
        </View>
      </Pressable>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.push(`/user-profile/${mail.toId}`)}
            hitSlop={6}
            style={styles.fromNameBtn}
          >
            <LocaleText style={[styles.fromName, { color: theme.text }]} numberOfLines={1}>{mail.toName}</LocaleText>
          </Pressable>
          <LocaleText style={[styles.date, { color: theme.textMuted }]}>{formatDate(mail.createdAt)}</LocaleText>
        </View>
        <LocaleText style={[styles.subject, { color: theme.textMuted as string }]} numberOfLines={expanded ? undefined : 1}>
          {mail.subject}
        </LocaleText>
        {expanded && (
          <View style={[styles.bodyWrap, { borderTopColor: theme.divider }]}>
            <LocaleText style={[styles.body, { color: theme.text }]}>{mail.body}</LocaleText>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function MyMailScreen() {
  const { t } = useTranslation('tabs');
  const theme = useAppTheme();
  const mails = useMailStore((s) => s.mails);
  const sentMails = useMailStore((s) => s.sentMails);
  const fetchInbox = useMailStore((s) => s.fetchInbox);
  const fetchSent = useMailStore((s) => s.fetchSent);
  const markRead = useMailStore((s) => s.markRead);
  const deleteMail = useMailStore((s) => s.deleteMail);
  const [tab, setTab] = useState<'all' | 'inbox' | 'sent'>('all');
  const [loading, setLoading] = useState(true);
  const [infoVisible, setInfoVisible] = useState(false);

  useEffect(() => {
    setLoading(true);
    const p =
      tab === 'all'
        ? Promise.all([fetchInbox(), fetchSent()])
        : tab === 'inbox'
        ? fetchInbox()
        : fetchSent();
    p.finally(() => setLoading(false));
  }, [tab, fetchInbox, fetchSent]);

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
            <LocaleText style={[styles.screenTitle, { color: theme.text }]}>{t('mail.title')}</LocaleText>
            <Pressable onPress={() => setInfoVisible(true)} hitSlop={10}>
              <Image source={INFO_ICON} style={styles.infoIcon} contentFit="contain" />
            </Pressable>
          </View>

          {/* Tabs */}
          <View style={styles.tabRow}>
            <Pressable
              style={[styles.tab, tab === 'all' && styles.tabActive]}
              onPress={() => setTab('all')}
            >
              <LocaleText style={[styles.tabText, tab === 'all' && styles.tabTextActive]}>{t('mail.tabAll')}</LocaleText>
            </Pressable>
            <Pressable
              style={[styles.tab, tab === 'inbox' && styles.tabActive]}
              onPress={() => setTab('inbox')}
            >
              <LocaleText style={[styles.tabText, tab === 'inbox' && styles.tabTextActive]}>{t('mail.tabInbox')}</LocaleText>
            </Pressable>
            <Pressable
              style={[styles.tab, tab === 'sent' && styles.tabActive]}
              onPress={() => setTab('sent')}
            >
              <LocaleText style={[styles.tabText, tab === 'sent' && styles.tabTextActive]}>{t('mail.tabSent')}</LocaleText>
            </Pressable>
          </View>

          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            {tab === 'all' ? (() => {
              type AllItem =
                | { kind: 'inbox'; mail: MailMessage }
                | { kind: 'sent'; mail: SentMailMessage };
              const combined: AllItem[] = [
                ...mails.map((m): AllItem => ({ kind: 'inbox', mail: m })),
                ...sentMails.map((m): AllItem => ({ kind: 'sent', mail: m })),
              ].sort((a, b) => new Date(b.mail.createdAt).getTime() - new Date(a.mail.createdAt).getTime());
              if (combined.length === 0) return (
                <View style={styles.emptyWrap}>
                  <LocaleText style={styles.emptyEmoji}>📭</LocaleText>
                  <LocaleText style={[styles.emptyTitle, { color: theme.text }]}>{t('mail.emptyTitle')}</LocaleText>
                  <LocaleText style={[styles.emptySubtitle, { color: theme.textMuted }]}>
                    {t('mail.emptySubtitle')}
                  </LocaleText>
                </View>
              );
              return combined.map((item) =>
                item.kind === 'inbox' ? (
                  <MailRow
                    key={`in-${item.mail.id}`}
                    mail={item.mail}
                    theme={theme}
                    onMarkRead={() => markRead(item.mail.id)}
                    onDelete={() => deleteMail(item.mail.id).catch(() => {})}
                  />
                ) : (
                  <SentRow key={`sent-${item.mail.id}`} mail={item.mail} theme={theme} />
                )
              );
            })() : tab === 'inbox' ? (
              mails.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <LocaleText style={styles.emptyEmoji}>📭</LocaleText>
                  <LocaleText style={[styles.emptyTitle, { color: theme.text }]}>{t('mail.emptyTitle')}</LocaleText>
                  <LocaleText style={[styles.emptySubtitle, { color: theme.textMuted }]}>
                    {t('mail.emptySubtitle')}
                  </LocaleText>
                </View>
              ) : (
                mails.map((mail) => (
                  <MailRow
                    key={mail.id}
                    mail={mail}
                    theme={theme}
                    onMarkRead={() => markRead(mail.id)}
                    onDelete={() => deleteMail(mail.id).catch(() => {})}
                  />
                ))
              )
            ) : (
              sentMails.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <LocaleText style={styles.emptyEmoji}>📤</LocaleText>
                  <LocaleText style={[styles.emptyTitle, { color: theme.text }]}>{t('mail.emptySentTitle')}</LocaleText>
                  <LocaleText style={[styles.emptySubtitle, { color: theme.textMuted }]}>
                    {t('mail.emptySentSubtitle')}
                  </LocaleText>
                </View>
              ) : (
                sentMails.map((mail) => (
                  <SentRow key={mail.id} mail={mail} theme={theme} />
                ))
              )
            )}
          </View>
        </ScrollView>
      )}

      {infoVisible && (
        <View style={styles.infoOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setInfoVisible(false)} />
          <View style={[styles.infoCard, { backgroundColor: theme.surface }]}>
            <LinearGradient colors={['#3FA535', '#2C7A25']} style={styles.infoCardHeader}>
              <LocaleText style={styles.infoCardTitle}>{t('mail.title')}</LocaleText>
              <Pressable onPress={() => setInfoVisible(false)} hitSlop={10}>
                <LocaleText style={styles.infoCardClose}>✕</LocaleText>
              </Pressable>
            </LinearGradient>
            <View style={styles.infoCardBody}>
              <InfoSection
                icon={require('../assets/img/mail.png')}
                title={t('mail.info.inboxTitle')}
                text={t('mail.info.inboxText')}
                accentColor="rgba(63,165,53,0.2)"
              />
              <InfoSection
                icon={require('../assets/img/userIcons/user1-29.png')}
                title={t('mail.info.unreadTitle')}
                text={t('mail.info.unreadText')}
                accentColor="rgba(63,165,53,0.2)"
              />
              <InfoSection
                icon={require('../assets/img/CancellIcon.png')}
                title={t('mail.info.deleteTitle')}
                text={t('mail.info.deleteText')}
                accentColor="rgba(63,165,53,0.2)"
              />
              <InfoSection
                icon={require('../assets/img/coin.png')}
                title={t('mail.info.costTitle')}
                text={t('mail.info.costText')}
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
  screenTitle: { fontFamily: 'Fredoka_700Bold', fontSize: 24 },
  screenSubtitle: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, marginHorizontal: 20, marginTop: 6, marginBottom: 6 },

  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(63,165,53,0.08)',
  },
  tabActive: {
    backgroundColor: '#3FA535',
  },
  tabText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: '#3FA535',
  },
  tabTextActive: {
    color: '#fff',
  },
  infoIcon: { width: 20, height: 20, opacity: 0.8 },
  infoOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(18,26,44,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 20,
  },
  infoCard: { width: '100%', borderRadius: 20, overflow: 'hidden' },
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
    gap: 8,
  },
  rowUnread: {
    backgroundColor: 'rgba(63,165,53,0.13)',
  },

  /* Avatar */
  avatarWrap: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatarInner: { position: 'relative' },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
  directionBadge: {
    width: 26,
    height: 26,
    alignSelf: 'center',
  },

  /* Content */
  content: { flex: 1, minWidth: 0 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  fromNameBtn: {
    flex: 1,
    marginRight: 6,
  },
  fromName: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 15,
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
  bodyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  inviteCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 10,
  },
  inviteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inviteCityIcon: {
    width: 36,
    height: 36,
  },
  inviteCityName: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
    lineHeight: 18,
  },
  inviteCityLevel: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    marginTop: 2,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: 8,
  },
  inviteAccept: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#3FA535',
    paddingVertical: 8,
    borderRadius: 10,
  },
  inviteDecline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(180,60,60,0.13)',
    paddingVertical: 8,
    borderRadius: 10,
  },
  inviteActionIcon: {
    width: 16,
    height: 16,
  },
  inviteAcceptText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: '#fff',
  },
  inviteDeclineText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: '#B43C3C',
  },
  inviteResult: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 4,
  },
});
