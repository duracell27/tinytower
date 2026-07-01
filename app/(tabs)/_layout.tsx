import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';

export default function TabsLayout() {
  const { t } = useTranslation('tabs');

  return (
    <NativeTabs tintColor="#3FA535">
      <NativeTabs.Trigger name="game">
        <NativeTabs.Trigger.Icon sf="building.columns.fill" />
        <NativeTabs.Trigger.Label>{t('labels.tower')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="city">
        <NativeTabs.Trigger.Icon sf="map.fill" />
        <NativeTabs.Trigger.Label>{t('labels.city')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="shop">
        <NativeTabs.Trigger.Icon sf="bag.fill" />
        <NativeTabs.Trigger.Label>{t('labels.shop')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon sf="person.fill" />
        <NativeTabs.Trigger.Label>{t('labels.profile')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
