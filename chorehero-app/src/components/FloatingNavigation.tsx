import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useMessages } from '../context/MessageContext';

const { width } = Dimensions.get('window');

type TabParamList = {
  Home: undefined;
  Content: undefined;
  Discover: undefined;
  Bookings: undefined;
  Messages: undefined;
  Profile: undefined;
  CleanerProfile: { cleanerId: string };
};

type FloatingNavigationProps = {
  navigation: BottomTabNavigationProp<TabParamList, any>;
  currentScreen: keyof TabParamList;
};

const FloatingNavigation: React.FC<FloatingNavigationProps> = ({ navigation, currentScreen }) => {
  const { unreadCount } = useMessages();
  const getButtonColor = (screen: keyof TabParamList) => {
    if (currentScreen === screen) {
      return '#3ad3db'; // Cyan for active
    }
    return 'rgba(107, 114, 128, 0.8)'; // Darker gray for inactive on white background
  };

  const getTextStyle = (screen: keyof TabParamList) => {
    return currentScreen === screen ? styles.activeButtonText : styles.navButtonText;
  };

  const getButtonStyle = (screen: keyof TabParamList) => {
    return currentScreen === screen ? styles.activeNavButton : styles.navButton;
  };

  return (
    <View style={styles.navigationWrapper}>
      <View style={styles.navigationContainer}>
        <View style={styles.navigationContent}>
          <TouchableOpacity 
            style={currentScreen === 'Content' ? styles.activeNavButton : styles.navButton} 
            onPress={() => navigation.navigate('Content')}
          >
            <View style={styles.iconWrapper}>
              <Ionicons name="play" size={28} color={getButtonColor('Content')} />
            </View>
            <Text style={getTextStyle('Content')}>Chores</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={getButtonStyle('Discover')} 
            onPress={() => navigation.navigate('Discover')}
          >
            <View style={styles.iconWrapper}>
              <Ionicons name="compass" size={28} color={getButtonColor('Discover')} />
            </View>
            <Text style={getTextStyle('Discover')}>Discover</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={getButtonStyle('Bookings')} 
            onPress={() => navigation.navigate('Bookings')}
          >
            <View style={styles.iconWrapper}>
              <Ionicons name="calendar" size={28} color={getButtonColor('Bookings')} />
            </View>
            <Text style={getTextStyle('Bookings')}>Bookings</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={getButtonStyle('Messages')} 
            onPress={() => navigation.navigate('Messages')}
          >
              <View style={styles.iconContainer}>
              <View style={styles.iconWrapper}>
                <Ionicons name="chatbubble" size={28} color={getButtonColor('Messages')} />
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
              <Ionicons name="person" size={28} color={getButtonColor('Profile')} />
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
    borderColor: 'rgba(58, 211, 219, 0.3)',
    overflow: 'hidden',
    shadowColor: '#3ad3db',
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
    backgroundColor: 'rgba(58, 211, 219, 0.15)',
    marginHorizontal: 0,
    borderWidth: 1,
    borderColor: 'rgba(58, 211, 219, 0.3)',
  },
  activeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3ad3db',
    marginTop: 4,
    textShadowColor: 'rgba(58, 211, 219, 0.5)',
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

export default FloatingNavigation; 