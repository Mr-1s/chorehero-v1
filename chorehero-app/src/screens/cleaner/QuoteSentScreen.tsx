/**
 * Quote Sent - Success screen after pro submits a video quote.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { wp, hp } from '../../utils/responsive';

type StackParamList = {
  QuoteSent: { jobId: string; customerName?: string };
  Jobs: { initialTab?: string };
};

type QuoteSentNavigationProp = StackNavigationProp<StackParamList, 'QuoteSent'>;

const QuoteSentScreen: React.FC<{
  navigation: QuoteSentNavigationProp;
  route: { params: { jobId: string; customerName?: string } };
}> = ({ navigation, route }) => {
  const customerName = route.params?.customerName ?? 'Customer';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <View style={styles.iconCircle}>
            <Ionicons name="checkmark" size={36} color="#FFFFFF" />
          </View>
        </View>
        <Text style={styles.title}>Quote sent to {customerName}</Text>
        <Text style={styles.subtitle}>They have 24 hours to respond.</Text>
        <Text style={styles.detail}>You'll be notified if they book or message.</Text>

        <TouchableOpacity
          style={styles.cta}
          onPress={() => navigation.navigate('Jobs', { initialTab: 'available' })}
          activeOpacity={0.88}
        >
          <LinearGradient colors={['#26B7C9', '#047B9B']} style={styles.ctaGradient}>
            <Text style={styles.ctaText}>Browse more jobs</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: wp('8%') },
  iconWrap: { marginBottom: hp('2.5%') },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A', textAlign: 'center', marginBottom: 8, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: '#475569', marginBottom: 2, textAlign: 'center' },
  detail: { fontSize: 13, color: '#94A3B8', marginBottom: hp('5%'), textAlign: 'center' },
  cta: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#26B7C9',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  ctaGradient: { paddingVertical: 16, alignItems: 'center' },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: -0.2 },
});

export default QuoteSentScreen;
