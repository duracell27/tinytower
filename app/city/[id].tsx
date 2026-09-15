import React, { useEffect, useState } from 'react';
import {
  View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  Alert, useColorScheme,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import LocaleText from '../../src/components/LocaleText';
import AppBackground from '../../src/components/AppBackground';
import { useCityStore } from '../../src/stores/cityStore';
import { useAuthStore } from '../../src/stores/authStore';
import type { CityDetail, CityMember, CityRole } from '../../src/services/api';

const ROLE_ORDER: CityRole[] = ['NEWBIE', 'CITIZEN', 'BUSINESSMAN', 'ADVISOR', 'VICE_MAYOR', 'ACTING_MAYOR', 'MAYOR'];

function roleRank(role: CityRole): number {
  return ROLE_ORDER.indexOf(role);
}

function canKick(actorRole: CityRole, targetRole: CityRole): boolean {
  if (actorRole === 'MAYOR') return true;
  if (actorRole === 'ACTING_MAYOR') return targetRole !== 'MAYOR';
  if (actorRole === 'VICE_MAYOR') return roleRank(targetRole) <= roleRank('ADVISOR');
  return false;
}

function canPromote(actorRole: CityRole): boolean {
  return actorRole === 'MAYOR' || actorRole === 'ACTING_MAYOR' || actorRole === 'VICE_MAYOR';
}

export default function CityDetailScreen() {
  const { t } = useTranslation('tabs');
  const isDark = useColorScheme() === 'dark';
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const player = useAuthStore((s) => s.player);
  const { getCityById, kickMember, changeMemberRole } = useCityStore();

  const [city, setCity] = useState<CityDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getCityById(id);
      setCity(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleKick = (member: CityMember) => {
    Alert.alert('', t('city.kick.confirm', { name: member.playerName }), [
      { text: t('city.kick.error'), style: 'cancel' },
      {
        text: t('city.detail.kick'),
        style: 'destructive',
        onPress: async () => {
          try {
            await kickMember(id!, member.playerId);
            await load();
          } catch {
            Alert.alert('', t('city.kick.error'));
          }
        },
      },
    ]);
  };

  const handleChangeRole = (member: CityMember) => {
    const myRole = city?.myRole;
    if (!myRole) return;

    const availableRoles: CityRole[] = myRole === 'VICE_MAYOR'
      ? ['NEWBIE', 'CITIZEN', 'BUSINESSMAN', 'ADVISOR']
      : ['NEWBIE', 'CITIZEN', 'BUSINESSMAN', 'ADVISOR', 'VICE_MAYOR', 'ACTING_MAYOR', 'MAYOR'];

    const options = availableRoles
      .filter((r) => r !== member.role)
      .map((role) => ({
        text: t(`city.roles.${role}`),
        onPress: async () => {
          try {
            await changeMemberRole(id!, member.playerId, role);
            await load();
          } catch {
            Alert.alert('', t('city.roleChange.error'));
          }
        },
      }));

    Alert.alert(t('city.roleChange.title'), member.playerName, [
      ...options,
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  if (loading) {
    return (
      <AppBackground style={[styles.background, isDark && styles.backgroundDark]}>
        <View style={styles.center}>
          <ActivityIndicator color={isDark ? '#6BAED0' : '#2E6EC9'} />
        </View>
      </AppBackground>
    );
  }

  if (!city) {
    return (
      <AppBackground style={[styles.background, isDark && styles.backgroundDark]}>
        <View style={styles.center}>
          <LocaleText style={[styles.errorText, isDark && { color: '#8A9A80' }]}>{t('city.errors.load')}</LocaleText>
        </View>
      </AppBackground>
    );
  }

  const myRole = city.myRole;
  const isMyCity = !!myRole;

  return (
    <AppBackground style={[styles.background, isDark && styles.backgroundDark]}>
      <FlatList
        data={city.members}
        keyExtractor={(m) => m.playerId}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            {/* City header */}
            <View style={[styles.headerCard, isDark && styles.headerCardDark]}>
              <LocaleText style={styles.headerEmoji}>🏙️</LocaleText>
              <LocaleText style={[styles.headerName, isDark && { color: '#DDE8D8' }]}>{city.name}</LocaleText>
              <LocaleText style={[styles.headerLevel, isDark && { color: '#6BAED0' }]}>
                {t('city.levelLabel', { level: city.level })}
              </LocaleText>
              <View style={[styles.bonusBadge, isDark && { backgroundColor: 'rgba(100,200,120,0.2)' }]}>
                <LocaleText style={[styles.bonusBadgeText, isDark && { color: '#7BCF8A' }]}>
                  {t('city.bonusLabel', { percent: city.level })}
                </LocaleText>
              </View>
              <LocaleText style={[styles.memberCountText, isDark && { color: '#8A9A80' }]}>
                {t('city.memberCount', { count: city.memberCount, max: city.maxMembers })}
              </LocaleText>
              {city.description ? (
                <LocaleText style={[styles.description, isDark && { color: '#9AAAB8' }]}>{city.description}</LocaleText>
              ) : null}
            </View>

            <LocaleText style={[styles.sectionTitle, isDark && { color: '#DDE8D8' }]}>
              {t('city.members')}
            </LocaleText>
          </View>
        }
        renderItem={({ item: member }) => {
          const isMe = member.playerId === player?.id;
          const showKick = isMyCity && !isMe && myRole && canKick(myRole, member.role);
          const showRole = isMyCity && !isMe && myRole && canPromote(myRole);

          return (
            <View style={[styles.memberRow, isDark && styles.memberRowDark]}>
              <TouchableOpacity
                style={styles.memberInfo}
                onPress={() => router.push(`/user-profile/${member.playerId}`)}
                activeOpacity={0.7}
              >
                <LocaleText style={[styles.memberName, isDark && { color: '#DDE8D8' }]}>
                  {member.playerName}
                  {isMe ? ' ✦' : ''}
                </LocaleText>
                <LocaleText style={[styles.memberMeta, isDark && { color: '#8A9A80' }]}>
                  {t('city.detail.level', { level: member.playerLevel })} · {t(`city.roles.${member.role}`)}
                </LocaleText>
              </TouchableOpacity>

              <View style={styles.memberActions}>
                {showRole && (
                  <TouchableOpacity
                    style={[styles.actionBtn, isDark && styles.actionBtnDark]}
                    onPress={() => handleChangeRole(member)}
                    activeOpacity={0.7}
                  >
                    <LocaleText style={[styles.actionBtnText, isDark && { color: '#DDE8D8' }]}>⬆</LocaleText>
                  </TouchableOpacity>
                )}
                {showKick && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.kickBtn]}
                    onPress={() => handleKick(member)}
                    activeOpacity={0.7}
                  >
                    <LocaleText style={styles.kickBtnText}>✕</LocaleText>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
      />
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#F0F8FF' },
  backgroundDark: { backgroundColor: '#0D1F2D' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontFamily: 'Fredoka_500Medium', fontSize: 15, color: '#7A8A80' },
  list: { paddingBottom: 40 },

  headerCard: { backgroundColor: '#D0E8F8', margin: 16, borderRadius: 18, padding: 20, alignItems: 'center' },
  headerCardDark: { backgroundColor: 'rgba(30,60,100,0.45)' },
  headerEmoji: { fontSize: 48, marginBottom: 8 },
  headerName: { fontFamily: 'Fredoka_700Bold', fontSize: 22, color: '#0A1C30', textAlign: 'center', marginBottom: 4 },
  headerLevel: { fontFamily: 'Fredoka_600SemiBold', fontSize: 15, color: '#2E6EC9', marginBottom: 8 },
  bonusBadge: { backgroundColor: 'rgba(50,160,80,0.15)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 8 },
  bonusBadgeText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 14, color: '#2A7A3A' },
  memberCountText: { fontFamily: 'Fredoka_500Medium', fontSize: 13, color: '#5A7090', marginBottom: 4 },
  description: { fontFamily: 'Fredoka_400Regular', fontSize: 13, color: '#5A7A90', textAlign: 'center', marginTop: 4 },

  sectionTitle: { fontFamily: 'Fredoka_700Bold', fontSize: 17, color: '#0A1C30', paddingHorizontal: 16, marginBottom: 8 },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  memberRowDark: { backgroundColor: '#1A2E3E' },
  memberInfo: { flex: 1 },
  memberName: { fontFamily: 'Fredoka_600SemiBold', fontSize: 15, color: '#0A1C30', marginBottom: 2 },
  memberMeta: { fontFamily: 'Fredoka_400Regular', fontSize: 12, color: '#5A7090' },
  memberActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#E8F0F8', alignItems: 'center', justifyContent: 'center' },
  actionBtnDark: { backgroundColor: 'rgba(255,255,255,0.1)' },
  actionBtnText: { fontSize: 16, color: '#2E6EC9' },
  kickBtn: { backgroundColor: '#FCE8E8' },
  kickBtnText: { fontSize: 14, color: '#C03030' },
});
