import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Alert,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../utils/constants';

interface NetworkStatusIndicatorProps {
  onNetworkChange?: (isConnected: boolean) => void;
  showOfflineActions?: boolean;
}

export const NetworkStatusIndicator: React.FC<NetworkStatusIndicatorProps> = ({
  onNetworkChange,
  showOfflineActions = true,
}) => {
  const [isConnected, setIsConnected] = useState(true);
  const [connectionType, setConnectionType] = useState<string>('unknown');
  const [pendingActionsCount, setPendingActionsCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  const slideAnim = new Animated.Value(-100);
  const pulseAnim = new Animated.Value(1);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = state.isConnected ?? false;
      const type = state.type || 'unknown';

      setIsConnected(connected);
      setConnectionType(type);
      setIsVisible(!connected);

      // Notify parent component
      onNetworkChange?.(connected);

      // Show/hide the indicator
      Animated.timing(slideAnim, {
        toValue: connected ? -100 : 0,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Start pulse animation for offline state
      if (!connected) {
        startPulseAnimation();
      }

      // Check for pending actions when back online
      if (connected) {
        checkPendingActions();
      }
    });

    // Initial check
    NetInfo.fetch().then(state => {
      const connected = state.isConnected ?? false;
      setIsConnected(connected);
      setConnectionType(state.type || 'unknown');
      setIsVisible(!connected);
      onNetworkChange?.(connected);

      if (!connected) {
        checkPendingActions();
      }
    });

    return unsubscribe;
  }, [onNetworkChange]);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.7,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const checkPendingActions = async () => {
    try {
      const offlineActions = await AsyncStorage.getItem('offline_actions');
      if (offlineActions) {
        const actions = JSON.parse(offlineActions);
        setPendingActionsCount(Object.keys(actions).length);
      } else {
        setPendingActionsCount(0);
      }
    } catch (error) {
      console.error('Error checking pending actions:', error);
    }
  };

  const handleRetryPendingActions = () => {
    Alert.alert(
      'Sync Pending Actions',
      `You have ${pendingActionsCount} pending actions. Do you want to sync them now?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sync', 
          onPress: () => {
            // This would trigger a sync from the parent component
            // or from a global network service
            console.log('Triggering sync for pending actions');
          }
        }
      ]
    );
  };

  const getConnectionIcon = () => {
    if (isConnected) {
      switch (connectionType) {
        case 'wifi':
          return 'wifi';
        case 'cellular':
          return 'cellular';
        default:
          return 'globe';
      }
    }
    return 'cloud-offline';
  };

  const getStatusMessage = () => {
    if (isConnected) {
      return `Connected via ${connectionType}`;
    }
    return 'No internet connection';
  };

  if (!isVisible && isConnected) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          backgroundColor: isConnected ? COLORS.success : COLORS.error,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.content,
          { opacity: pulseAnim },
        ]}
      >
        <Ionicons
          name={getConnectionIcon()}
          size={20}
          color="#FFFFFF"
          style={styles.icon}
        />

        <View style={styles.textContainer}>
          <Text style={styles.statusText}>
            {getStatusMessage()}
          </Text>
          
          {!isConnected && pendingActionsCount > 0 && (
            <Text style={styles.pendingText}>
              {pendingActionsCount} actions pending sync
            </Text>
          )}
        </View>

        {!isConnected && showOfflineActions && pendingActionsCount > 0 && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleRetryPendingActions}
          >
            <Text style={styles.actionButtonText}>Sync</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 50, // Account for status bar
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 1000,
    elevation: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  icon: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  pendingText: {
    color: '#FFFFFF',
    fontSize: 12,
    opacity: 0.9,
    marginTop: 2,
  },
  actionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default NetworkStatusIndicator;