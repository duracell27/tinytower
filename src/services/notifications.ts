import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { api } from './api';
import i18next from 'i18next';

const LOBBY_FULL_NOTIF_ID = 'lobby-full';

export async function scheduleLobbyFullNotification(fillAt: number): Promise<void> {
  const secondsUntilFull = Math.ceil((fillAt - Date.now()) / 1000);
  if (secondsUntilFull <= 10) return;

  await Notifications.cancelScheduledNotificationAsync(LOBBY_FULL_NOTIF_ID).catch(() => {});

  const isUk = i18next.language === 'uk';

  await Notifications.scheduleNotificationAsync({
    identifier: LOBBY_FULL_NOTIF_ID,
    content: {
      title: isUk ? '🏢 Лоббі повне!' : '🏢 Lobby is full!',
      body: isUk
        ? 'Всі пасажири готові — час розвезти їх по поверхах!'
        : 'All passengers are waiting — time to give some rides!',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: secondsUntilFull,
    },
  });
}

export async function cancelLobbyFullNotification(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(LOBBY_FULL_NOTIF_ID).catch(() => {});
}

export async function registerPushNotifications(): Promise<void> {
  if (!Device.isDevice) {
    return;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return;
  }

  // projectId must be set in app.json extra.eas.projectId for production builds
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const token = (await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  )).data;
  const platform = Platform.OS;

  try {
    await api.post('/notifications/token', { token, platform });
  } catch (error) {
    console.error('[notifications] Failed to register push token:', error);
  }
}
