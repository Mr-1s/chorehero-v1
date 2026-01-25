import AsyncStorage from '@react-native-async-storage/async-storage';

const GUEST_ID_KEY = 'guest_id';

const generateGuestId = () =>
  `guest_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

export const getOrCreateGuestId = async (): Promise<string> => {
  const existing = await AsyncStorage.getItem(GUEST_ID_KEY);
  if (existing) return existing;
  const next = generateGuestId();
  await AsyncStorage.setItem(GUEST_ID_KEY, next);
  return next;
};

export const getGuestId = async (): Promise<string | null> => {
  return AsyncStorage.getItem(GUEST_ID_KEY);
};

export const migrateGuestInteractions = async (guestId: string, userId: string) => {
  const guestKey = `feed_interactions_${guestId}`;
  const userKey = `feed_interactions_${userId}`;
  const guestData = await AsyncStorage.getItem(guestKey);
  if (!guestData) return;
  const userData = await AsyncStorage.getItem(userKey);
  if (!userData) {
    await AsyncStorage.setItem(userKey, guestData);
  }
};
