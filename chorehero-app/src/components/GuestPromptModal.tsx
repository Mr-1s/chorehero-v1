/**
 * GuestPromptModal - Soft prompts for guest users to convert to sign-up.
 * Shown after 3 views, 5 views, or on booking attempt.
 */

import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { wp, hp } from '../utils/responsive';

export type GuestPromptType = 'save_favorites' | 'signup_to_book' | 'booking_attempt';

interface GuestPromptModalProps {
  visible: boolean;
  type: GuestPromptType;
  onSignUp: () => void;
  onDismiss: () => void;
}

const PROMPTS: Record<GuestPromptType, { title: string; subtitle: string; cta: string }> = {
  save_favorites: {
    title: 'Create account to save favorites?',
    subtitle: 'Sign up to save pros you love and book when you\'re ready.',
    cta: 'Create account',
  },
  signup_to_book: {
    title: 'Sign up in 10 seconds to book',
    subtitle: 'Create a free account to hire this hero.',
    cta: 'Sign up now',
  },
  booking_attempt: {
    title: 'Sign up to hire this hero',
    subtitle: 'Create a free account to book and message pros.',
    cta: 'Sign up to book',
  },
};

const GuestPromptModal: React.FC<GuestPromptModalProps> = ({
  visible,
  type,
  onSignUp,
  onDismiss,
}) => {
  const config = PROMPTS[type];

  const handleDismiss = () => {
    try {
      if (typeof (global as any).__analytics?.track === 'function') {
        (global as any).__analytics.track('guest_prompt_dismissed', { type });
      }
    } catch {
      // no-op
    }
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <TouchableWithoutFeedback onPress={handleDismiss}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.card}>
              <View style={styles.iconContainer}>
                <Ionicons name="person-add-outline" size={40} color="#00BCD4" />
              </View>
              <Text style={styles.title}>{config.title}</Text>
              <Text style={styles.subtitle}>{config.subtitle}</Text>
              <TouchableOpacity
                style={styles.ctaButton}
                onPress={() => {
                  try {
                    if (typeof (global as any).__analytics?.track === 'function') {
                      (global as any).__analytics.track('guest_convert_to_signup', { type });
                    (global as any).__analytics.track('guest_prompt_converted', { type });
                    }
                  } catch {
                    // no-op
                  }
                  onSignUp();
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.ctaText}>{config.cta}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dismissButton}
                onPress={handleDismiss}
                activeOpacity={0.7}
              >
                <Text style={styles.dismissText}>Maybe later</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp('6%'),
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: wp('6%'),
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0, 188, 212, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp('2%'),
  },
  title: {
    fontSize: wp('5%'),
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: wp('4%'),
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: hp('3%'),
    lineHeight: 22,
  },
  ctaButton: {
    width: '100%',
    height: 52,
    backgroundColor: '#00BCD4',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dismissButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  dismissText: {
    fontSize: 15,
    color: '#9CA3AF',
  },
});

export default GuestPromptModal;
