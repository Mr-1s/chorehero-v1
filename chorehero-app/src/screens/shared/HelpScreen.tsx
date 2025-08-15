import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, StatusBar, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const faqs = [
  { q: 'How do I book a cleaning?', a: 'Go to the Booking tab and follow the steps to schedule your cleaning.' },
  { q: 'How do I contact my cleaner?', a: 'Use the Messages tab or the Track Cleaner screen to chat or call your cleaner.' },
  { q: 'How do I update my payment method?', a: 'Go to Settings > Payment Methods to add or update your payment options.' },
  { q: 'What if I need to reschedule?', a: 'You can reschedule from your Dashboard or by contacting support.' },
];

const HelpScreen = ({ navigation }: { navigation: any }) => (
  <SafeAreaView style={styles.container}>
    <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="#1F2937" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Help & Support</Text>
      <View style={{ width: 44 }} />
    </View>
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
      {faqs.map((faq, idx) => (
        <View key={idx} style={styles.faqItem}>
          <Text style={styles.faqQ}>{faq.q}</Text>
          <Text style={styles.faqA}>{faq.a}</Text>
        </View>
      ))}
      <Text style={styles.sectionTitle}>Contact Support</Text>
      <TouchableOpacity style={styles.contactButton} onPress={() => Alert.alert('Contact', 'Email: support@chorehero.app\nPhone: +1-555-HERO-123')}>
        <Ionicons name="mail" size={20} color="#3ad3db" />
        <Text style={styles.contactButtonText}>Email Us</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.contactButton} onPress={() => Alert.alert('Contact', 'Phone: +1-555-HERO-123')}>
        <Ionicons name="call" size={20} color="#3ad3db" />
        <Text style={styles.contactButtonText}>Call Us</Text>
      </TouchableOpacity>
      <Text style={styles.sectionTitle}>Submit a Support Request</Text>
      <View style={styles.supportFormPlaceholder}>
        <Ionicons name="document-text-outline" size={32} color="#3ad3db" />
        <Text style={styles.supportFormText}>Support request form coming soon!</Text>
      </View>
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
  faqItem: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginHorizontal: 20, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  faqQ: { fontSize: 15, fontWeight: '600', color: '#1F2937', marginBottom: 4 },
  faqA: { fontSize: 14, color: '#6B7280' },
  contactButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDFA', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 14, marginHorizontal: 20, marginBottom: 12, gap: 8 },
  contactButtonText: { fontSize: 16, fontWeight: '600', color: '#3ad3db', marginLeft: 8 },
  supportFormPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6', borderRadius: 16, padding: 24, marginHorizontal: 20, marginTop: 12 },
  supportFormText: { fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center' },
});

export default HelpScreen; 