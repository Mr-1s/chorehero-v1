import * as Location from 'expo-location';
import { Alert, Linking } from 'react-native';

/**
 * Ensures device location services are on and foreground location is granted
 * before starting "heading to job" / customer-visible tracking.
 */
export async function ensureForegroundLocationForProTracking(): Promise<boolean> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    Alert.alert(
      'Location is turned off',
      'Turn on Location in your device settings so the customer can see you heading to the job.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => void Linking.openSettings() },
      ]
    );
    return false;
  }

  const { status: current } = await Location.getForegroundPermissionsAsync();
  if (current === 'granted') {
    return true;
  }

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status === 'granted') {
    return true;
  }

  Alert.alert(
    'Location access needed',
    'Allow ChoreHero to use your location while you are on the way so the customer can follow your trip in real time.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open Settings', onPress: () => void Linking.openSettings() },
    ]
  );
  return false;
}
