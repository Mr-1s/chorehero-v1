import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StackNavigationProp } from '@react-navigation/stack';
import { supabase } from '../../services/supabase';

interface ServiceRow {
  id: string;
  name: string;
  category: string;
  icon: string | null;
}

interface BookServiceScreenProps {
  navigation: StackNavigationProp<any>;
}

const BookServiceScreen: React.FC<BookServiceScreenProps> = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [activeServiceIds, setActiveServiceIds] = useState<Set<string>>(new Set());
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [userZip, setUserZip] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const zip = await AsyncStorage.getItem('guest_zip');
        setUserZip(zip);
        const [{ data: serviceRows }, { data: proRows }] = await Promise.all([
          supabase.from('services').select('id, name, category, icon').eq('is_active', true),
          supabase.from('pro_services').select('service_id, service_area_zips').eq('is_active', true),
        ]);
        setServices((serviceRows || []) as ServiceRow[]);
        const filteredActive = (proRows || []).filter((r: any) => {
          if (!zip) return true;
          const zips: string[] | null = r.service_area_zips;
          if (!Array.isArray(zips) || zips.length === 0) return true;
          return zips.includes(zip);
        });
        setActiveServiceIds(new Set(filteredActive.map((r: any) => r.service_id)));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const categories = useMemo(() => {
    const map: Record<string, ServiceRow[]> = {};
    services
      .filter((s) => activeServiceIds.has(s.id))
      .forEach((s) => {
        map[s.category] = map[s.category] || [];
        map[s.category].push(s);
      });
    return map;
  }, [services, activeServiceIds]);

  const hasAnyService = Object.keys(categories).length > 0;

  const handleWaitlistSubmit = async () => {
    if (!waitlistEmail.trim()) {
      Alert.alert('Email required', 'Please enter your email to get notified.');
      return;
    }
    try {
      const { error } = await supabase.from('waitlist_signups').insert({
        email: waitlistEmail.trim(),
        source: 'book_service_coming_soon',
        zip_code: userZip,
      });
      if (error) throw error;
      Alert.alert('Thanks!', "We'll notify you when services launch in your area.");
      setWaitlistEmail('');
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Please try again later.');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#26B7C9" />
      </View>
    );
  }

  if (!hasAnyService) {
    return (
      <View style={styles.center}>
        <Ionicons name="time-outline" size={48} color="#26B7C9" />
        <Text style={styles.title}>Coming Soon</Text>
        <Text style={styles.subtitle}>
          No pros are active in your area yet. Leave your email and we&apos;ll notify you the moment services launch.
        </Text>
        <TextInput
          placeholder="you@example.com"
          value={waitlistEmail}
          onChangeText={setWaitlistEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
        <TouchableOpacity style={styles.cta} onPress={handleWaitlistSubmit}>
          <Text style={styles.ctaText}>Notify me</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Book a Service</Text>
      <Text style={styles.subtitle}>Tap a service to start a booking.</Text>
      {Object.entries(categories).map(([category, rows]) => (
        <View key={category} style={styles.categoryBlock}>
          <Text style={styles.categoryTitle}>{category}</Text>
          <View style={styles.grid}>
            {rows.map((svc) => (
              <TouchableOpacity
                key={svc.id}
                style={styles.serviceCard}
                onPress={() =>
                  navigation.navigate('UnifiedBooking', {
                    serviceId: svc.id,
                    serviceName: svc.name,
                    serviceType: svc.category,
                  })
                }
              >
                <Ionicons name={(svc.icon as any) || 'sparkles-outline'} size={22} color="#0F172A" />
                <Text style={styles.serviceName}>{svc.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  container: { padding: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 6, color: '#0F172A' },
  subtitle: { color: '#475569', marginBottom: 14, textAlign: 'center' },
  input: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    width: '100%',
  },
  cta: {
    marginTop: 10,
    backgroundColor: '#26B7C9',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  ctaText: { color: '#fff', fontWeight: '700' },
  categoryBlock: { marginBottom: 18 },
  categoryTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8, color: '#0F172A' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  serviceCard: {
    width: '47%',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    alignItems: 'flex-start',
  },
  serviceName: { marginTop: 8, fontWeight: '600', color: '#0F172A' },
});

export default BookServiceScreen;
