import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, StatusBar, TouchableOpacity, FlatList, Image, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { notificationService, type Notification } from '../../services/notificationService';
import { useAuth } from '../../hooks/useAuth';
import { wp, hp } from '../../utils/responsive';

const getIcon = (type: string) => {
  switch (type) {
    case 'booking': return 'calendar-outline';
    case 'message': return 'chatbubble-outline';
    case 'like': return 'heart-outline';
    case 'comment': return 'chatbubbles-outline';
    case 'service': return 'checkmark-circle-outline';
    case 'payment': return 'card-outline';
    case 'system': return 'sparkles-outline';
    default: return 'notifications-outline';
  }
};

const NotificationsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      if (user?.id) {
        const userNotifications = await notificationService.getNotificationsForUser(user.id);
        setNotifications(
          userNotifications.sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )
        );
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      void loadNotifications();
    }
  }, [user?.id, loadNotifications]);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        void loadNotifications();
      }
    }, [user?.id, loadNotifications])
  );

  const markAllAsRead = async () => {
    if (!user?.id) return;
    // Optimistic so the badge clears instantly; refetch reconciles state with the server.
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await notificationService.markAllAsRead(user.id);
    await loadNotifications();
  };

  const markAsRead = async (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
    const ok = await notificationService.markAsRead(notificationId);
    if (!ok) {
      // Server rejected the update — pull the truth back so the badge does not lie.
      await loadNotifications();
    }
  };

  const formatTimestamp = (timestamp: string | Date) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const renderItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity 
      style={[styles.notificationCard, !item.read && styles.unreadCard]}
      activeOpacity={0.82}
      onPress={() => markAsRead(item.id)}
    > 
      {item.fromUserAvatar ? (
        <Image source={{ uri: item.fromUserAvatar }} style={styles.userAvatar} />
      ) : (
        <Ionicons name={getIcon(item.type)} size={24} color={item.read ? '#26B7C9' : '#F59E0B'} style={styles.icon} />
      )}
      <View style={styles.info}>
        <Text style={[styles.title, !item.read && styles.unreadTitle]} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.message}>{item.message}</Text>
        <Text style={styles.timestamp}>{formatTimestamp(item.timestamp)}</Text>
      </View>
      {!item.read && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadBadgeText}>New</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity onPress={markAllAsRead} disabled={unreadCount === 0}>
          <Ionicons name="checkmark-done" size={24} color={unreadCount > 0 ? '#26B7C9' : '#CBD5E1'} />
        </TouchableOpacity>
      </View>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#26B7C9" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
          <View style={styles.emptyState}>
            <LinearGradient
              colors={['#26B7C9', '#047B9B']}
              style={styles.emptyIconGradient}
            >
              <Ionicons name="notifications-outline" size={64} color="#ffffff" />
            </LinearGradient>
            <Text style={styles.emptyStateTitle}>No notifications yet</Text>
            <Text style={styles.emptyStateSubtitle}>
              We'll notify you about booking updates, messages, and important information here.
            </Text>
            <View style={styles.emptyStateFeatures}>
              <View style={styles.featureItem}>
                <Ionicons name="calendar" size={20} color="#26B7C9" />
                <Text style={styles.featureText}>Booking updates</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="chatbubble" size={20} color="#26B7C9" />
                <Text style={styles.featureText}>Message alerts</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="pricetag" size={20} color="#26B7C9" />
                <Text style={styles.featureText}>Special offers</Text>
              </View>
            </View>
          </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: wp('5%'), paddingVertical: hp('1.5%'), backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backButton: { width: 44, height: 44, borderRadius: wp('5.5%'), backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: wp('4.5%'), fontWeight: '600', color: '#1F2937' },
  listContent: { paddingHorizontal: wp('4%'), paddingVertical: hp('1%'), paddingBottom: hp('3%') },
  notificationCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: hp('1.6%'), paddingHorizontal: wp('3.8%'), marginBottom: hp('1%'), borderWidth: 1, borderColor: '#E5E7EB', position: 'relative' },
  unreadCard: { borderColor: '#26B7C9', backgroundColor: '#F8FEFF' },
  icon: { marginRight: 16 },
  info: { flex: 1 },
  title: { fontSize: wp('3.95%'), fontWeight: '600', color: '#1F2937', marginBottom: 2 },
  unreadTitle: { fontWeight: '700' },
  message: { fontSize: wp('3.45%'), color: '#64748B', marginBottom: hp('0.35%') },
  timestamp: { fontSize: wp('3.05%'), color: '#94A3B8' },
  unreadBadge: { backgroundColor: '#26B7C9', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 10 },
  unreadBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 10, color: '#64748B', fontSize: wp('3.8%') },
  // Enhanced Empty State Styles
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('10%'),
    paddingHorizontal: wp('5%'),
  },
  emptyIconGradient: {
    width: 120,
    height: 120,
    borderRadius: wp('15%'),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#26B7C9',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: hp('3%'),
  },
  emptyStateTitle: {
    fontSize: wp('6%'),
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: hp('1.5%'),
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: wp('4%'),
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: hp('4%'),
  },
  emptyStateFeatures: {
    alignItems: 'center',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('2%'),
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('1.5%'),
    backgroundColor: '#F8FAFC',
    borderRadius: wp('6%'),
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  featureText: {
    fontSize: wp('4%'),
    fontWeight: '500',
    color: '#475569',
    marginLeft: 12,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: wp('5%'),
    marginRight: 12,
  },
});

export default NotificationsScreen; 