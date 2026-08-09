import React, { useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import AppBackground from '../src/components/AppBackground';
import { useAppTheme } from '../src/hooks/useAppTheme';
import { InfoSection } from '../src/components/InfoSection';
import { useFriendStore } from '../src/stores/friendStore';
import { getUserIcon } from '../src/utils/userIcon';
import type { FriendEntry, IncomingRequest } from '../src/services/api';

const INFO_ICON    = require('../assets/img/InformationIcon.png');
const CANCEL_ICON  = require('../assets/img/CancellIcon.png');

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

function OnlineDot({ lastSeenAt }: { lastSeenAt: string }) {
  const isOnline = Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS;
  return (
    <View style={[dotStyles.dot, { backgroundColor: isOnline ? '#52B847' : '#A6ACB8' }]} />
  );
}

const dotStyles = StyleSheet.create({
  dot: { width: 9, height: 9, borderRadius: 5, flexShrink: 0 },
});

function FriendRow({ entry, onRemove, theme }: {
  entry: FriendEntry;
  onRemove: () => void;
  theme: ReturnType<typeof useAppTheme>;
}) {
  return (
    <Pressable
      style={({ pressed }) => [fStyles.row, { borderBottomColor: theme.divider }, pressed && { opacity: 0.75 }]}
      onPress={() => router.push(`/user-profile/${entry.playerId}` as any)}
    >
      <Image source={getUserIcon(entry.playerLevel)} style={fStyles.avatar} contentFit="cover" />
      <View style={fStyles.info}>
        <Text style={[fStyles.name, { color: theme.text }]}>{entry.playerName}</Text>
        <View style={fStyles.subRow}>
          <OnlineDot lastSeenAt={entry.lastSeenAt} />
          <Text style={[fStyles.level, { color: theme.textMuted }]}>Lv {entry.playerLevel}</Text>
        </View>
      </View>
      <Pressable
        style={({ pressed }) => [fStyles.removeBtn, pressed && { opacity: 0.7 }]}
        onPress={onRemove}
        hitSlop={8}
      >
        <Image source={CANCEL_ICON} style={fStyles.removeIcon} contentFit="contain" />
        <Text style={fStyles.removeBtnText}>Remove</Text>
      </Pressable>
    </Pressable>
  );
}

const fStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 11,
    paddingHorizontal: 16, borderBottomWidth: 1,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  info: { flex: 1, marginLeft: 12, gap: 3 },
  name: { fontFamily: 'Fredoka_600SemiBold', fontSize: 15 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  level: { fontFamily: 'Fredoka_400Regular', fontSize: 12 },
  removeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4,
  },
  removeIcon: { width: 16, height: 16 },
  removeBtnText: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: '#E05A4A' },
});

function RequestRow({ entry, onAccept, onReject, theme }: {
  entry: IncomingRequest;
  onAccept: () => void;
  onReject: () => void;
  theme: ReturnType<typeof useAppTheme>;
}) {
  return (
    <View style={[rStyles.row, { borderBottomColor: theme.divider }]}>
      <Pressable
        style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', flex: 1 }, pressed && { opacity: 0.75 }]}
        onPress={() => router.push(`/user-profile/${entry.fromId}` as any)}
      >
        <Image source={getUserIcon(entry.playerLevel)} style={rStyles.avatar} contentFit="cover" />
        <View style={rStyles.info}>
          <Text style={[rStyles.name, { color: theme.text }]}>{entry.playerName}</Text>
          <Text style={[rStyles.level, { color: theme.textMuted }]}>Lv {entry.playerLevel}</Text>
        </View>
      </Pressable>
      <View style={rStyles.actions}>
        <Pressable
          style={({ pressed }) => [rStyles.acceptBtn, pressed && { opacity: 0.8 }]}
          onPress={onAccept}
        >
          <Text style={rStyles.acceptText}>Accept</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [rStyles.rejectBtn, pressed && { opacity: 0.8 }]}
          onPress={onReject}
        >
          <Text style={rStyles.rejectText}>Reject</Text>
        </Pressable>
      </View>
    </View>
  );
}

const rStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 11,
    paddingHorizontal: 16, borderBottomWidth: 1,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  info: { flex: 1, marginLeft: 12, gap: 2 },
  name: { fontFamily: 'Fredoka_600SemiBold', fontSize: 15 },
  level: { fontFamily: 'Fredoka_400Regular', fontSize: 12 },
  actions: { flexDirection: 'row', gap: 8 },
  acceptBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: '#3FA535',
  },
  acceptText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 13, color: '#fff' },
  rejectBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#E05A4A',
  },
  rejectText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 13, color: '#E05A4A' },
});

export default function MyFriendsScreen() {
  const theme = useAppTheme();
  const friends = useFriendStore(s => s.friends);
  const incomingRequests = useFriendStore(s => s.incomingRequests);
  const pendingCount = useFriendStore(s => s.pendingCount);
  const fetchFriends = useFriendStore(s => s.fetchFriends);
  const fetchIncoming = useFriendStore(s => s.fetchIncoming);
  const acceptRequest = useFriendStore(s => s.acceptRequest);
  const rejectRequest = useFriendStore(s => s.rejectRequest);
  const removeFriend = useFriendStore(s => s.removeFriend);

  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');
  const [loading, setLoading] = useState(true);
  const [infoVisible, setInfoVisible] = useState(false);

  useEffect(() => {
    Promise.all([fetchFriends(), fetchIncoming()]).finally(() => setLoading(false));
  }, [fetchFriends, fetchIncoming]);

  // Switch to requests tab automatically if no friends but requests exist
  useEffect(() => {
    if (friends.length === 0 && pendingCount > 0) setActiveTab('requests');
  }, [friends.length, pendingCount]);

  // Switch back to friends tab when all requests have been handled
  useEffect(() => {
    if (pendingCount === 0 && activeTab === 'requests') setActiveTab('friends');
  }, [pendingCount, activeTab]);

  return (
    <AppBackground style={{ flex: 1 }}>

      <View style={headerStyles.header}>
        <Text style={headerStyles.title}>My Friends</Text>
        <Pressable onPress={() => setInfoVisible(true)} hitSlop={10}>
          <Image source={INFO_ICON} style={headerStyles.infoIcon} contentFit="contain" />
        </Pressable>
      </View>
      <Text style={headerStyles.subtitle}>Friends list and incoming requests</Text>

      {/* Tab bar */}
      <View style={[tabStyles.bar, { borderBottomColor: theme.divider }]}>
        <Pressable
          style={[tabStyles.tab, activeTab === 'friends' && tabStyles.tabActive]}
          onPress={() => setActiveTab('friends')}
        >
          <Text style={[tabStyles.tabText, { color: activeTab === 'friends' ? '#3FA535' : theme.textMuted }]}>
            Friends {friends.length > 0 ? `(${friends.length})` : ''}
          </Text>
          {activeTab === 'friends' && <View style={tabStyles.indicator} />}
        </Pressable>

        {pendingCount > 0 && (
          <Pressable
            style={[tabStyles.tab, activeTab === 'requests' && tabStyles.tabActive]}
            onPress={() => setActiveTab('requests')}
          >
            <View style={tabStyles.tabWithBadge}>
              <Text style={[tabStyles.tabText, { color: activeTab === 'requests' ? '#3FA535' : theme.textMuted }]}>
                Requests
              </Text>
              <View style={tabStyles.badge}>
                <Text style={tabStyles.badgeText}>{pendingCount}</Text>
              </View>
            </View>
            {activeTab === 'requests' && <View style={tabStyles.indicator} />}
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#3FA535" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>

          {activeTab === 'friends' && (
            <View style={[listStyles.card, { backgroundColor: theme.surface }]}>
              {friends.length === 0 ? (
                <Text style={[listStyles.emptyText, { color: theme.textMuted }]}>No friends yet</Text>
              ) : (
                friends.map((entry, idx) => (
                  <FriendRow
                    key={entry.requestId}
                    entry={entry}
                    theme={theme}
                    onRemove={async () => {
                      try { await removeFriend(entry.requestId, entry.playerId); }
                      catch { /* already handled by store */ }
                    }}
                  />
                ))
              )}
            </View>
          )}

          {activeTab === 'requests' && (
            <View style={[listStyles.card, { backgroundColor: theme.surface }]}>
              {incomingRequests.length === 0 ? (
                <Text style={[listStyles.emptyText, { color: theme.textMuted }]}>No pending requests</Text>
              ) : (
                incomingRequests.map((entry) => (
                  <RequestRow
                    key={entry.requestId}
                    entry={entry}
                    theme={theme}
                    onAccept={async () => {
                      try { await acceptRequest(entry.requestId, entry.fromId); }
                      catch { /* already handled by store */ }
                    }}
                    onReject={async () => {
                      try { await rejectRequest(entry.requestId, entry.fromId); }
                      catch { /* already handled by store */ }
                    }}
                  />
                ))
              )}
            </View>
          )}

        </ScrollView>
      )}

      {infoVisible && (
        <View style={headerStyles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setInfoVisible(false)} />
          <View style={headerStyles.infoCard}>
            <LinearGradient colors={['#3FA535', '#2C7A25']} style={headerStyles.infoCardHeader}>
              <Text style={headerStyles.infoCardTitle}>My Friends</Text>
              <Pressable onPress={() => setInfoVisible(false)} hitSlop={10}>
                <Text style={headerStyles.infoCardClose}>✕</Text>
              </Pressable>
            </LinearGradient>
            <View style={headerStyles.infoCardBody}>
              <InfoSection
                icon={require('../assets/img/users.png')}
                title="Friends List"
                text="View all your in-game friends. Tap a friend to visit their profile and see their tower stats."
                accentColor="rgba(63,165,53,0.2)"
              />
              <InfoSection
                icon={require('../assets/img/addfriend.png')}
                title="Friend Requests"
                text="Accept or reject incoming friend requests. The badge on the tab shows how many requests are waiting."
                accentColor="rgba(63,165,53,0.2)"
              />
              <InfoSection
                icon={require('../assets/img/removefriend.png')}
                title="Remove Friends"
                text="You can remove a friend at any time from the friends list."
                accentColor="rgba(63,165,53,0.2)"
              />
              <InfoSection
                icon={require('../assets/img/userIcons/user1-29.png')}
                title="Add Friends"
                text="To send a friend request, visit any player's profile and tap 'Add Friend'."
                accentColor="rgba(63,165,53,0.2)"
                isLast
              />
            </View>
          </View>
        </View>
      )}

      {/* Close button — same style as user-profile */}
      <View style={closeStyles.wrap} pointerEvents="box-none">
        <Pressable onPress={() => router.back()} style={closeStyles.btn} hitSlop={8}>
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
          </Svg>
        </Pressable>
      </View>

    </AppBackground>
  );
}

const headerStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginTop: 60, marginHorizontal: 20, gap: 12 },
  title: { fontFamily: 'Fredoka_700Bold', fontSize: 24, color: '#27331F' },
  subtitle: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: '#7C8A6E', marginHorizontal: 20, marginTop: 6, marginBottom: 10 },
  infoIcon: { width: 20, height: 20, opacity: 0.8 },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(18,26,44,0.45)',
    justifyContent: 'center', alignItems: 'center', padding: 24, zIndex: 20,
  },
  infoCard: { width: '100%', backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden' },
  infoCardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 13,
  },
  infoCardTitle: { fontFamily: 'Fredoka_700Bold', fontSize: 17, color: '#fff' },
  infoCardClose: { color: 'rgba(255,255,255,0.85)', fontSize: 16, fontFamily: 'Fredoka_600SemiBold' },
  infoCardBody: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8 },
});

const tabStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 10,
    paddingTop: 4,
    position: 'relative',
  },
  tabActive: {},
  tabText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
  },
  tabWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    backgroundColor: '#E05A4A',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 11,
    color: '#fff',
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 2.5,
    backgroundColor: '#3FA535',
    borderRadius: 2,
  },
});

const listStyles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: 'rgba(60,80,45,1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  emptyText: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 15,
    textAlign: 'center',
    padding: 30,
  },
});

const closeStyles = StyleSheet.create({
  wrap: {
    position: 'absolute', bottom: 36, left: 0, right: 0,
    alignItems: 'center', zIndex: 10,
  },
  btn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#1A2030',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 6,
  },
});
