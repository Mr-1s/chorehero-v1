import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../utils/constants';
import { useAuth } from '../hooks/useAuth';

interface RoleIndicatorProps {
  isDevelopment?: boolean;
}

const RoleIndicator: React.FC<RoleIndicatorProps> = ({ isDevelopment = __DEV__ }) => {
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const { isCleaner, isCustomer, isAuthenticated } = useAuth();

  useEffect(() => {
    const checkRole = async () => {
      try {
        const role = await AsyncStorage.getItem('demo_user_role');
        setCurrentRole(role);
      } catch (error) {
        console.error('Error reading role:', error);
      }
    };

    checkRole();
    
    // Check role periodically
    const interval = setInterval(checkRole, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleSwitchAccount = async () => {
    try {
      if (!isAuthenticated) {
        Alert.alert('Error', 'No account to switch from');
        return;
      }

      if (isAuthenticated) {
        Alert.alert(
          'Switch Account Type',
          'Account type switching for authenticated users is not yet implemented. Please contact support.',
          [{ text: 'OK' }]
        );
        return;
      }

      // For demo users, switch demo role
      const currentRole = isCleaner ? 'cleaner' : 'customer';
      const newRole = currentRole === 'cleaner' ? 'customer' : 'cleaner';
      
      Alert.alert(
        'Switch Account Type',
        `Switch from ${currentRole} to ${newRole} mode?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: `Switch to ${newRole.charAt(0).toUpperCase() + newRole.slice(1)}`, 
            onPress: async () => {
              const cleanerType = newRole === 'cleaner' ? 'sarah' : undefined;
              // Demo system removed - contact support for account switching
              console.log(`Demo system removed - cannot switch to ${newRole} mode`);
            }
          }
        ]
      );
    } catch (error) {
      console.error('❌ Error switching account:', error);
      Alert.alert('Error', 'Failed to switch account. Please try again.');
    }
  };

  if (!isDevelopment || !currentRole) {
    return null;
  }

  const getRoleColor = () => {
    switch (currentRole) {
      case 'cleaner': return '#F59E0B';
      case 'customer': return '#3B82F6';
      default: return COLORS.text.secondary;
    }
  };

  const getRoleIcon = () => {
    switch (currentRole) {
      case 'cleaner': return 'build';
      case 'customer': return 'home';
      default: return 'person';
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.container, { backgroundColor: getRoleColor() }]}
      onPress={handleSwitchAccount}
      activeOpacity={0.8}
    >
      <Ionicons 
        name={getRoleIcon() as any} 
        size={12} 
        color={COLORS.text.inverse} 
      />
      <Text style={styles.roleText}>
        {currentRole ? currentRole.toUpperCase() : 'NO ROLE'}
      </Text>
      <Ionicons 
        name="swap-horizontal" 
        size={10} 
        color={COLORS.text.inverse} 
        style={styles.switchIcon}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1000,
    gap: 4,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.text.inverse,
    letterSpacing: 0.5,
  },
  switchIcon: {
    marginLeft: 2,
    opacity: 0.8,
  },
});

export default RoleIndicator; 