import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { SwipeScreen } from './screens/SwipeScreen';
import { VideoPlayerScreen } from './screens/VideoPlayerScreen';
import { BookingScreen } from './screens/BookingScreen';
import ConfirmationScreen from './screens/ConfirmationScreen';
import ProfileScreen from './screens/ProfileScreen';
import { Cleaner } from '../shared/types';

const Stack = createStackNavigator();

export default function TrustFirstApp() {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyleInterpolator: ({ current, layouts }) => {
            return {
              cardStyle: {
                transform: [
                  {
                    translateX: current.progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [layouts.screen.width, 0],
                    }),
                  },
                ],
              },
            };
          },
        }}
      >
        {!hasCompletedOnboarding ? (
          <Stack.Screen name="Onboarding">
            {(props) => (
              <OnboardingScreen
                {...props}
                onComplete={() => setHasCompletedOnboarding(true)}
              />
            )}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="Swipe">
              {(props) => (
                <SwipeScreen 
                  {...props}
                  onCleanerSelected={(cleaner) => props.navigation.navigate('VideoPlayer', { cleaner })}
                  onVideoPress={(cleaner) => props.navigation.navigate('VideoPlayer', { cleaner })}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="VideoPlayer" component={VideoPlayerScreen} />
            <Stack.Screen name="Booking" component={BookingScreen} />
            <Stack.Screen name="Confirmation" component={ConfirmationScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}