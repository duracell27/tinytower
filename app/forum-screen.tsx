import React, { useCallback } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import ForumCategoryCard from '../src/components/ForumCategoryCard';
import { useForumStore, type ForumCategory } from '../src/stores/forumStore';
import { useAuthStore } from '../src/stores/authStore';

const CATEGORIES: ForumCategory[] = ['NEWS', 'HELP', 'GENERAL', 'CITIES', 'PURCHASES'];

export default function ForumScreen() {
  const router = useRouter();
  const { t } = useTranslation('tabs');
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const { fetchUnreadCounts, unreadCounts } = useForumStore();
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) void fetchUnreadCounts();
    }, [isAuthenticated, fetchUnreadCounts]),
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }, isDark && { backgroundColor: '#1A1E24' }]}>
      <View style={[styles.header, isDark && { backgroundColor: '#1E2028', borderBottomColor: 'rgba(255,255,255,0.08)' }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={[styles.headerTitle, isDark && { color: '#DDE8D8' }]}>{t('menu.forum')}</Text>
        <View style={styles.backBtn} />
      </View>

      <FlatList
        data={CATEGORIES}
        keyExtractor={c => c}
        renderItem={({ item }) => (
          <ForumCategoryCard
            category={item}
            label={t(`forum.categories.${item}`)}
            description={t(`forum.categoryDescriptions.${item}`)}
            unreadCount={unreadCounts[item] ?? 0}
            onPress={() => router.push({ pathname: '/forum-category', params: { category: item } })}
          />
        )}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7F0' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  backBtn: { width: 36, alignItems: 'center' },
  backIcon: { fontSize: 32, color: '#3C9A34', lineHeight: 36 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 20,
    color: '#2A3344',
  },
  list: { paddingVertical: 12 },
});
