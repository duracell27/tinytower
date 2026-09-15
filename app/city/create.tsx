import React, { useState } from 'react';
import {
  View, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, Alert, useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import LocaleText from '../../src/components/LocaleText';
import AppBackground from '../../src/components/AppBackground';
import { useCityStore } from '../../src/stores/cityStore';
import { useGameStore } from '../../src/stores/gameStore';

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

  return (
    <AppBackground style={[styles.background, isDark && styles.backgroundDark]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.iconRow}>
            <LocaleText style={styles.icon}>🏛️</LocaleText>
          </View>

          <LocaleText style={[styles.title, isDark && { color: '#DDE8D8' }]}>{t('city.create.title')}</LocaleText>

          <View style={[styles.costCard, isDark && { backgroundColor: 'rgba(100,75,15,0.3)' }]}>
            <LocaleText style={[styles.costText, isDark && { color: '#F0D080' }]}>{t('city.create.cost')}</LocaleText>
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
        </ScrollView>
      </KeyboardAvoidingView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#F0F8FF' },
  backgroundDark: { backgroundColor: '#0D1F2D' },
  scroll: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },
  iconRow: { alignItems: 'center', marginBottom: 16 },
  icon: { fontSize: 72 },
  title: { fontFamily: 'Fredoka_700Bold', fontSize: 24, color: '#0A1C30', textAlign: 'center', marginBottom: 16 },
  costCard: { backgroundColor: '#FFF3CD', borderRadius: 12, padding: 14, marginBottom: 20, alignItems: 'center' },
  costText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 16, color: '#7A5A10' },
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
  btn: { backgroundColor: '#2E6EC9', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontFamily: 'Fredoka_700Bold', fontSize: 18, color: '#FFFFFF' },
});
