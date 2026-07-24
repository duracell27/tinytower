import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import type { ForumPost } from '../stores/forumStore';
import { getUserIcon } from '../utils/userIcon';

interface Props {
  post: ForumPost;
  onPress: () => void;
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

export default function ForumPostRow({ post, onPress }: Props) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Image source={getPostIcon(post)} style={styles.statusIcon} contentFit="contain" />
      <View style={styles.content}>
        <Text
          style={[styles.title, post.isPinned && styles.titlePinned]}
          numberOfLines={2}
        >
          {post.title}
        </Text>
        <View style={styles.meta}>
          <Image source={getUserIcon(post.playerLevel)} style={styles.avatar} contentFit="cover" />
          <Text style={styles.metaText} numberOfLines={1}>
            {post.playerName} · Lv.{post.playerLevel} · {formatAge(post.updatedAt)} · 💬 {post.commentCount}
          </Text>
        </View>
      </View>
      <Text style={styles.chevron}>›</Text>
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
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avatar: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#e8e8e8' },
  metaText: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: '#999', flex: 1 },
  chevron: { fontSize: 20, color: '#ccc' },
});
