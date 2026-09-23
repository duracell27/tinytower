import React, { useEffect } from 'react';
import {
  View, Modal, Pressable, StyleSheet, Dimensions, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import LocaleText from './LocaleText';
import { useAppTheme } from '../hooks/useAppTheme';
import { useCityNotifStore } from '../stores/cityNotifStore';
import { getUserIcon } from '../utils/userIcon';

const NOTIF_ICON = require('../../assets/img/city/cityNotice.png');
const { width: SCREEN_W } = Dimensions.get('window');

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const dd  = String(d.getDate()).padStart(2, '0');
  const mm  = String(d.getMonth() + 1).padStart(2, '0');
  const yy  = String(d.getFullYear()).slice(-2);
  const hh  = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yy} ${hh}:${min}`;
}

export default function CityNotifPopup() {
  const { t } = useTranslation('tabs');
  const theme = useAppTheme();
  const router = useRouter();
  const pending   = useCityNotifStore((s) => s.pending);
  const dismissed = useCityNotifStore((s) => s.dismissed);
  const dismiss   = useCityNotifStore((s) => s.dismiss);
  const acknowledge = useCityNotifStore((s) => s.acknowledge);

  const visible = !!pending && !dismissed;

  const scale = useSharedValue(0.85);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 14, stiffness: 160 });
    } else {
      scale.value = 0.85;
    }
  }, [visible]);

  if (!pending) return null;

  const styles = getStyles(theme);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <Pressable style={styles.backdrop} onPress={dismiss}>
        <Animated.View style={[styles.card, animStyle]}>
          {/* stop backdrop tap from closing */}
          <Pressable onPress={() => {}}>
            {/* Header */}
            <View style={styles.header}>
              <Image source={NOTIF_ICON} style={styles.headerIcon} contentFit="contain" />
              <LocaleText style={[styles.headerTitle, { color: theme.text }]}>
                {t('city.notifications.popupTitle')}
              </LocaleText>
              <Pressable onPress={dismiss} style={styles.closeBtn} hitSlop={10}>
                <LocaleText style={[styles.closeX, { color: theme.textMuted }]}>✕</LocaleText>
              </Pressable>
            </View>

            {/* Text body */}
            <View style={[styles.textBox, { borderColor: theme.divider, backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : '#F7F9FB' }]}>
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 180 }}>
                <LocaleText style={[styles.bodyText, { color: theme.text }]}>
                  {pending.text}
                </LocaleText>
              </ScrollView>
            </View>

            {/* Author row — below text */}
            <Pressable
              style={styles.authorRow}
              onPress={pending.authorId ? () => router.push(`/user-profile/${pending.authorId}`) : undefined}
            >
              <Image
                source={getUserIcon(pending.authorLevel)}
                style={styles.authorAvatar}
                contentFit="cover"
              />
              <View style={styles.authorInfo}>
                <LocaleText style={[styles.authorName, { color: theme.isDark ? '#6BAED0' : '#2E6EC9' }]}>
                  {pending.authorName}
                </LocaleText>
                <LocaleText style={[styles.authorDate, { color: theme.textMuted }]}>
                  {t(`city.roles.${pending.authorRole}`)} · {fmtDate(pending.createdAt)}
                </LocaleText>
              </View>
            </Pressable>

            {/* Acknowledge button */}
            <Pressable
              onPress={() => acknowledge(pending.cityId, pending.id)}
              style={({ pressed }) => [styles.ackBtn, pressed && { opacity: 0.85 }]}
            >
              <LinearGradient
                colors={['#2E9E52', '#237A40']}
                style={styles.ackGradient}
              >
                <LocaleText style={styles.ackText}>{t('city.notifications.acknowledge')}</LocaleText>
              </LinearGradient>
            </Pressable>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function getStyles(theme: ReturnType<typeof useAppTheme>) {
  const { isDark } = theme;
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    card: {
      width: Math.min(SCREEN_W - 48, 340),
      borderRadius: 20,
      backgroundColor: isDark ? '#1A2E3E' : '#FFFFFF',
      padding: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
      gap: 8,
    },
    headerIcon: { width: 28, height: 28 },
    headerTitle: {
      flex: 1,
      fontFamily: 'Fredoka_700Bold',
      fontSize: 18,
    },
    closeBtn: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeX: {
      fontFamily: 'Fredoka_600SemiBold',
      fontSize: 16,
    },
    authorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 10,
      marginBottom: 14,
    },
    authorAvatar: {
      width: 24,
      height: 24,
      borderRadius: 12,
    },
    authorInfo: { gap: 1 },
    authorName: {
      fontFamily: 'Fredoka_600SemiBold',
      fontSize: 14,
      textDecorationLine: 'underline',
    },
    authorDate: {
      fontFamily: 'Fredoka_400Regular',
      fontSize: 12,
    },
    textBox: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
    },
    bodyText: {
      fontFamily: 'Fredoka_600SemiBold',
      fontSize: 15,
      lineHeight: 22,
    },
    ackBtn: {
      borderRadius: 14,
      overflow: 'hidden',
    },
    ackGradient: {
      paddingVertical: 13,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
    },
    ackText: {
      fontFamily: 'Fredoka_700Bold',
      fontSize: 17,
      color: '#fff',
      letterSpacing: 0.3,
    },
  });
}
