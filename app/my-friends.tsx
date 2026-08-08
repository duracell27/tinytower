import React, { useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import AppBackground from '../src/components/AppBackground';
import { useAppTheme } from '../src/hooks/useAppTheme';
import { useFriendStore } from '../src/stores/friendStore';
import { getUserIcon } from '../src/utils/userIcon';
import type { FriendEntry, IncomingRequest } from '../src/services/api';

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
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    borderWidth: 1.5, borderColor: '#E05A4A',
  },
  removeBtnText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 12, color: '#E05A4A' },
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

  useEffect(() => {
    Promise.all([fetchFriends(), fetchIncoming()]).finally(() => setLoading(false));
  }, [fetchFriends, fetchIncoming]);

  // Switch to requests tab automatically if no friends but requests exist
  useEffect(() => {
    if (friends.length === 0 && pendingCount > 0) setActiveTab('requests');
  }, [friends.length, pendingCount]);

  return (
    <AppBackground style={{ flex: 1 }}>

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
                      await removeFriend(entry.requestId, entry.playerId);
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
                    onAccept={async () => { await acceptRequest(entry.requestId, entry.fromId); }}
                    onReject={async () => { await rejectRequest(entry.requestId, entry.fromId); }}
                  />
                ))
              )}
            </View>
          )}

        </ScrollView>
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

const tabStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingTop: 56,
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
