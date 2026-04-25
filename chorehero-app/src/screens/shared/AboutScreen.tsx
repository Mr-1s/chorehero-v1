import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, StatusBar, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { wp, hp } from '../../utils/responsive';

const AboutScreen = ({ navigation }) => (
  <SafeAreaView style={styles.container}>
    <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="#1F2937" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>About</Text>
      <View style={{ width: 44 }} />
    </View>
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.appName}>ChoreHero</Text>
      <Text style={styles.version}>Version 1.0.0</Text>
      <Text style={styles.company}>© 2024 ChoreHero Inc.</Text>
      <Text style={styles.madeIn}>Made with ❤️ in San Francisco</Text>
      <TouchableOpacity style={styles.linkButton} onPress={() => Linking.openURL('https://chorehero.app')}>
        <Ionicons name="globe-outline" size={20} color="#26B7C9" />
        <Text style={styles.linkButtonText}>Visit Website</Text>
      </TouchableOpacity>
    </ScrollView>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: wp('5%'), paddingVertical: hp('2%'), backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backButton: { width: 44, height: 44, borderRadius: wp('5.5%'), backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: wp('4.5%'), fontWeight: '600', color: '#1F2937' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: hp('5%'), alignItems: 'center', justifyContent: 'center' },
  appName: { fontSize: wp('7%'), fontWeight: '700', color: '#26B7C9', marginTop: hp('5%'), marginBottom: hp('1%') },
  version: { fontSize: wp('4%'), color: '#6B7280', marginBottom: hp('1%') },
  company: { fontSize: wp('3.5%'), color: '#9CA3AF', marginBottom: hp('0.5%') },
  madeIn: { fontSize: wp('3.5%'), color: '#9CA3AF', marginBottom: hp('4%') },
  linkButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDFA', borderRadius: wp('3%'), paddingHorizontal: wp('5%'), paddingVertical: hp('1.7%'), marginTop: hp('2.5%'), gap: wp('2%') },
  linkButtonText: { fontSize: wp('4%'), fontWeight: '600', color: '#26B7C9', marginLeft: 8 },
});

export default AboutScreen; 