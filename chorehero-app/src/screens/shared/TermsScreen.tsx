import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, StatusBar, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const TermsScreen = ({ navigation }: { navigation: any }) => (
  <SafeAreaView style={styles.container}>
    <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="#1F2937" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Terms of Service</Text>
      <View style={{ width: 44 }} />
    </View>
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Summary</Text>
      <Text style={styles.bodyText}>
        By using ChoreHero, you agree to our terms and conditions. We strive to provide a safe, reliable, and high-quality service. Please review our full terms for details on your rights and responsibilities.
      </Text>
      <TouchableOpacity style={styles.linkButton} onPress={() => Linking.openURL('https://chorehero.app/terms')}>
        <Ionicons name="document-text-outline" size={20} color="#3ad3db" />
        <Text style={styles.linkButtonText}>Read Full Terms</Text>
      </TouchableOpacity>
      <Text style={styles.lastUpdated}>Last updated: June 1, 2024</Text>
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
  linkButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDFA', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 14, marginHorizontal: 20, marginTop: 20, gap: 8 },
  linkButtonText: { fontSize: 16, fontWeight: '600', color: '#3ad3db', marginLeft: 8 },
  lastUpdated: { fontSize: 12, color: '#9CA3AF', marginHorizontal: 20, marginTop: 32, textAlign: 'right' },
});

export default TermsScreen; 