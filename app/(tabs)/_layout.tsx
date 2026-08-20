import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';
import { useOnboardingStore } from '../../src/stores/onboardingStore';

const TAB_COLORS = {
  game:    '#5E8F42',
  city:    '#2E6EC9',
  menu:    '#E7A52B',
  shop:    '#9A6FD0',
  profile: '#E05050',
};

export default function TabsLayout() {
  const { t } = useTranslation('tabs');
  const isOnboarding = useOnboardingStore((s) => s.isActive);

  return (
    <NativeTabs
      blurEffect="systemChromeMaterial"
      disableTransparentOnScrollEdge={true}
    >
      <NativeTabs.Trigger name="game">
        <NativeTabs.Trigger.Icon sf="building.fill" selectedColor={TAB_COLORS.game} />
        <NativeTabs.Trigger.Label selectedStyle={{ color: TAB_COLORS.game }}>{t('labels.tower')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      {!isOnboarding && (
        <NativeTabs.Trigger name="city">
          <NativeTabs.Trigger.Icon sf="map.fill" selectedColor={TAB_COLORS.city} />
          <NativeTabs.Trigger.Label selectedStyle={{ color: TAB_COLORS.city }}>{t('labels.city')}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      )}

      {!isOnboarding && (
        <NativeTabs.Trigger name="menu">
          <NativeTabs.Trigger.Icon sf="square.grid.2x2.fill" selectedColor={TAB_COLORS.menu} />
          <NativeTabs.Trigger.Label selectedStyle={{ color: TAB_COLORS.menu }}>{t('labels.menu')}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      )}

      {!isOnboarding && (
        <NativeTabs.Trigger name="shop">
          <NativeTabs.Trigger.Icon sf="bag.fill" selectedColor={TAB_COLORS.shop} />
          <NativeTabs.Trigger.Label selectedStyle={{ color: TAB_COLORS.shop }}>{t('labels.shop')}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      )}

      {!isOnboarding && (
        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Icon sf="person.fill" selectedColor={TAB_COLORS.profile} />
          <NativeTabs.Trigger.Label selectedStyle={{ color: TAB_COLORS.profile }}>{t('labels.profile')}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      )}
    </NativeTabs>
  );
}
