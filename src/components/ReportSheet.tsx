import React, { useState } from 'react';
import { Alert, Modal, View, Text, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useReportStore, type ReportTargetType, type ReportCategory } from '../stores/reportStore';

interface Props {
  visible: boolean;
  targetType: ReportTargetType;
  targetId: string;
  onClose: () => void;
  onSuccess: () => void;
  onAlreadyReported: () => void;
}

const CATEGORIES: ReportCategory[] = ['SPAM', 'HARASSMENT', 'ADVERTISEMENT', 'PROFANITY', 'THREAT', 'ADULT_CONTENT', 'OTHER'];

export default function ReportSheet({ visible, targetType, targetId, onClose, onSuccess, onAlreadyReported }: Props) {
  const { t } = useTranslation('tabs');
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const [selected, setSelected] = useState<ReportCategory | null>(null);
  const { submitReport, isSubmitting } = useReportStore();

  const handleSubmit = async () => {
    if (!selected || isSubmitting) return;
    try {
      await submitReport(targetType, targetId, selected);
      setSelected(null);
      onClose();
      onSuccess();
    } catch (e: any) {
      onClose();
      if (e?.message?.includes('Already reported') || e?.message?.includes('already')) {
        onAlreadyReported();
      } else {
        Alert.alert(t('report.error'));
      }
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }, isDark && { backgroundColor: '#2A2F38' }]}
          onStartShouldSetResponder={() => true}
        >
          <Text style={[styles.title, isDark && { color: '#DDE8D8' }]}>{t('report.title')}</Text>
          {CATEGORIES.map(cat => (
            <Pressable key={cat} style={styles.option} onPress={() => setSelected(cat)}>
              <View style={[styles.radio, selected === cat && styles.radioSelected, isDark && { borderColor: '#5A6470' }]} />
              <Text style={[styles.optionText, isDark && { color: '#DDE8D8' }]}>
                {t(`report.category.${cat.toLowerCase()}`)}
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={[styles.submitBtn, (!selected || isSubmitting) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!selected || isSubmitting}
          >
            <Text style={styles.submitBtnText}>{t('report.submit')}</Text>
          </Pressable>
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={[styles.cancelBtnText, isDark && { color: '#8A9A80' }]}>{t('report.cancel')}</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 4,
  },
  title: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 17,
    color: '#2A3344',
    marginBottom: 12,
    textAlign: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ccc',
  },
  radioSelected: {
    borderColor: '#3C9A34',
    backgroundColor: '#3C9A34',
  },
  optionText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: '#2A3344',
  },
  submitBtn: {
    backgroundColor: '#3C9A34',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
    color: '#fff',
  },
  cancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: '#999',
  },
});
