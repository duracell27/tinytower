import React, { useState, useEffect } from 'react';
import {
  View, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, Alert, useColorScheme,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import LocaleText from '../../src/components/LocaleText';
import AppBackground from '../../src/components/AppBackground';
import { useCityStore } from '../../src/stores/cityStore';

export default function CitySettingsScreen() {
  const { t } = useTranslation('tabs');
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const { cityId } = useLocalSearchParams<{ cityId: string }>();
  const { city, updateCity } = useCityStore();

  const [name, setName] = useState(city?.name ?? '');
  const [description, setDescription] = useState(city?.description ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (city) {
      setName(city.name);
      setDescription(city.description ?? '');
    }
  }, [city]);

  const handleSave = async () => {
    if (!cityId) return;
    setSaving(true);
    try {
      const updates: { name?: string; description?: string } = {};
      if (name.trim() !== city?.name) {
        if (!name.trim()) { Alert.alert('', t('city.create.errorNoName')); return; }
        if (name.trim().length > 30) { Alert.alert('', t('city.create.errorNameTooLong')); return; }
        updates.name = name.trim();
      }
      if (description !== (city?.description ?? '')) {
        updates.description = description;
      }
      if (Object.keys(updates).length > 0) {
        await updateCity(cityId, updates);
      }
      Alert.alert('', t('city.settings.saveSuccess'));
      router.back();
    } catch (e: any) {
      const msg = e?.message ?? '';
      if (msg.includes('500') || msg.includes('coins')) {
        Alert.alert('', t('city.settings.renameInfo'));
      } else if (msg.includes('name')) {
        Alert.alert('', t('city.create.errorNameTaken'));
      } else {
        Alert.alert('', t('city.errors.create'));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppBackground style={[styles.background, isDark && styles.backgroundDark]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <LocaleText style={[styles.label, isDark && { color: '#DDE8D8' }]}>{t('city.settings.nameLabel')}</LocaleText>
          <TextInput
            style={[styles.input, isDark && styles.inputDark]}
            placeholder={t('city.settings.namePlaceholder')}
            placeholderTextColor={isDark ? '#667080' : '#A0AEB8'}
            value={name}
            onChangeText={setName}
            maxLength={30}
          />
          <LocaleText style={[styles.hint, isDark && { color: '#8A9A80' }]}>{t('city.settings.renameInfo')}</LocaleText>

          <LocaleText style={[styles.label, isDark && { color: '#DDE8D8' }]}>{t('city.settings.descriptionLabel')}</LocaleText>
          <TextInput
            style={[styles.input, styles.textArea, isDark && styles.inputDark]}
            placeholder={t('city.settings.descriptionPlaceholder')}
            placeholderTextColor={isDark ? '#667080' : '#A0AEB8'}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={500}
            numberOfLines={4}
          />

          <TouchableOpacity
            style={[styles.btn, saving && styles.btnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            <LocaleText style={styles.btnText}>
              {saving ? '...' : t('city.settings.save')}
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
  scroll: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40 },
  label: { fontFamily: 'Fredoka_600SemiBold', fontSize: 15, color: '#1A2C3A', marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#B0C8D8',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Geologica_500Medium',
    color: '#0A1C30',
  },
  inputDark: { backgroundColor: '#1A2E3E', borderColor: '#2A4A60', color: '#DDE8D8' },
  textArea: { height: 100, textAlignVertical: 'top' },
  hint: { fontFamily: 'Fredoka_400Regular', fontSize: 12, color: '#8A9AA8', marginTop: 4, marginBottom: 4 },
  btn: { backgroundColor: '#2E6EC9', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontFamily: 'Fredoka_700Bold', fontSize: 18, color: '#FFFFFF' },
});
