import AsyncStorage from '@react-native-async-storage/async-storage';

const GUEST_ID_KEY = 'guest_id';
const GUEST_SESSION_KEY = 'guest_session';
const GUEST_MODE_KEY = 'guest_mode';

export interface GuestSession {
  id: string;
  viewedVideos: string[];
  savedPros: string[];
  location: { zip?: string; city?: string; state?: string } | null;
  createdAt: number;
}

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

/** Create full guest session. Call when user enters guest mode. */
export const createGuestSession = async (): Promise<GuestSession> => {
  const id = await getOrCreateGuestId();
  const session: GuestSession = {
    id,
    viewedVideos: [],
    savedPros: [],
    location: null,
    createdAt: Date.now(),
  };
  await AsyncStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(session));
  return session;
};

/** Get current guest session or null. */
export const getGuestSession = async (): Promise<GuestSession | null> => {
  const raw = await AsyncStorage.getItem(GUEST_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GuestSession;
  } catch {
    return null;
  }
};

/** Update guest session with partial data. Merges viewedVideos/savedPros. */
export const updateGuestSession = async (
  updates: Partial<{
    viewedVideos: string[];
    savedPros: string[];
    location: { zip?: string; city?: string; state?: string } | null;
  }>
): Promise<GuestSession | null> => {
  const session = await getGuestSession();
  if (!session) return null;

  const next: GuestSession = {
    ...session,
    ...(updates.location !== undefined && { location: updates.location }),
    ...(updates.viewedVideos !== undefined && { viewedVideos: updates.viewedVideos }),
    ...(updates.savedPros !== undefined && { savedPros: updates.savedPros }),
  };

  await AsyncStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(next));
  return next;
};

/** Append a viewed video ID. */
export const appendViewedVideo = async (postId: string): Promise<GuestSession | null> => {
  const session = await getGuestSession();
  if (!session) return null;
  if (session.viewedVideos.includes(postId)) return session;
  return updateGuestSession({
    viewedVideos: [...session.viewedVideos, postId],
  });
};

/** Append a saved pro ID. */
export const appendSavedPro = async (providerId: string): Promise<GuestSession | null> => {
  const session = await getGuestSession();
  if (!session) return null;
  if (session.savedPros.includes(providerId)) return session;
  return updateGuestSession({
    savedPros: [...session.savedPros, providerId],
  });
};

/** Migrate guest data to authenticated user, then clear guest session. */
export const migrateGuestToUser = async (
  guestId: string,
  userId: string
): Promise<void> => {
  const session = await getGuestSession();
  await migrateGuestInteractions(guestId, userId);

  if (session?.location?.zip) {
    await AsyncStorage.multiSet([
      ['guest_zip', session.location.zip],
      ['guest_city', session.location.city || ''],
      ['guest_state', session.location.state || ''],
    ]);
  }

  await AsyncStorage.multiRemove([
    GUEST_SESSION_KEY,
    GUEST_MODE_KEY,
    GUEST_ID_KEY,
    `feed_interactions_${guestId}`,
  ]);
};

export const migrateGuestInteractions = async (
  guestId: string,
  userId: string
): Promise<void> => {
  const guestKey = `feed_interactions_${guestId}`;
  const userKey = `feed_interactions_${userId}`;
  const guestData = await AsyncStorage.getItem(guestKey);
  if (!guestData) return;
  const userData = await AsyncStorage.getItem(userKey);
  if (!userData) {
    await AsyncStorage.setItem(userKey, guestData);
  }
};

/** Check if user is in guest mode (browsing without auth). */
export const isGuestMode = async (): Promise<boolean> => {
  const val = await AsyncStorage.getItem(GUEST_MODE_KEY);
  return val === 'true';
};

/** Set guest mode flag. */
export const setGuestMode = async (enabled: boolean): Promise<void> => {
  if (enabled) {
    await AsyncStorage.setItem(GUEST_MODE_KEY, 'true');
  } else {
    await AsyncStorage.removeItem(GUEST_MODE_KEY);
  }
};
