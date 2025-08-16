import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, StatusBar, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PrivacyScreen = ({ navigation }: { navigation: any }) => (
  <SafeAreaView style={styles.container}>
    <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="#1F2937" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Privacy & Security</Text>
      <View style={{ width: 44 }} />
    </View>
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Your Privacy Matters</Text>
      <Text style={styles.bodyText}>
        We are committed to protecting your privacy and security. Your data is encrypted and never shared with third parties without your consent.
      </Text>
      <Text style={styles.sectionTitle}>Security Tips</Text>
      <View style={styles.tipItem}>
        <Ionicons name="lock-closed-outline" size={20} color="#00BFA6" />
        <Text style={styles.tipText}>Use a strong, unique password for your account.</Text>
      </View>
      <View style={styles.tipItem}>
        <Ionicons name="shield-checkmark-outline" size={20} color="#00BFA6" />
        <Text style={styles.tipText}>Never share your login credentials with anyone.</Text>
      </View>
      <View style={styles.tipItem}>
        <Ionicons name="alert-circle-outline" size={20} color="#00BFA6" />
        <Text style={styles.tipText}>Contact support if you notice any suspicious activity.</Text>
      </View>
      <TouchableOpacity style={styles.linkButton} onPress={() => Linking.openURL('https://chorehero.app/privacy')}>
        <Ionicons name="document-text-outline" size={20} color="#00BFA6" />
        <Text style={styles.linkButtonText}>Read Full Privacy Policy</Text>
      </TouchableOpacity>
    </ScrollView>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 24, marginBottom: 12, marginHorizontal: 20 },
  bodyText: { fontSize: 14, color: '#6B7280', marginHorizontal: 20, marginBottom: 16 },
  tipItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginHorizontal: 20, marginBottom: 12, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  tipText: { fontSize: 14, color: '#374151', marginLeft: 8 },
  linkButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDFA', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 14, marginHorizontal: 20, marginTop: 20, gap: 8 },
  linkButtonText: { fontSize: 16, fontWeight: '600', color: '#00BFA6', marginLeft: 8 },
});

export default PrivacyScreen; 