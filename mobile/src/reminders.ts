import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { reminderPlan, I18N, type MobileState } from './core';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

let queue = Promise.resolve();

export async function requestReminderPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const result = await Notifications.requestPermissionsAsync();
  return result.granted;
}

export function syncReminders(state: MobileState): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  queue = queue.catch(() => {}).then(async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!state.notificationsOn) return;
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('lapis-reminders', {
        name: 'Lapis reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default'
      });
    }
    for (const event of reminderPlan(state)) {
      const water = event.kind === 'water';
      const title = water
        ? (state.lang === 'ms' ? 'Masa untuk minum air' : 'Time for water')
        : I18N.t(state.lang, 'toast.title');
      const body = water
        ? (state.lang === 'ms' ? 'Ambil segelas air dan catat di Lapis.' : 'Have a glass and log it in Lapis.')
        : (state.lang === 'ms' ? 'Bangun dan regangkan badan sekejap.' : 'Take a quick desk stretch.');
      await Notifications.scheduleNotificationAsync({
        content: { title, body, data: { lapis: true, kind: event.kind }, sound: 'default' },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(event.at),
          channelId: Platform.OS === 'android' ? 'lapis-reminders' : undefined
        }
      });
    }
  });
  return queue;
}
