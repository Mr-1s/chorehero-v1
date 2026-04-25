import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, StatusBar, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { wp, hp } from '../../utils/responsive';

const TermsScreen = ({ navigation }) => (
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
        <Ionicons name="document-text-outline" size={20} color="#26B7C9" />
        <Text style={styles.linkButtonText}>Read Full Terms</Text>
      </TouchableOpacity>
      <Text style={styles.lastUpdated}>Last updated: June 1, 2024</Text>
    </ScrollView>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: wp('5%'), paddingVertical: hp('2%'), backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backButton: { width: 44, height: 44, borderRadius: wp('5.5%'), backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: wp('4.5%'), fontWeight: '600', color: '#1F2937' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: hp('5%') },
  sectionTitle: { fontSize: wp('4%'), fontWeight: '600', color: '#374151', marginTop: hp('3%'), marginBottom: hp('1.5%'), marginHorizontal: wp('5%') },
  bodyText: { fontSize: wp('3.5%'), color: '#6B7280', marginHorizontal: wp('5%'), marginBottom: hp('2%') },
  linkButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDFA', borderRadius: wp('3%'), paddingHorizontal: wp('5%'), paddingVertical: hp('1.7%'), marginHorizontal: wp('5%'), marginTop: hp('2.5%'), gap: wp('2%') },
  linkButtonText: { fontSize: wp('4%'), fontWeight: '600', color: '#26B7C9', marginLeft: 8 },
  lastUpdated: { fontSize: wp('3%'), color: '#9CA3AF', marginHorizontal: wp('5%'), marginTop: hp('4%'), textAlign: 'right' },
});

export default TermsScreen; 