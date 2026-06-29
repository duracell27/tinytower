import { NativeTabs } from 'expo-router/unstable-native-tabs';

export default function TabsLayout() {
  return (
    <NativeTabs tintColor="#3FA535">
      <NativeTabs.Trigger name="game">
        <NativeTabs.Trigger.Icon sf="building.columns.fill" />
        <NativeTabs.Trigger.Label>Вежа</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="city">
        <NativeTabs.Trigger.Icon sf="map.fill" />
        <NativeTabs.Trigger.Label>Місто</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="shop">
        <NativeTabs.Trigger.Icon sf="bag.fill" />
        <NativeTabs.Trigger.Label>Магазин</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon sf="person.fill" />
        <NativeTabs.Trigger.Label>Профіль</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
