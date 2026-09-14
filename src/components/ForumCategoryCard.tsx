import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import LocaleText from './LocaleText';
import { Image } from 'expo-image';
import type { ForumCategory } from '../stores/forumStore';
import { useAppTheme } from '../hooks/useAppTheme';

interface Props {
  category: ForumCategory;
  label: string;
  description: string;
  unreadCount: number;
  onPress: () => void;
}

const CATEGORY_ICONS: Record<ForumCategory, ReturnType<typeof require>> = {
  NEWS:      require('../../assets/img/forum/forumCatNews.png'),
  HELP:      require('../../assets/img/forum/forumCatHelp.png'),
  GENERAL:   require('../../assets/img/forum/forumCatGeneral.png'),
  CITIES:    require('../../assets/img/forum/forumCatCities.png'),
  PURCHASES: require('../../assets/img/forum/forumCatPurchases.png'),
};

export default function ForumCategoryCard({ category, label, description, unreadCount, onPress }: Props) {
  const theme = useAppTheme();
  const { isDark } = theme;
  return (
    <Pressable style={[styles.card, isDark && { backgroundColor: theme.surfaceCard }]} onPress={onPress}>
      <Image
        source={CATEGORY_ICONS[category]}
        style={styles.folderIcon}
        contentFit="contain"
      />
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <LocaleText style={[styles.label, { color: theme.text }]}>{label}</LocaleText>
        </View>
        <LocaleText style={[styles.description, { color: theme.textMuted }]} numberOfLines={1}>{description}</LocaleText>
      </View>
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <LocaleText style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</LocaleText>
        </View>
      )}
      <LocaleText style={[styles.arrow, { color: isDark ? '#5A6470' : '#ccc' }]}>›</LocaleText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
    gap: 12,
  },
  folderIcon: { width: 44, height: 44 },
  info: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontFamily: 'Fredoka_600SemiBold', fontSize: 16, color: '#2A3344' },
  description: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: '#888' },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#3C9A34',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 12, color: '#fff' },
  arrow: { fontSize: 24, color: '#ccc', marginLeft: 2 },
});
