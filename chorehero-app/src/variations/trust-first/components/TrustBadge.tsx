import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../shared/theme';

interface TrustBadgeProps {
  type: 'verified' | 'background-check' | 'insured' | 'years-experience';
  value?: string | number;
  size?: 'small' | 'medium' | 'large';
}

export const TrustBadge: React.FC<TrustBadgeProps> = ({ type, value, size = 'medium' }) => {
  const getBadgeConfig = () => {
    switch (type) {
      case 'verified':
        return {
          icon: 'shield-checkmark',
          color: theme.colors.success,
          label: 'Verified',
          description: 'Identity verified'
        };
      case 'background-check':
        return {
          icon: 'document-text',
          color: theme.colors.primary,
          label: 'Background Check',
          description: 'Background checked'
        };
      case 'insured':
        return {
          icon: 'umbrella',
          color: theme.colors.secondary,
          label: 'Insured',
          description: 'Fully insured'
        };
      case 'years-experience':
        return {
          icon: 'star',
          color: theme.colors.warning,
          label: `${value} Years`,
          description: 'Professional experience'
        };
      default:
        return {
          icon: 'checkmark-circle',
          color: theme.colors.gray[500],
          label: 'Verified',
          description: 'Verified cleaner'
        };
    }
  };

  const config = getBadgeConfig();
  const sizeStyles = getStyles(size);

  return (
    <View style={[styles.container, sizeStyles.container]}>
      <View style={[styles.iconContainer, { backgroundColor: config.color }]}>
        <Ionicons 
          name={config.icon as any} 
          size={sizeStyles.iconSize} 
          color={theme.colors.white} 
        />
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.label, sizeStyles.label]}>{config.label}</Text>
        {size !== 'small' && (
          <Text style={[styles.description, sizeStyles.description]}>
            {config.description}
          </Text>
        )}
      </View>
    </View>
  );
};

const getStyles = (size: 'small' | 'medium' | 'large') => {
  switch (size) {
    case 'small':
      return {
        container: { padding: theme.spacing.xs },
        iconSize: 12,
        label: { fontSize: theme.fontSize.xs },
        description: { fontSize: theme.fontSize.xs }
      };
    case 'large':
      return {
        container: { padding: theme.spacing.md },
        iconSize: 24,
        label: { fontSize: theme.fontSize.lg },
        description: { fontSize: theme.fontSize.md }
      };
    default:
      return {
        container: { padding: theme.spacing.sm },
        iconSize: 16,
        label: { fontSize: theme.fontSize.sm },
        description: { fontSize: theme.fontSize.xs }
      };
  }
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.sm
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm
  },
  textContainer: {
    flex: 1
  },
  label: {
    fontWeight: '600',
    color: theme.colors.gray[800]
  },
  description: {
    color: theme.colors.gray[600],
    marginTop: 2
  }
});