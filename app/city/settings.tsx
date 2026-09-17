import React, { useState, useEffect, useRef } from 'react';
import {
  View, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, Modal, useColorScheme, Animated, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import LocaleText from '../../src/components/LocaleText';
import AppBackground from '../../src/components/AppBackground';
import { useCityStore } from '../../src/stores/cityStore';
import { useGameStore } from '../../src/stores/gameStore';

const CITY_ICON    = require('../../assets/img/city/cityBuildings.png');
const EDIT_ICON    = require('../../assets/img/edit.png');
const DELETE_ICON  = require('../../assets/img/delete.png');
const GEM_ICON     = require('../../assets/img/diamond.png');
const INFO_ICON    = require('../../assets/img/InformationIcon.png');

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
  const showCityAlert = useGameStore((s) => s.showCityAlert);
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (deleteModalVisible) {
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.7);
      opacityAnim.setValue(0);
    }
  }, [deleteModalVisible]);

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
        if (!name.trim()) { showCityAlert({ message: t('city.create.errorNoName') }); return; }
        if (name.trim().length > 30) { showCityAlert({ message: t('city.create.errorNameTooLong') }); return; }
        updates.name = name.trim();
      }
      if (description !== (city?.description ?? '')) {
        updates.description = description;
      }
      if (Object.keys(updates).length > 0) {
        await updateCity(cityId, updates);
      }
      showCityAlert({ message: t('city.settings.saveSuccess'), type: 'success' });
      router.back();
    } catch (e: any) {
      const msg = e?.message ?? '';
      if (msg.includes('500') || msg.includes('gems') || msg.includes('coins')) {
        showCityAlert({ message: t('city.settings.renameInfo'), type: 'info' });
      } else if (msg.includes('name')) {
        showCityAlert({ message: t('city.create.errorNameTaken') });
      } else {
        showCityAlert({ message: t('city.errors.create') });
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
      showCityAlert({ message: t('city.settings.deleteSuccess'), type: 'success' });
      router.replace('/(tabs)/city');
    } catch {
      showCityAlert({ message: t('city.settings.deleteError') });
    } finally {
      setDeleting(false);
    }
  };

  const nameMatches = deleteConfirmName.trim() === (city?.name ?? '');

  return (
    <AppBackground style={[styles.background, isDark && styles.backgroundDark]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Header hero */}
          <View style={[styles.heroCard, isDark && styles.heroCardDark]}>
            <View style={[styles.heroIconCircle, { backgroundColor: isDark ? '#1A3A5C' : '#E8F4FF' }]}>
              <Image source={CITY_ICON} style={styles.heroIcon} contentFit="contain" />
            </View>
            <LocaleText style={[styles.heroTitle, isDark && { color: '#DDE8D8' }]}>
              {city?.name ?? ''}
            </LocaleText>
            <LocaleText style={[styles.heroSub, isDark && { color: '#8A9A80' }]}>
              {t('city.settings.title')}
            </LocaleText>
          </View>

          {/* Name section */}
          <View style={[styles.section, isDark && styles.sectionDark]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconBox, { backgroundColor: isDark ? '#1A3A5C' : '#E8F4FF' }]}>
                <Image source={EDIT_ICON} style={styles.sectionIcon} contentFit="contain" />
              </View>
              <LocaleText style={[styles.sectionTitle, isDark && { color: '#DDE8D8' }]}>
                {t('city.settings.nameLabel')}
              </LocaleText>
            </View>
            <TextInput
              style={[styles.input, isDark && styles.inputDark]}
              placeholder={t('city.settings.namePlaceholder')}
              placeholderTextColor={isDark ? '#667080' : '#A0AEB8'}
              value={name}
              onChangeText={setName}
              maxLength={30}
            />
            {/* Rename cost hint */}
            <View style={[styles.costHint, isDark && styles.costHintDark]}>
              <LocaleText style={[styles.costHintText, isDark && { color: '#8A9A80' }]}>
                {t('city.settings.renameInfo')}
              </LocaleText>
              <Image source={GEM_ICON} style={styles.costHintIcon} contentFit="contain" />
            </View>
          </View>

          {/* Description section */}
          <View style={[styles.section, isDark && styles.sectionDark]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconBox, { backgroundColor: isDark ? '#2A3A20' : '#EDF8E8' }]}>
                <Image source={INFO_ICON} style={styles.sectionIcon} contentFit="contain" />
              </View>
              <LocaleText style={[styles.sectionTitle, isDark && { color: '#DDE8D8' }]}>
                {t('city.settings.descriptionLabel')}
              </LocaleText>
            </View>
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
          </View>

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#3A80D8', '#2E6EC9']}
              style={styles.saveBtnGradient}
            >
              <LocaleText style={styles.saveBtnText}>
                {saving ? '...' : t('city.settings.save')}
              </LocaleText>
            </LinearGradient>
          </TouchableOpacity>

          {/* Danger Zone */}
          <View style={styles.dangerDivider} />
          <View style={[styles.dangerSection, isDark && styles.dangerSectionDark]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconBox, { backgroundColor: isDark ? '#3A1218' : '#FDECEA' }]}>
                <Image source={DELETE_ICON} style={styles.sectionIcon} contentFit="contain" />
              </View>
              <LocaleText style={[styles.dangerZoneLabel, isDark && { color: '#FF6B6B' }]}>
                {t('city.settings.deleteZone')}
              </LocaleText>
            </View>
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
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Delete confirmation modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="none"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <Animated.View style={[styles.modalOverlay, { opacity: opacityAnim }]}>
          <Animated.View
            style={[
              styles.modalCard,
              isDark && styles.modalCardDark,
              { transform: [{ scale: scaleAnim }] },
            ]}
          >
            {/* Icon */}
            <View style={[styles.deleteIconCircle, { backgroundColor: isDark ? '#3A1218' : '#FDECEA' }]}>
              <Image source={DELETE_ICON} style={styles.deleteIconImg} contentFit="contain" />
            </View>

            <LocaleText style={[styles.modalTitle, isDark && { color: '#FF6B6B' }]}>
              {t('city.settings.deleteModalTitle')}
            </LocaleText>

            <View style={[styles.warningBox, isDark && styles.warningBoxDark]}>
              <LocaleText style={[styles.warningText, isDark && { color: '#FF9898' }]}>
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

            {/* Delete button */}
            <TouchableOpacity
              style={[styles.deleteConfirmBtn, (!nameMatches || deleting) && styles.btnDisabled]}
              onPress={handleDeleteCity}
              disabled={!nameMatches || deleting}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#E54030', '#C42A20']}
                style={styles.deleteBtnGradient}
              >
                <LocaleText style={styles.deleteBtnText}>
                  {deleting ? '...' : t('city.settings.deleteConfirmBtn')}
                </LocaleText>
              </LinearGradient>
            </TouchableOpacity>

            {/* Cancel button */}
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
          </Animated.View>
        </Animated.View>
      </Modal>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#F0F8FF' },
  backgroundDark: { backgroundColor: '#0D1F2D' },
  scroll: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 48 },

  // Hero card
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: 'rgba(30,60,100,1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  heroCardDark: { backgroundColor: '#1A2E3E' },
  heroIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroIcon: { width: 44, height: 44 },
  heroTitle: { fontFamily: 'Fredoka_700Bold', fontSize: 22, color: '#0A1C30', marginBottom: 4, textAlign: 'center' },
  heroSub: { fontFamily: 'Fredoka_500Medium', fontSize: 14, color: '#5A7090' },

  // Section card
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: 'rgba(30,60,100,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionDark: { backgroundColor: '#1A2E3E' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  sectionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionIcon: { width: 22, height: 22 },
  sectionTitle: { fontFamily: 'Fredoka_600SemiBold', fontSize: 15, color: '#1A2C3A', flex: 1 },

  input: {
    backgroundColor: '#F4F8FC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#C8D8E8',
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 16,
    fontFamily: 'Geologica_500Medium',
    color: '#0A1C30',
  },
  inputDark: { backgroundColor: '#243040', borderColor: '#2A4A60', color: '#DDE8D8' },
  inputMatch: { borderColor: '#D93025' },
  textArea: { height: 100, textAlignVertical: 'top' },

  // Cost hint
  costHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F8FF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
  },
  costHintDark: { backgroundColor: 'rgba(46,110,201,0.1)' },
  costHintIcon: { width: 16, height: 16 },
  costHintText: { fontFamily: 'Fredoka_400Regular', fontSize: 13, color: '#5A7090', flex: 1 },

  // Save button
  saveBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 4, marginBottom: 4 },
  btnDisabled: { opacity: 0.4 },
  saveBtnGradient: { paddingVertical: 16, alignItems: 'center', borderRadius: 14 },
  saveBtnText: { fontFamily: 'Fredoka_700Bold', fontSize: 18, color: '#FFFFFF' },

  // Danger zone
  dangerDivider: { height: 1, backgroundColor: 'rgba(255,80,60,0.15)', marginTop: 20, marginBottom: 16 },
  dangerSection: {
    backgroundColor: '#FFF8F8',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,80,60,0.12)',
  },
  dangerSectionDark: { backgroundColor: '#1E1010', borderColor: 'rgba(255,80,60,0.2)' },
  dangerZoneLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
    color: '#D93025',
    flex: 1,
  },
  btnDelete: {
    backgroundColor: '#D93025',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  btnDeleteText: { fontFamily: 'Fredoka_700Bold', fontSize: 17, color: '#FFFFFF' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.58)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    shadowColor: 'rgba(30,50,80,1)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 30,
    elevation: 12,
  },
  modalCardDark: { backgroundColor: '#1A2E3E' },
  deleteIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  deleteIconImg: {
    width: 34,
    height: 34,
  },
  modalTitle: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 22,
    color: '#D93025',
    textAlign: 'center',
  },
  warningBox: {
    width: '100%',
    backgroundColor: '#FFF3F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFCDC9',
    padding: 14,
  },
  warningBoxDark: {
    backgroundColor: '#2A1010',
    borderColor: '#5A2020',
  },
  warningText: {
    fontFamily: 'Geologica_400Regular',
    fontSize: 13,
    color: '#9B2020',
    lineHeight: 20,
    textAlign: 'center',
  },
  confirmLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
    color: '#1A2C3A',
    textAlign: 'center',
  },
  confirmHint: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 12,
    color: '#8A9AA8',
    textAlign: 'center',
  },
  confirmInput: { width: '100%', marginTop: 0 },
  deleteConfirmBtn: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 4,
  },
  deleteBtnGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 14,
  },
  deleteBtnText: { fontFamily: 'Fredoka_700Bold', fontSize: 17, color: '#FFFFFF' },
  modalCancelBtn: {
    width: '100%',
    backgroundColor: '#EEF3F8',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCancelBtnDark: { backgroundColor: '#243040' },
  modalCancelText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 16, color: '#3A5068' },
});
