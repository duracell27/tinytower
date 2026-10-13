import React from 'react';
import { View, Modal, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import LocaleText from './LocaleText';
import { useAppTheme } from '../hooks/useAppTheme';

interface Props {
  visible: boolean;
  provider: 'google' | 'apple';
  existingName: string;
  onKeepCurrent: () => void;
  onLoadExisting: () => void;
  onCancel: () => void;
}

export default function SocialConflictModal({ visible, provider, existingName, onKeepCurrent, onLoadExisting, onCancel }: Props) {
  const { t } = useTranslation('tabs');
  const theme = useAppTheme();

  const providerLabel = provider === 'google' ? 'Google' : 'Apple';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.isDark ? '#1A2E3E' : '#FFFFFF' }]}>
          <LocaleText style={[styles.title, { color: theme.text }]}>
            {t('profile.convert.socialConflict.title')}
          </LocaleText>
          <LocaleText style={[styles.body, { color: theme.isDark ? '#A0B8CC' : '#6B7C8D' }]}>
            {t('profile.convert.socialConflict.body', { provider: providerLabel, name: existingName })}
          </LocaleText>

          <Pressable
            onPress={onKeepCurrent}
            style={({ pressed }) => [styles.btn, styles.primaryBtn, { opacity: pressed ? 0.8 : 1 }]}
          >
            <LocaleText style={styles.primaryBtnText}>
              {t('profile.convert.socialConflict.keepCurrent')}
            </LocaleText>
          </Pressable>

          <Pressable
            onPress={onLoadExisting}
            style={({ pressed }) => [styles.btn, styles.secondaryBtn, {
              borderColor: theme.isDark ? '#3A5268' : '#CBD5E0',
              opacity: pressed ? 0.8 : 1,
            }]}
          >
            <LocaleText style={[styles.secondaryBtnText, { color: theme.text }]}>
              {t('profile.convert.socialConflict.loadExisting', { name: existingName })}
            </LocaleText>
          </Pressable>

          <Pressable
            onPress={onCancel}
            style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <LocaleText style={[styles.cancelText, { color: theme.isDark ? '#7A9AB5' : '#8899AA' }]}>
              {t('profile.convert.socialConflict.cancel')}
            </LocaleText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  btn: {
    width: '100%',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryBtn: {
    backgroundColor: '#2592AB',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryBtn: {
    borderWidth: 1.5,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '500',
  },
  cancelBtn: {
    marginTop: 4,
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: 14,
  },
});
