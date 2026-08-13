import React from 'react';
import { View, Text, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { Image } from 'expo-image';
import type { ForumPost } from '../stores/forumStore';
import { getUserIcon } from '../utils/userIcon';
import { useBlockStore } from '../stores/blockStore';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';

const LVL_ICON  = require('../../assets/img/lvlIcon.png');
const CHAT_ICON = require('../../assets/img/menu/chat.png');

interface Props {
  post: ForumPost;
  onPress: () => void;
  onReport?: () => void; // kept for API compat, no longer shown in row
}

function getPostIcon(post: ForumPost) {
  if (post.isClosed) return require('../../assets/img/forum/closed.png');
  if (post.isPinned) return require('../../assets/img/forum/pinned.png');
  if (post.isUnread) return require('../../assets/img/forum/new.png');
  return require('../../assets/img/forum/viewed.png');
}

function formatAge(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function ForumPostRow({ post, onPress, onReport }: Props) {
  const isDark = useColorScheme() === 'dark';
  const blocked = useBlockStore(s => s.isBlocked(post.playerId));
  const playerId = useAuthStore(s => s.player?.id);
  const currentPlayerLevel = useGameStore(s => s.playerLevel);
  const displayLevel = post.playerId === playerId ? currentPlayerLevel : post.playerLevel;
  return (
    <Pressable
      style={[styles.row, isDark && { backgroundColor: '#2A2F38', borderBottomColor: 'rgba(255,255,255,0.08)' }]}
      onPress={onPress}
    >
      <Image source={getPostIcon(post)} style={styles.statusIcon} contentFit="contain" />
      <View style={styles.content}>
        <Text
          style={[styles.title, post.isPinned && styles.titlePinned, isDark && { color: '#DDE8D8' }]}
          numberOfLines={2}
        >
          {blocked ? <Text style={styles.blockedText}>From blocked user</Text> : post.title}
        </Text>
        <View style={styles.meta}>
          <Image source={getUserIcon(displayLevel)} style={[styles.avatar, isDark && { backgroundColor: '#3A3F4A' }, blocked && { borderColor: '#E05A4A', borderWidth: 2 }]} contentFit="cover" />
          <Text style={[styles.metaText, isDark && { color: '#5A6470' }]} numberOfLines={1}>{post.playerName}</Text>
          <Text style={[styles.metaSep, isDark && { color: '#5A6470' }]}>·</Text>
          <Image source={LVL_ICON} style={styles.metaIcon} contentFit="contain" />
          <Text style={[styles.metaText, isDark && { color: '#5A6470' }]}>{displayLevel}</Text>
          <Text style={[styles.metaSep, isDark && { color: '#5A6470' }]}>·</Text>
          <Image source={CHAT_ICON} style={styles.metaIcon} contentFit="contain" />
          <Text style={[styles.metaText, isDark && { color: '#5A6470' }]}>{post.commentCount}</Text>
        </View>
      </View>
      <Text style={[styles.dateText, isDark && { color: '#5A6470' }]}>{formatAge(post.updatedAt)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 10,
  },
  statusIcon: { width: 40, height: 40, flexShrink: 0 },
  content: { flex: 1, gap: 4 },
  title: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
    color: '#2A3344',
    lineHeight: 20,
  },
  titlePinned: { fontFamily: 'Fredoka_700Bold' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'nowrap', overflow: 'hidden' },
  avatar: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#e8e8e8', flexShrink: 0 },
  metaText: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: '#999' },
  metaSep: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: '#999', flexShrink: 0 },
  metaIcon: { width: 13, height: 13, flexShrink: 0 },
  dateText: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: '#bbb', flexShrink: 0 },
  blockedText: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: '#aaa', fontStyle: 'italic' },
});
