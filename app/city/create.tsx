import React, { useState } from 'react';
import {
  View, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, Alert, useColorScheme,
} from 'react-native';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import LocaleText from '../../src/components/LocaleText';
import AppBackground from '../../src/components/AppBackground';
import { useCityStore } from '../../src/stores/cityStore';
import { useGameStore } from '../../src/stores/gameStore';

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
  IMG.advertising,
  IMG.autopark,
  IMG.bank,
  IMG.school,
  IMG.academy,
] as const;

export default function CreateCityScreen() {
  const { t } = useTranslation('tabs');
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { createCity } = useCityStore();
  const gems = useGameStore((s) => s.gems);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('', t('city.create.errorNoName'));
      return;
    }
    if (trimmed.length > 30) {
      Alert.alert('', t('city.create.errorNameTooLong'));
      return;
    }
    if (gems < 1000) {
      Alert.alert('', t('city.create.errorNotEnoughGems'));
      return;
    }

    setSubmitting(true);
    try {
      await createCity(trimmed);
      router.back();
    } catch (e: any) {
      const msg = e?.message ?? '';
      if (msg.includes('floors')) {
        Alert.alert('', t('city.create.errorNotEnoughFloors'));
      } else if (msg.includes('name')) {
        Alert.alert('', t('city.create.errorNameTaken'));
      } else {
        Alert.alert('', t('city.errors.create'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const perks = [
    { img: IMG.notice,       key: 'perk1' },
    { img: IMG.marketing,    key: 'perk2' },
    { img: IMG.advertising,  key: 'perk3' },
    { img: IMG.chat,         key: 'perk4' },
  ];

  const headerBg = isDark ? '#A87EDE' : '#9A6FD0';

  return (
    <AppBackground style={[styles.background, isDark && styles.backgroundDark]}>
      <Stack.Screen options={{
        title: '',
        headerTitle: () => (
          <LocaleText style={styles.headerTitle}>{t('city.create.title')}</LocaleText>
        ),
        headerRight: () => (
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
            <LocaleText style={styles.headerClose}>✕</LocaleText>
          </TouchableOpacity>
        ),
        headerStyle: { backgroundColor: headerBg } as any,
        headerTintColor: '#FFFFFF',
        headerShadowVisible: false,
      }} />
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
            <View style={styles.costAmountRow}>
              <LocaleText style={styles.costAmount}>1 000</LocaleText>
              <Image source={IMG.diamond} style={styles.gemIcon} contentFit="contain" />
            </View>
          </View>

          <TextInput
            style={[styles.input, isDark && styles.inputDark]}
            placeholder={t('city.create.namePlaceholder')}
            placeholderTextColor={isDark ? '#667080' : '#A0AEB8'}
            value={name}
            onChangeText={setName}
            maxLength={30}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />

          <LocaleText style={[styles.charCount, isDark && { color: '#667080' }]}>
            {name.length} / 30
          </LocaleText>

          <TouchableOpacity
            style={[styles.btn, submitting && styles.btnDisabled]}
            onPress={handleCreate}
            disabled={submitting}
            activeOpacity={0.8}
          >
            <LocaleText style={styles.btnText}>
              {submitting ? '...' : t('city.create.submit')}
            </LocaleText>
          </TouchableOpacity>

          <View style={styles.perksSection}>
            <LocaleText style={[styles.perksTitle, isDark && { color: '#B0C0B0' }]}>{t('city.create.perksTitle')}</LocaleText>
            {perks.map((p) => (
              <View key={p.key} style={[styles.perkRow, isDark && { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                <Image source={p.img} style={styles.perkImg} contentFit="contain" />
                <LocaleText style={[styles.perkText, isDark && { color: '#C0D0C0' }]}>{t(`city.create.${p.key}`)}</LocaleText>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#F0F8FF' },
  backgroundDark: { backgroundColor: '#0D1F2D' },
  scroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },
  iconRow: { alignItems: 'center', marginBottom: 12 },
  headerTitle: { fontFamily: 'Fredoka_700Bold', fontSize: 18, color: '#FFFFFF' },
  headerClose: { fontFamily: 'Fredoka_700Bold', fontSize: 20, color: 'rgba(255,255,255,0.85)', lineHeight: 22 },
  heroImg: { width: 110, height: 110 },
  buildingsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 8 },
  buildingWrap: { flex: 1, aspectRatio: 1, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center', padding: 6 },
  buildingIcon: { width: '100%', height: '100%' },
  costCard: { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 20, alignItems: 'center', gap: 4 },
  costText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  costAmountRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  costAmount: { fontFamily: 'Fredoka_700Bold', fontSize: 22, color: '#FFFFFF' },
  gemIcon: { width: 22, height: 22 },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#B0C8D8',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    fontFamily: 'Fredoka_500Medium',
    color: '#0A1C30',
    marginBottom: 6,
  },
  inputDark: { backgroundColor: '#1A2E3E', borderColor: '#2A4A60', color: '#DDE8D8' },
  charCount: { fontFamily: 'Fredoka_400Regular', fontSize: 12, color: '#8A9AA8', textAlign: 'right', marginBottom: 20 },
  btn: { backgroundColor: '#9A6FD0', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontFamily: 'Fredoka_700Bold', fontSize: 18, color: '#FFFFFF' },
  perksSection: { marginTop: 28 },
  perksTitle: { fontFamily: 'Fredoka_600SemiBold', fontSize: 14, color: '#7A8A80', textAlign: 'center', marginBottom: 12, letterSpacing: 0.3 },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 8 },
  perkImg: { width: 32, height: 32 },
  perkText: { fontFamily: 'Fredoka_500Medium', fontSize: 14, color: '#3A4A38', flex: 1 },
});
