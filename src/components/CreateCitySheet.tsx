import React, { useState, useCallback, useEffect } from 'react';
import {
  View, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, Alert, Modal, Dimensions, Pressable, useColorScheme,
} from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS, Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import LocaleText from './LocaleText';
import { useCityStore } from '../stores/cityStore';
import { useGameStore } from '../stores/gameStore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT - 56;
const DISMISS_THRESHOLD = 100;
const SHEET_TIMING = { duration: 400, easing: Easing.bezier(0.4, 0, 0.2, 1) };
const SCRIM_TIMING = { duration: 380, easing: Easing.linear };

const IMG = {
  cityBuildings: require('../../assets/img/city/cityBuildings.png'),
  diamond:       require('../../assets/img/diamond.png'),
  notice:        require('../../assets/img/city/cityNotice.png'),
  chat:          require('../../assets/img/city/cityChat.png'),
  advertising:   require('../../assets/img/city/cityBuildingAdvertisingagency.png'),
  marketing:     require('../../assets/img/MarketingIcon.png'),
  autopark:      require('../../assets/img/city/cityBuildingAutopark.png'),
  bank:          require('../../assets/img/city/cityBuildingCityBank.png'),
  school:        require('../../assets/img/city/cityBuildingSchoolofBusiness.png'),
  academy:       require('../../assets/img/city/cityBuildingStateAcademy.png'),
};

const CITY_BUILDINGS = [
  IMG.autopark, IMG.advertising, IMG.bank, IMG.school, IMG.academy,
];

const PERKS = [
  { img: IMG.notice,       key: 'perk1' },
  { img: IMG.marketing,    key: 'perk2' },
  { img: IMG.advertising,  key: 'perk3' },
  { img: IMG.chat,         key: 'perk4' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function CreateCitySheet({ visible, onClose }: Props) {
  const { t } = useTranslation('tabs');
  const isDark = useColorScheme() === 'dark';
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { createCity } = useCityStore();
  const gems = useGameStore((s) => s.gems);

  const scrimOpacity = useSharedValue(0);
  const translateY = useSharedValue(SHEET_HEIGHT);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, SHEET_TIMING);
      scrimOpacity.value = withTiming(1, SCRIM_TIMING);
    } else {
      translateY.value = withTiming(SHEET_HEIGHT, SHEET_TIMING);
      scrimOpacity.value = withTiming(0, SCRIM_TIMING);
    }
  }, [visible]);

  const handleAnimatedClose = useCallback(() => {
    translateY.value = withTiming(SHEET_HEIGHT, { duration: 300 }, () => {
      'worklet';
      runOnJS(onClose)();
    });
    scrimOpacity.value = withTiming(0, { duration: 300 });
  }, [onClose]);

  const panGesture = Gesture.Pan()
    .enabled(visible)
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
        scrimOpacity.value = 1 - e.translationY / SHEET_HEIGHT;
      }
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_THRESHOLD || e.velocityY > 500) {
        translateY.value = withTiming(SHEET_HEIGHT, { duration: 300 }, () => {
          'worklet';
          runOnJS(onClose)();
        });
        scrimOpacity.value = withTiming(0, { duration: 300 });
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
        scrimOpacity.value = withTiming(1, { duration: 200 });
      }
    });

  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrimOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) { Alert.alert('', t('city.create.errorNoName')); return; }
    if (trimmed.length > 30) { Alert.alert('', t('city.create.errorNameTooLong')); return; }
    if (gems < 1000) { Alert.alert('', t('city.create.errorNotEnoughGems')); return; }
    setSubmitting(true);
    try {
      await createCity(trimmed);
      handleAnimatedClose();
    } catch (e: any) {
      const msg = e?.message ?? '';
      if (msg.includes('floors')) Alert.alert('', t('city.create.errorNotEnoughFloors'));
      else if (msg.includes('name')) Alert.alert('', t('city.create.errorNameTaken'));
      else Alert.alert('', t('city.errors.create'));
    } finally {
      setSubmitting(false);
    }
  };

  const headerBg = isDark ? '#A87EDE' : '#9A6FD0';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleAnimatedClose}>
      {visible && (
        <GestureHandlerRootView style={styles.overlay}>
          {/* Scrim */}
          <Animated.View style={[styles.scrim, scrimStyle]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={handleAnimatedClose} />
          </Animated.View>

          {/* Sheet */}
          <Animated.View style={[styles.sheet, sheetStyle, isDark && styles.sheetDark]}>
            {/* Drag handle area */}
            <GestureDetector gesture={panGesture}>
              <Animated.View style={[styles.header, { backgroundColor: headerBg }]}>
                <View style={styles.handleRow}>
                  <View style={styles.handle} />
                </View>
                <View style={styles.titleRow}>
                  <LocaleText style={styles.titleText}>{t('city.create.title')}</LocaleText>
                  <TouchableOpacity onPress={handleAnimatedClose} hitSlop={12} style={styles.closeBtn}>
                    <LocaleText style={styles.closeBtnText}>✕</LocaleText>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </GestureDetector>

            {/* Content */}
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                <View style={styles.iconRow}>
                  <Image source={IMG.cityBuildings} style={styles.heroImg} contentFit="contain" />
                </View>

                <View style={styles.buildingsRow}>
                  {CITY_BUILDINGS.map((src, i) => (
                    <View key={i} style={[styles.buildingWrap, isDark && { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                      <Image source={src} style={styles.buildingIcon} contentFit="contain" />
                    </View>
                  ))}
                </View>

                <View style={[styles.costCard, { backgroundColor: isDark ? '#F0B030' : '#E7A52B' }]}>
                  <LocaleText style={styles.costText}>{t('city.create.costLabel')}</LocaleText>
                  <LocaleText style={styles.costAmount}>1 000</LocaleText>
                  <Image source={IMG.diamond} style={styles.gemIcon} contentFit="contain" />
                </View>

                <TextInput
                  style={[styles.input, isDark && styles.inputDark]}
                  placeholder={t('city.create.namePlaceholder')}
                  placeholderTextColor={isDark ? '#667080' : '#A0AEB8'}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={handleCreate}
                />

                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: headerBg }, submitting && styles.btnDisabled]}
                  onPress={handleCreate}
                  disabled={submitting}
                  activeOpacity={0.8}
                >
                  <LocaleText style={styles.btnText}>
                    {submitting ? '...' : t('city.create.submit')}
                  </LocaleText>
                </TouchableOpacity>

                <View style={styles.perksSection}>
                  <LocaleText style={[styles.perksTitle, isDark && { color: '#B0C0B0' }]}>
                    {t('city.create.perksTitle')}
                  </LocaleText>
                  {PERKS.map((p) => (
                    <View key={p.key} style={[styles.perkRow, isDark && { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
                      <Image source={p.img} style={styles.perkImg} contentFit="contain" />
                      <LocaleText style={[styles.perkText, isDark && { color: '#C0D0C0' }]}>
                        {t(`city.create.${p.key}`)}
                      </LocaleText>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </Animated.View>
        </GestureHandlerRootView>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    height: SHEET_HEIGHT,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: '#F0F8FF',
    overflow: 'hidden',
  },
  sheetDark: { backgroundColor: '#0D1F2D' },

  // Header
  header: { paddingBottom: 14 },
  handleRow: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.5)' },
  titleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  titleText: { fontFamily: 'Fredoka_700Bold', fontSize: 18, color: '#FFFFFF', flex: 1, textAlign: 'center' },
  closeBtn: { position: 'absolute', right: 16 },
  closeBtnText: { fontFamily: 'Fredoka_700Bold', fontSize: 18, color: 'rgba(255,255,255,0.85)' },

  // Content
  scroll: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  iconRow: { alignItems: 'center', marginBottom: 12 },
  heroImg: { width: 100, height: 100 },
  buildingsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, gap: 8 },
  buildingWrap: { flex: 1, aspectRatio: 1, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center', padding: 6 },
  buildingIcon: { width: '100%', height: '100%' },
  costCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 12, borderWidth: 1.5, borderColor: 'transparent' },
  costText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 14, color: 'rgba(255,255,255,0.85)', flex: 1 },
  costAmount: { fontFamily: 'Fredoka_700Bold', fontSize: 17, color: '#FFFFFF', marginRight: 5 },
  gemIcon: { width: 22, height: 22 },
  input: {
    backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1.5, borderColor: '#B0C8D8',
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 17, fontFamily: 'Fredoka_500Medium',
    color: '#0A1C30', marginBottom: 12,
  },
  inputDark: { backgroundColor: '#1A2E3E', borderColor: '#2A4A60', color: '#DDE8D8' },
  btn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 4 },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontFamily: 'Fredoka_700Bold', fontSize: 18, color: '#FFFFFF' },
  perksSection: { marginTop: 24 },
  perksTitle: { fontFamily: 'Fredoka_600SemiBold', fontSize: 14, color: '#7A8A80', textAlign: 'center', marginBottom: 12, letterSpacing: 0.3 },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 8 },
  perkImg: { width: 32, height: 32 },
  perkText: { fontFamily: 'Fredoka_500Medium', fontSize: 14, color: '#3A4A38', flex: 1 },
});
