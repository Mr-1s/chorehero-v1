import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthProvider } from './hooks/useAuth';
import { StatusBar } from 'expo-status-bar';

// Import screens
import { AuthScreen } from './screens/shared/AuthScreen';
import CustomerDashboard from './screens/customer/DashboardScreen';
import { ProfileScreen } from './screens/cleaner/ProfileScreen';
import { useAuth } from './hooks/useAuth';

const Stack = createStackNavigator();

// Wrapper component for AuthScreen to provide required props
const AuthScreenWrapper = () => {
  const handleAuthSuccess = (authUser: any) => {
    console.log('Auth success:', authUser);
    // The auth state will be automatically updated by the AuthProvider
  };
  
  const handleAuthNeedsOnboarding = (userId: string, phone: string) => {
    console.log('Onboarding needed for user:', userId, phone);
  };
  
  return (
    <AuthScreen 
      onAuthSuccess={handleAuthSuccess}
      onAuthNeedsOnboarding={handleAuthNeedsOnboarding}
    />
  );
};

const AppNavigator = () => {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) {
    return null; // Or a loading screen
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthScreenWrapper} />
        ) : user?.role === 'customer' ? (
          <Stack.Screen name="CustomerDashboard" component={CustomerDashboard} />
        ) : (
          <Stack.Screen name="CleanerDashboard" component={ProfileScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default function MainApp() {
  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <AppNavigator />
    </AuthProvider>
  );
}