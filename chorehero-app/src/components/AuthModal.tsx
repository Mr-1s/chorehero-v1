import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';

WebBrowser.maybeCompleteAuthSession();

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenEmail: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ visible, onClose, onOpenEmail }) => {
  const handleOAuth = async (provider: 'google' | 'apple') => {
    try {
      const redirectTo = makeRedirectUri({
        native: 'chorehero://auth',
        scheme: 'chorehero',
        preferLocalhost: false,
      });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (error || !data?.url) {
        onClose();
        return;
      }
      await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      onClose();
    } catch {
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Sign in to continue</Text>
          <Text style={styles.subtitle}>Save, message, and book instantly.</Text>

          <TouchableOpacity style={styles.primaryButton} onPress={() => handleOAuth('apple')}>
            <Ionicons name="logo-apple" size={18} color="#fff" />
            <Text style={styles.primaryButtonText}>Continue with Apple</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => handleOAuth('google')}>
            <Ionicons name="logo-google" size={18} color="#111827" />
            <Text style={styles.secondaryButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkButton} onPress={onOpenEmail}>
            <Text style={styles.linkText}>Use email instead</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dismiss} onPress={onClose}>
            <Text style={styles.dismissText}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  title: { fontSize: 20, fontWeight: '800', color: '#111827' },
  subtitle: { marginTop: 6, marginBottom: 16, color: '#6B7280', textAlign: 'center' },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#111827',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    width: '100%',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 12,
    width: '100%',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: '#111827', fontWeight: '700' },
  linkButton: { marginTop: 14 },
  linkText: { color: '#0891b2', fontWeight: '700' },
  dismiss: { marginTop: 12 },
  dismissText: { color: '#6B7280' },
});

export default AuthModal;
