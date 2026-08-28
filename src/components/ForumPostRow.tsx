import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import type { ForumPost } from '../stores/forumStore';
import { getUserIcon } from '../utils/userIcon';
import { useBlockStore } from '../stores/blockStore';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { useAppTheme } from '../hooks/useAppTheme';

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
  const theme = useAppTheme();
  const { isDark } = theme;
  const styles = getStyles(theme);
  const blocked = useBlockStore(s => s.isBlocked(post.playerId));
  const playerId = useAuthStore(s => s.player?.id);
  const currentPlayerLevel = useGameStore(s => s.playerLevel);
  const displayLevel = post.playerId === playerId ? currentPlayerLevel : post.playerLevel;
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Image source={getPostIcon(post)} style={styles.statusIcon} contentFit="contain" />
      <View style={styles.content}>
        <Text
          style={[styles.title, post.isPinned && styles.titlePinned]}
          numberOfLines={2}
        >
          {blocked ? <Text style={styles.blockedText}>From blocked user</Text> : post.title}
        </Text>
        <View style={styles.meta}>
          <Image
            source={getUserIcon(displayLevel)}
            style={[styles.avatar, blocked && { borderColor: '#E05A4A', borderWidth: 2 }]}
            contentFit="cover"
          />
          <Text style={styles.metaText} numberOfLines={1}>{post.playerName}</Text>
          <Text style={styles.metaSep}>·</Text>
          <Image source={LVL_ICON} style={styles.metaIcon} contentFit="contain" />
          <Text style={styles.metaText}>{displayLevel}</Text>
          <Text style={styles.metaSep}>·</Text>
          <Image source={CHAT_ICON} style={styles.metaIcon} contentFit="contain" />
          <Text style={styles.metaText}>{post.commentCount}</Text>
        </View>
      </View>
      <Text style={styles.dateText}>{formatAge(post.updatedAt)}</Text>
    </Pressable>
  );
}

function getStyles(theme: ReturnType<typeof useAppTheme>) {
  const { isDark } = theme;
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.divider,
      gap: 10,
    },
    statusIcon: { width: 40, height: 40, flexShrink: 0 },
    content: { flex: 1, gap: 4 },
    title: {
      fontFamily: 'Fredoka_600SemiBold',
      fontSize: 15,
      color: theme.text,
      lineHeight: 20,
    },
    titlePinned: { fontFamily: 'Fredoka_700Bold' },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'nowrap', overflow: 'hidden' },
    avatar: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: isDark ? '#3A3F4A' : '#e8e8e8',
      flexShrink: 0,
    },
    metaText: {
      fontFamily: 'Nunito_400Regular',
      fontSize: 12,
      color: isDark ? '#5A6470' : '#999',
    },
    metaSep: {
      fontFamily: 'Nunito_400Regular',
      fontSize: 12,
      color: isDark ? '#5A6470' : '#999',
      flexShrink: 0,
    },
    metaIcon: { width: 13, height: 13, flexShrink: 0 },
    dateText: {
      fontFamily: 'Nunito_400Regular',
      fontSize: 12,
      color: isDark ? '#5A6470' : '#bbb',
      flexShrink: 0,
    },
    blockedText: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: '#aaa', fontStyle: 'italic' },
  });
}
