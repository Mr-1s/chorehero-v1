import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, StatusBar, TouchableOpacity, FlatList, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { USE_MOCK_DATA } from '../../utils/constants';
import { notificationService, type Notification } from '../../services/notificationService';
import { useAuth } from '../../hooks/useAuth';

const mockNotifications = [
  { id: '1', type: 'booking', title: 'Booking Confirmed', message: 'Your cleaning is scheduled for tomorrow at 2:00 PM', timestamp: '5 min ago', read: false },
  { id: '2', type: 'service', title: 'Cleaner On The Way', message: 'Maria Garcia is on the way to your location', timestamp: '10 min ago', read: false },
  { id: '3', type: 'payment', title: 'Payment Processed', message: 'Payment of $85 has been processed', timestamp: '1 hour ago', read: true },
  { id: '4', type: 'system', title: 'New Feature', message: 'Try our new video profile feature!', timestamp: '1 day ago', read: true },
];

const getIcon = (type) => {
  switch (type) {
    case 'booking': return 'calendar-outline';
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

  useEffect(() => {
    loadNotifications();
  }, [user?.id]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      if (user?.id) {
        const userNotifications = await notificationService.getNotificationsForUser(user.id);
        setNotifications(userNotifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAllAsRead = async () => {
    if (user?.id) {
      await notificationService.markAllAsRead(user.id);
      setNotifications(notifications.map(n => ({ ...n, read: true })));
    }
  };

  const markAsRead = async (notificationId: string) => {
    await notificationService.markAsRead(notificationId);
    setNotifications(notifications.map(n => 
      n.id === notificationId ? { ...n, read: true } : n
    ));
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
      onPress={() => markAsRead(item.id)}
    > 
      {item.fromUserAvatar ? (
        <Image source={{ uri: item.fromUserAvatar }} style={styles.userAvatar} />
      ) : (
        <Ionicons name={getIcon(item.type)} size={24} color={item.read ? '#00BFA6' : '#F59E0B'} style={styles.icon} />
      )}
      <View style={styles.info}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.message}>{item.message}</Text>
        <Text style={styles.timestamp}>{formatTimestamp(item.timestamp)}</Text>
      </View>
      {!item.read && <View style={styles.unreadDot} />}
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
        <TouchableOpacity onPress={markAllAsRead}>
          <Ionicons name="checkmark-done" size={24} color="#00BFA6" />
        </TouchableOpacity>
      </View>
      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <LinearGradient
              colors={['#3ad3db', '#2BC8D4']}
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
                <Ionicons name="calendar" size={20} color="#3ad3db" />
                <Text style={styles.featureText}>Booking updates</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="chatbubble" size={20} color="#3ad3db" />
                <Text style={styles.featureText}>Message alerts</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="pricetag" size={20} color="#3ad3db" />
                <Text style={styles.featureText}>Special offers</Text>
              </View>
            </View>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937' },
  listContent: { padding: 20 },
  notificationCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, position: 'relative' },
  unreadCard: { borderWidth: 1, borderColor: '#F59E0B' },
  icon: { marginRight: 16 },
  info: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 2 },
  message: { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  timestamp: { fontSize: 12, color: '#9CA3AF' },
  unreadDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#F59E0B', position: 'absolute', top: 16, right: 16 },
  emptyText: { textAlign: 'center', color: '#6B7280', marginTop: 40, fontSize: 16 },
  // Enhanced Empty State Styles
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 20,
  },
  emptyIconGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3ad3db',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 24,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  emptyStateFeatures: {
    alignItems: 'center',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  featureText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#475569',
    marginLeft: 12,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
});

export default NotificationsScreen; 