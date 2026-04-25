// Test setup for ChoreHero app

// `react-native-get-random-values` is only needed in app runtime; it is not
// listed as a test dep and resolving it at jest startup blocks the suite from
// running. Try-load it without crashing when missing.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-get-random-values');
} catch {
  // optional
}

jest.mock('expo-video', () => ({
  VideoView: 'VideoView',
  VideoPlayer: jest.fn().mockImplementation(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    release: jest.fn(),
    loop: false,
    muted: false,
    volume: 1,
    playing: false,
    currentTime: 0,
    duration: 0,
  })),
}));

jest.mock('expo-blur', () => ({
  BlurView: 'BlurView',
}));

jest.mock('react-native-maps', () => ({
  MapView: 'MapView',
  Marker: 'Marker',
  Polyline: 'Polyline',
  Circle: 'Circle',
  PROVIDER_GOOGLE: 'google',
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('../src/services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          not: jest.fn(() => ({
            limit: jest.fn(() => ({
              data: [],
              error: null,
            })),
          })),
        })),
      })),
    })),
  },
}));

// `useHaptic`, `useLocation`, `useVideoFeed` were removed/renamed — using
// `virtual: true` keeps jest from failing when the module path no longer
// resolves (these mocks are still safe no-ops if anything imports them).
jest.mock(
  '../src/hooks/useHaptic',
  () => ({
    useHaptic: () => ({
      impact: jest.fn(),
      notification: jest.fn(),
      selection: jest.fn(),
    }),
  }),
  { virtual: true }
);

jest.mock(
  '../src/hooks/useLocation',
  () => ({
    useLocation: () => ({
      location: null,
      error: null,
      loading: false,
    }),
  }),
  { virtual: true }
);

jest.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    signIn: jest.fn(),
    signOut: jest.fn(),
    signUp: jest.fn(),
  }),
}));

jest.mock(
  '../src/hooks/useVideoFeed',
  () => ({
    useVideoFeed: () => ({
      videos: [],
      loading: false,
      error: null,
      refresh: jest.fn(),
    }),
  }),
  { virtual: true }
);

// Mock React Native modules
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.NativeModules.RNPermissions = {};
  return RN;
});

// Mock Expo modules
jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        supabaseUrl: 'test-url',
        supabaseAnonKey: 'test-key',
        stripePublishableKey: 'test-stripe-key',
      },
    },
  },
}));

jest.mock('expo-location', () => ({
  getCurrentPositionAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

jest.mock('expo-notifications', () => ({
  getNotificationPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
}));

jest.mock(
  'expo-secure-store',
  () => ({
    getItemAsync: jest.fn(),
    setItemAsync: jest.fn(),
    deleteItemAsync: jest.fn(),
  }),
  { virtual: true }
);

jest.mock('expo-status-bar', () => ({
  StatusBar: 'StatusBar',
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
  }),
}));

jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: 'Navigator',
    Screen: 'Screen',
  }),
}));

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: 'Navigator',
    Screen: 'Screen',
  }),
}));

// Silence warnings
global.console.warn = jest.fn();
global.console.error = jest.fn();

// Global test utilities
global.fetch = jest.fn();

// Mock timers
global.setInterval = jest.fn();
global.clearInterval = jest.fn();
global.setTimeout = jest.fn() as any;
global.clearTimeout = jest.fn();