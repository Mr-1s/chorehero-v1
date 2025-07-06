import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthProvider } from './hooks/useAuth';
import { StatusBar } from 'expo-status-bar';

// Import screens
import AuthScreen from './screens/auth/AuthScreen';
import CustomerDashboard from './screens/customer/DashboardScreen';
import CleanerDashboard from './screens/cleaner/DashboardScreen';
import { useAuth } from './hooks/useAuth';

const Stack = createStackNavigator();

const AppNavigator = () => {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) {
    return null; // Or a loading screen
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthScreen} />
        ) : user?.role === 'customer' ? (
          <Stack.Screen name="CustomerDashboard" component={CustomerDashboard} />
        ) : (
          <Stack.Screen name="CleanerDashboard" component={CleanerDashboard} />
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