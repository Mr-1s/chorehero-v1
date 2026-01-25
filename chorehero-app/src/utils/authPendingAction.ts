import AsyncStorage from '@react-native-async-storage/async-storage';

export type PendingAuthAction = {
  type: 'LIKE' | 'SAVE' | 'FOLLOW' | 'BOOK' | 'MESSAGE';
  providerId: string;
};

type PostAuthRoute = { name: string; params?: Record<string, any> };

const ACTION_KEY = 'pending_auth_action';
const ROUTE_KEY = 'post_auth_route';

export const setPendingAuthAction = async (action: PendingAuthAction) => {
  await AsyncStorage.setItem(ACTION_KEY, JSON.stringify(action));
};

export const consumePendingAuthAction = async (): Promise<PendingAuthAction | null> => {
  const raw = await AsyncStorage.getItem(ACTION_KEY);
  if (!raw) return null;
  await AsyncStorage.removeItem(ACTION_KEY);
  try {
    return JSON.parse(raw) as PendingAuthAction;
  } catch {
    return null;
  }
};

export const setPostAuthRoute = async (route: PostAuthRoute) => {
  await AsyncStorage.setItem(ROUTE_KEY, JSON.stringify(route));
};

export const consumePostAuthRoute = async (): Promise<PostAuthRoute | null> => {
  const raw = await AsyncStorage.getItem(ROUTE_KEY);
  if (!raw) return null;
  await AsyncStorage.removeItem(ROUTE_KEY);
  try {
    return JSON.parse(raw) as PostAuthRoute;
  } catch {
    return null;
  }
};

export const applyPendingActionToInteractions = async (
  userId: string,
  action: PendingAuthAction
) => {
  if (!['LIKE', 'SAVE', 'FOLLOW'].includes(action.type)) return;
  const key = `feed_interactions_${userId}`;
  const raw = await AsyncStorage.getItem(key);
  const parsed = raw ? JSON.parse(raw) : { saved: [], followed: [], liked: [] };
  const add = (list: string[]) => Array.from(new Set([...list, action.providerId]));

  if (action.type === 'LIKE') parsed.liked = add(parsed.liked || []);
  if (action.type === 'SAVE') parsed.saved = add(parsed.saved || []);
  if (action.type === 'FOLLOW') parsed.followed = add(parsed.followed || []);

  await AsyncStorage.setItem(key, JSON.stringify(parsed));
};
