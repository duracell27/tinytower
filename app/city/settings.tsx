import React, { useState, useEffect } from 'react';
import {
  View, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, Alert, Modal, useColorScheme,
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
  const { city, updateCity, deleteCity } = useCityStore();

  const [name, setName] = useState(city?.name ?? '');
  const [description, setDescription] = useState(city?.description ?? '');
  const [saving, setSaving] = useState(false);

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);

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

  const handleDeleteCity = async () => {
    if (!cityId || !city) return;
    if (deleteConfirmName.trim() !== city.name) return;
    setDeleting(true);
    try {
      await deleteCity(cityId);
      setDeleteModalVisible(false);
      Alert.alert('', t('city.settings.deleteSuccess'));
      router.replace('/(tabs)/city');
    } catch {
      Alert.alert('', t('city.settings.deleteError'));
    } finally {
      setDeleting(false);
    }
  };

  const nameMatches = deleteConfirmName.trim() === (city?.name ?? '');

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

          {/* Danger Zone */}
          <View style={styles.dangerDivider} />
          <LocaleText style={[styles.dangerZoneLabel, isDark && { color: '#FF6B6B' }]}>
            {t('city.settings.deleteZone')}
          </LocaleText>
          <TouchableOpacity
            style={styles.btnDelete}
            onPress={() => {
              setDeleteConfirmName('');
              setDeleteModalVisible(true);
            }}
            activeOpacity={0.8}
          >
            <LocaleText style={styles.btnDeleteText}>{t('city.settings.deleteBtn')}</LocaleText>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Delete confirmation modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isDark && styles.modalCardDark]}>
            <LocaleText style={[styles.modalTitle, isDark && { color: '#FF6B6B' }]}>
              {t('city.settings.deleteModalTitle')}
            </LocaleText>

            <View style={styles.warningBox}>
              <LocaleText style={styles.warningText}>
                {t('city.settings.deleteWarning')}
              </LocaleText>
            </View>

            <LocaleText style={[styles.confirmLabel, isDark && { color: '#DDE8D8' }]}>
              {t('city.settings.deleteConfirmLabel')}
            </LocaleText>
            <LocaleText style={[styles.confirmHint, isDark && { color: '#8A9A80' }]}>
              {t('city.settings.deleteConfirmHint', { name: city?.name ?? '' })}
            </LocaleText>
            <TextInput
              style={[styles.input, styles.confirmInput, isDark && styles.inputDark, nameMatches && styles.inputMatch]}
              placeholder={city?.name ?? ''}
              placeholderTextColor={isDark ? '#667080' : '#A0AEB8'}
              value={deleteConfirmName}
              onChangeText={setDeleteConfirmName}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, isDark && styles.modalCancelBtnDark]}
                onPress={() => setDeleteModalVisible(false)}
                disabled={deleting}
                activeOpacity={0.8}
              >
                <LocaleText style={[styles.modalCancelText, isDark && { color: '#DDE8D8' }]}>
                  {t('city.settings.cancel')}
                </LocaleText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalDeleteBtn, (!nameMatches || deleting) && styles.btnDisabled]}
                onPress={handleDeleteCity}
                disabled={!nameMatches || deleting}
                activeOpacity={0.8}
              >
                <LocaleText style={styles.btnDeleteText}>
                  {deleting ? '...' : t('city.settings.deleteConfirmBtn')}
                </LocaleText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  inputMatch: { borderColor: '#D93025' },
  textArea: { height: 100, textAlignVertical: 'top' },
  hint: { fontFamily: 'Fredoka_400Regular', fontSize: 12, color: '#8A9AA8', marginTop: 4, marginBottom: 4 },
  btn: { backgroundColor: '#2E6EC9', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontFamily: 'Fredoka_700Bold', fontSize: 18, color: '#FFFFFF' },
  // Danger zone
  dangerDivider: { height: 1, backgroundColor: '#FFD0CC', marginTop: 36, marginBottom: 16 },
  dangerZoneLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
    color: '#D93025',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  btnDelete: {
    backgroundColor: '#D93025',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnDeleteText: { fontFamily: 'Fredoka_700Bold', fontSize: 18, color: '#FFFFFF' },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
  },
  modalCardDark: { backgroundColor: '#1A2E3E' },
  modalTitle: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 22,
    color: '#D93025',
    marginBottom: 16,
    textAlign: 'center',
  },
  warningBox: {
    backgroundColor: '#FFF3F2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFCDC9',
    padding: 14,
    marginBottom: 20,
  },
  warningText: {
    fontFamily: 'Geologica_400Regular',
    fontSize: 13,
    color: '#9B2020',
    lineHeight: 20,
  },
  confirmLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
    color: '#1A2C3A',
    marginBottom: 4,
  },
  confirmHint: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 12,
    color: '#8A9AA8',
    marginBottom: 8,
  },
  confirmInput: { marginTop: 0 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#EEF3F8',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCancelBtnDark: { backgroundColor: '#243040' },
  modalCancelText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 16, color: '#3A5068' },
  modalDeleteBtn: {
    flex: 1,
    backgroundColor: '#D93025',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
});
