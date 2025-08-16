import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, StatusBar, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const AboutScreen = ({ navigation }: { navigation: any }) => (
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
        <Ionicons name="globe-outline" size={20} color="#00BFA6" />
        <Text style={styles.linkButtonText}>Visit Website</Text>
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
  scrollContent: { paddingBottom: 40, alignItems: 'center', justifyContent: 'center' },
  appName: { fontSize: 28, fontWeight: '700', color: '#00BFA6', marginTop: 40, marginBottom: 8 },
  version: { fontSize: 16, color: '#6B7280', marginBottom: 8 },
  company: { fontSize: 14, color: '#9CA3AF', marginBottom: 4 },
  madeIn: { fontSize: 14, color: '#9CA3AF', marginBottom: 32 },
  linkButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDFA', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 14, marginTop: 20, gap: 8 },
  linkButtonText: { fontSize: 16, fontWeight: '600', color: '#00BFA6', marginLeft: 8 },
});

export default AboutScreen; 