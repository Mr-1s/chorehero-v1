import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

const { width } = Dimensions.get('window');

type CleanerTabParamList = {
  Heroes: undefined;
  Jobs: undefined;
  Content: undefined;
  Messages: undefined;
  Profile: undefined;
  VideoUpload: undefined;
  Home: undefined;
  JobsScreen: undefined;
  EarningsScreen: undefined;
  ScheduleScreen: undefined;
  NotificationsScreen: undefined;
};

type CleanerFloatingNavigationProps = {
  navigation: BottomTabNavigationProp<CleanerTabParamList, any>;
  currentScreen: keyof CleanerTabParamList;
  unreadCount?: number;
};

const CleanerFloatingNavigation: React.FC<CleanerFloatingNavigationProps> = ({ 
  navigation, 
  currentScreen,
  unreadCount = 0 
}) => {
  const getButtonColor = (screen: keyof CleanerTabParamList) => {
    if (currentScreen === screen) {
      return '#F59E0B'; // Brand primary for active
    }
    return 'rgba(107, 114, 128, 0.8)'; // Darker gray for inactive
  };

  const getTextStyle = (screen: keyof CleanerTabParamList) => {
    return currentScreen === screen ? styles.activeButtonText : styles.navButtonText;
  };

  const getButtonStyle = (screen: keyof CleanerTabParamList) => {
    return currentScreen === screen ? styles.activeNavButton : styles.navButton;
  };

  const getIconName = (screen: keyof CleanerTabParamList, focused: boolean): keyof typeof Ionicons.glyphMap => {
    switch (screen) {
      case 'Heroes':
        return focused ? 'bulb' : 'bulb-outline';
      case 'Jobs':
        return focused ? 'briefcase' : 'briefcase-outline';
      case 'Content':
        return focused ? 'videocam' : 'videocam-outline';
      case 'Messages':
        return focused ? 'chatbubbles' : 'chatbubbles-outline';
      case 'Profile':
        return focused ? 'person' : 'person-outline';
      default:
        return 'bulb-outline';
    }
  };

  return (
    <View style={styles.navigationWrapper}>
      <View style={styles.navigationContainer}>
        <View style={styles.navigationContent}>
          <TouchableOpacity 
            style={getButtonStyle('Heroes')} 
            onPress={() => navigation.navigate('Heroes')}
          >
            <View style={styles.iconWrapper}>
              <Ionicons 
                name={getIconName('Heroes', currentScreen === 'Heroes')} 
                size={28} 
                color={getButtonColor('Heroes')} 
              />
            </View>
            <Text style={getTextStyle('Heroes')}>Tips</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={getButtonStyle('Jobs')} 
            onPress={() => navigation.navigate('Jobs')}
          >
            <View style={styles.iconWrapper}>
              <Ionicons 
                name={getIconName('Jobs', currentScreen === 'Jobs')} 
                size={28} 
                color={getButtonColor('Jobs')} 
              />
            </View>
            <Text style={getTextStyle('Jobs')}>Jobs</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={getButtonStyle('Content')} 
            onPress={() => navigation.navigate('VideoUpload')}
          >
            <View style={styles.iconWrapper}>
              <Ionicons 
                name={getIconName('Content', currentScreen === 'Content')} 
                size={28} 
                color={getButtonColor('Content')} 
              />
            </View>
            <Text style={getTextStyle('Content')}>Content</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={getButtonStyle('Messages')} 
            onPress={() => navigation.navigate('Messages')}
          >
            <View style={styles.iconContainer}>
              <View style={styles.iconWrapper}>
                <Ionicons 
                  name={getIconName('Messages', currentScreen === 'Messages')} 
                  size={28} 
                  color={getButtonColor('Messages')} 
                />
              </View>
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount}</Text>
                </View>
              )}
            </View>
            <Text style={getTextStyle('Messages')}>Messages</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={getButtonStyle('Profile')} 
            onPress={() => navigation.navigate('Home')}
          >
            <View style={styles.iconWrapper}>
              <Ionicons 
                name={getIconName('Profile', currentScreen === 'Profile')} 
                size={28} 
                color={getButtonColor('Profile')} 
              />
            </View>
            <Text style={getTextStyle('Profile')}>Profile</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  navigationWrapper: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    height: 80,
    zIndex: 100,
  },
  navigationContainer: {
    flex: 1,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.3)', // Brand primary border
    overflow: 'hidden',
    shadowColor: '#F59E0B', // Brand primary shadow
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 15,
    // backdropFilter: 'blur(20px)', // Not supported in React Native
  },
  navigationContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    backgroundColor: 'transparent',
  },
  navButton: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 16,
    backgroundColor: 'transparent',
    marginHorizontal: 0,
  },
  activeNavButton: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 16,
    backgroundColor: 'rgba(245, 158, 11, 0.15)', // Brand primary background
    marginHorizontal: 0,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)', // Brand primary border
  },
  activeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B', // Brand primary text
    marginTop: 4,
    textShadowColor: 'rgba(245, 158, 11, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  navButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(107, 114, 128, 0.85)',
    marginTop: 4,
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  iconContainer: {
    position: 'relative',
  },
  iconWrapper: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  badge: {
    position: 'absolute',
    right: -6,
    top: -3,
    backgroundColor: '#FF4F5E',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#FF4F5E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default CleanerFloatingNavigation; 