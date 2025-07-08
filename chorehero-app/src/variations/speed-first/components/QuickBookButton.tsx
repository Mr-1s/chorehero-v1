import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../shared/theme';

interface QuickBookButtonProps {
  onPress: () => void;
  price: number;
  available: boolean;
  isExpress?: boolean;
}

export const QuickBookButton: React.FC<QuickBookButtonProps> = ({
  onPress,
  price,
  available,
  isExpress = false
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        available ? styles.buttonAvailable : styles.buttonUnavailable,
        isExpress && styles.buttonExpress
      ]}
      onPress={onPress}
      disabled={!available}
    >
      <View style={styles.content}>
        <View style={styles.leftContent}>
          <Ionicons 
            name={isExpress ? "flash" : "calendar"} 
            size={24} 
            color={theme.colors.white} 
          />
          <View style={styles.textContent}>
            <Text style={styles.buttonText}>
              {isExpress ? 'Express Clean' : 'Book Now'}
            </Text>
            <Text style={styles.priceText}>
              ${price}/hr
            </Text>
          </View>
        </View>
        
        {isExpress && (
          <View style={styles.expressBadge}>
            <Text style={styles.expressText}>30-45 min</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...theme.shadows.md,
    marginVertical: theme.spacing.sm
  },
  buttonAvailable: {
    backgroundColor: theme.colors.primary
  },
  buttonUnavailable: {
    backgroundColor: theme.colors.gray[400]
  },
  buttonExpress: {
    backgroundColor: theme.colors.accent
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md
  },
  textContent: {
    flexDirection: 'column'
  },
  buttonText: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.white
  },
  priceText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.white,
    opacity: 0.9
  },
  expressBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full
  },
  expressText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.white,
    fontWeight: '600'
  }
});