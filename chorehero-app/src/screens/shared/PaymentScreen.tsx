import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TextInput,
  Alert,
  ActivityIndicator,
  Animated,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';

// Theme colors
const THEMES = {
  customer: {
    primary: '#0891b2',
    primaryLight: '#E0F7FA',
    primaryDark: '#0e7490',
    accent: '#06b6d4',
  },
  cleaner: {
    primary: '#F59E0B',
    primaryLight: '#FEF3C7',
    primaryDark: '#D97706',
    accent: '#FBBF24',
  },
};

type StackParamList = {
  PaymentScreen: {
    bookingTotal?: number;
    cleanerId?: string;
    fromBooking?: boolean;
    paymentIntent?: string;
  };
  BookingConfirmation: {
    bookingId: string;
    paymentId: string;
  };
  MainTabs: undefined;
};

type PaymentScreenProps = {
  navigation: StackNavigationProp<StackParamList, 'PaymentScreen'>;
  route: RouteProp<StackParamList, 'PaymentScreen'>;
};

interface PaymentMethod {
  id: string;
  type: 'card' | 'bank' | 'digital';
  provider: string;
  last4: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
  nickname?: string;
}

interface BillingAddress {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

const PaymentScreen: React.FC<PaymentScreenProps> = ({ navigation, route }) => {
  const { bookingTotal, cleanerId, fromBooking, paymentIntent } = route.params || {};
  const { user, isCleaner } = useAuth();
  
  // Dynamic theme based on user role
  const theme = isCleaner ? THEMES.cleaner : THEMES.customer;
  
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'methods' | 'billing' | 'history'>('methods');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [showAddCard, setShowAddCard] = useState(false);
  const [billingAddress, setBillingAddress] = useState<BillingAddress>({
    firstName: '',
    lastName: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'US',
  });
  const [autoSaveCards, setAutoSaveCards] = useState(true);
  const [newCard, setNewCard] = useState({
    number: '',
    expiry: '',
    cvc: '',
    name: '',
    nickname: '',
    saveCard: true,
  });

  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadPaymentData();
  }, []);

  useEffect(() => {
    if (showAddCard) {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    }
  }, [showAddCard]);

  const loadPaymentData = async () => {
    setIsLoading(true);
    try {
      // TODO: Integrate with Stripe to fetch real payment methods
      // For now, start with empty state - users will add their own cards
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setPaymentMethods([]);
      setSelectedMethodId(null);
      
      // Empty billing address for user to fill
      setBillingAddress({
        firstName: '',
        lastName: '',
        addressLine1: '',
        addressLine2: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'US',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to load payment information');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\s/g, '');
    const match = cleaned.match(/.{1,4}/g);
    return match ? match.join(' ').substr(0, 19) : cleaned;
  };

  const formatExpiry = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return `${cleaned.substr(0, 2)}/${cleaned.substr(2, 2)}`;
    }
    return cleaned;
  };

  const validateCard = () => {
    if (newCard.number.replace(/\s/g, '').length < 16) {
      Alert.alert('Invalid Card', 'Please enter a valid card number');
      return false;
    }
    if (newCard.expiry.length < 5) {
      Alert.alert('Invalid Expiry', 'Please enter a valid expiry date');
      return false;
    }
    if (newCard.cvc.length < 3) {
      Alert.alert('Invalid CVC', 'Please enter a valid CVC code');
      return false;
    }
    if (!newCard.name.trim()) {
      Alert.alert('Invalid Name', 'Please enter the cardholder name');
      return false;
    }
    return true;
  };

  const handleAddCard = async () => {
    if (!validateCard()) return;
    
    setIsProcessing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const lastFour = newCard.number.replace(/\s/g, '').slice(-4);
      const [month, year] = newCard.expiry.split('/');
      
      const newMethod: PaymentMethod = {
        id: Date.now().toString(),
        type: 'card',
        provider: 'Visa', // Would be detected from card number
        brand: 'visa',
        last4: lastFour,
        expiryMonth: parseInt(month),
        expiryYear: 2000 + parseInt(year),
        isDefault: paymentMethods.length === 0,
        nickname: newCard.nickname || `Card ending in ${lastFour}`,
      };
      
      setPaymentMethods(prev => [...prev, newMethod]);
      setSelectedMethodId(newMethod.id);
      setShowAddCard(false);
      setNewCard({
        number: '',
        expiry: '',
        cvc: '',
        name: '',
        nickname: '',
        saveCard: true,
      });
      
      Alert.alert('Success', 'Payment method added successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to add payment method');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSetDefault = async (methodId: string) => {
    setPaymentMethods(prev => prev.map(method => ({
      ...method,
      isDefault: method.id === methodId,
    })));
    setSelectedMethodId(methodId);
  };

  const handleDeleteMethod = (methodId: string) => {
    Alert.alert(
      'Remove Payment Method',
      'Are you sure you want to remove this payment method?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setPaymentMethods(prev => prev.filter(m => m.id !== methodId));
            if (selectedMethodId === methodId) {
              const remaining = paymentMethods.filter(m => m.id !== methodId);
              setSelectedMethodId(remaining[0]?.id || null);
            }
          },
        },
      ]
    );
  };

  const handleProcessPayment = async () => {
    if (!selectedMethodId) {
      Alert.alert('No Payment Method', 'Please select a payment method');
      return;
    }

    setIsProcessing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const paymentId = `pay_${Date.now()}`;
      const bookingId = `booking_${Date.now()}`;
      
      if (fromBooking) {
        navigation.navigate('BookingConfirmation', {
          bookingId,
          paymentId,
        });
      } else {
        Alert.alert('Success', 'Payment method updated successfully');
        navigation.goBack();
      }
    } catch (error) {
      Alert.alert('Payment Failed', 'Please try again or use a different payment method');
    } finally {
      setIsProcessing(false);
    }
  };

  const getCardIcon = (brand?: string) => {
    switch (brand) {
      case 'visa': return 'card';
      case 'mastercard': return 'card';
      case 'amex': return 'card';
      default: return 'card-outline';
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'apple pay': return 'logo-apple';
      case 'google pay': return 'logo-google';
      case 'paypal': return 'logo-paypal';
      default: return 'card';
    }
  };

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      {[
        { id: 'methods', label: 'Payment', icon: 'card-outline' },
        { id: 'billing', label: 'Billing', icon: 'location-outline' },
        { id: 'history', label: 'History', icon: 'time-outline' },
      ].map((tab) => (
        <TouchableOpacity
          key={tab.id}
          style={[
            styles.tab, 
            activeTab === tab.id && [styles.activeTab, { borderBottomColor: theme.primary }]
          ]}
          onPress={() => setActiveTab(tab.id as any)}
        >
          <Ionicons 
            name={tab.icon as any} 
            size={20} 
            color={activeTab === tab.id ? theme.primary : '#6B7280'} 
          />
          <Text style={[
            styles.tabText, 
            activeTab === tab.id && [styles.activeTabText, { color: theme.primary }]
          ]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderPaymentMethod = (method: PaymentMethod) => (
    <View key={method.id} style={styles.paymentMethodCard}>
      <TouchableOpacity
        style={styles.methodSelector}
        onPress={() => setSelectedMethodId(method.id)}
      >
        <View style={styles.methodLeft}>
          <View style={[styles.methodIcon, { backgroundColor: theme.primaryLight }]}>
            <Ionicons 
              name={method.type === 'digital' ? getProviderIcon(method.provider) : getCardIcon(method.brand)}
              size={24} 
              color={theme.primary} 
            />
          </View>
          <View style={styles.methodInfo}>
            <Text style={styles.methodProvider}>{method.provider}</Text>
            <Text style={styles.methodDetails}>
              {method.type === 'digital' ? method.provider : `•••• •••• •••• ${method.last4}`}
            </Text>
            {method.nickname && (
              <Text style={styles.methodNickname}>{method.nickname}</Text>
            )}
          </View>
        </View>
        
        <View style={styles.methodRight}>
          {method.isDefault && (
            <View style={[styles.defaultBadge, { backgroundColor: theme.primary }]}>
              <Text style={styles.defaultText}>Default</Text>
            </View>
          )}
          <View style={[
            styles.radioButton,
            selectedMethodId === method.id && [styles.radioButtonSelected, { borderColor: theme.primary }]
          ]}>
            {selectedMethodId === method.id && (
              <View style={[styles.radioButtonInner, { backgroundColor: theme.primary }]} />
            )}
          </View>
        </View>
      </TouchableOpacity>
      
      <View style={styles.methodActions}>
        {!method.isDefault && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleSetDefault(method.id)}
          >
            <Text style={styles.actionButtonText}>Set as Default</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteMethod(method.id)}
        >
          <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderAddCardForm = () => (
    <Animated.View 
      style={[
        styles.addCardForm,
        {
          transform: [{
            translateY: slideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [300, 0],
            })
          }],
          opacity: slideAnim,
        }
      ]}
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>Add Payment Method</Text>
          <TouchableOpacity onPress={() => setShowAddCard(false)}>
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.formContent}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Card Number</Text>
            <TextInput
              style={styles.textInput}
              value={newCard.number}
              onChangeText={(text) => setNewCard(prev => ({ ...prev, number: formatCardNumber(text) }))}
              placeholder="1234 5678 9012 3456"
              keyboardType="numeric"
              maxLength={19}
            />
          </View>
          
          <View style={styles.inputRow}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
              <Text style={styles.inputLabel}>Expiry Date</Text>
              <TextInput
                style={styles.textInput}
                value={newCard.expiry}
                onChangeText={(text) => setNewCard(prev => ({ ...prev, expiry: formatExpiry(text) }))}
                placeholder="MM/YY"
                keyboardType="numeric"
                maxLength={5}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>CVC</Text>
              <TextInput
                style={styles.textInput}
                value={newCard.cvc}
                onChangeText={(text) => setNewCard(prev => ({ ...prev, cvc: text.replace(/\D/g, '') }))}
                placeholder="123"
                keyboardType="numeric"
                maxLength={4}
                secureTextEntry
              />
            </View>
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Cardholder Name</Text>
            <TextInput
              style={styles.textInput}
              value={newCard.name}
              onChangeText={(text) => setNewCard(prev => ({ ...prev, name: text }))}
              placeholder="John Doe"
              autoCapitalize="words"
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Nickname (Optional)</Text>
            <TextInput
              style={styles.textInput}
              value={newCard.nickname}
              onChangeText={(text) => setNewCard(prev => ({ ...prev, nickname: text }))}
              placeholder="Personal Card"
            />
          </View>
          
          <View style={styles.switchContainer}>
            <Text style={styles.switchLabel}>Save this card for future use</Text>
            <Switch
              value={newCard.saveCard}
              onValueChange={(value) => setNewCard(prev => ({ ...prev, saveCard: value }))}
              trackColor={{ false: '#E5E7EB', true: theme.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
        
        <TouchableOpacity 
          style={[styles.addCardButton, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
          onPress={handleAddCard}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.addCardButtonText}>Add Payment Method</Text>
          )}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Animated.View>
  );

  const renderBillingForm = () => (
    <View style={styles.billingForm}>
      <Text style={styles.sectionTitle}>Billing Address</Text>
      
      <View style={styles.inputRow}>
        <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
          <Text style={styles.inputLabel}>First Name</Text>
          <TextInput
            style={styles.textInput}
            value={billingAddress.firstName}
            onChangeText={(text) => setBillingAddress(prev => ({ ...prev, firstName: text }))}
            placeholder="John"
          />
        </View>
        <View style={[styles.inputGroup, { flex: 1 }]}>
          <Text style={styles.inputLabel}>Last Name</Text>
          <TextInput
            style={styles.textInput}
            value={billingAddress.lastName}
            onChangeText={(text) => setBillingAddress(prev => ({ ...prev, lastName: text }))}
            placeholder="Doe"
          />
        </View>
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Address Line 1</Text>
        <TextInput
          style={styles.textInput}
          value={billingAddress.addressLine1}
          onChangeText={(text) => setBillingAddress(prev => ({ ...prev, addressLine1: text }))}
          placeholder="123 Main Street"
        />
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Address Line 2 (Optional)</Text>
        <TextInput
          style={styles.textInput}
          value={billingAddress.addressLine2}
          onChangeText={(text) => setBillingAddress(prev => ({ ...prev, addressLine2: text }))}
          placeholder="Apartment, suite, etc."
        />
      </View>
      
      <View style={styles.inputRow}>
        <View style={[styles.inputGroup, { flex: 2, marginRight: 12 }]}>
          <Text style={styles.inputLabel}>City</Text>
          <TextInput
            style={styles.textInput}
            value={billingAddress.city}
            onChangeText={(text) => setBillingAddress(prev => ({ ...prev, city: text }))}
            placeholder="San Francisco"
          />
        </View>
        <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
          <Text style={styles.inputLabel}>State</Text>
          <TextInput
            style={styles.textInput}
            value={billingAddress.state}
            onChangeText={(text) => setBillingAddress(prev => ({ ...prev, state: text }))}
            placeholder="CA"
            maxLength={2}
          />
        </View>
        <View style={[styles.inputGroup, { flex: 1 }]}>
          <Text style={styles.inputLabel}>ZIP</Text>
          <TextInput
            style={styles.textInput}
            value={billingAddress.zipCode}
            onChangeText={(text) => setBillingAddress(prev => ({ ...prev, zipCode: text }))}
            placeholder="94102"
            keyboardType="numeric"
          />
        </View>
      </View>
      
      <View style={styles.switchContainer}>
        <Text style={styles.switchLabel}>Automatically save new payment methods</Text>
        <Switch
          value={autoSaveCards}
          onValueChange={setAutoSaveCards}
          trackColor={{ false: '#E5E7EB', true: theme.primary }}
          thumbColor="#FFFFFF"
        />
      </View>
    </View>
  );

  const renderPaymentHistory = () => (
    <View style={styles.historyContainer}>
      <Text style={styles.sectionTitle}>Payment History</Text>
      <View style={styles.emptyHistory}>
        <Ionicons name="receipt-outline" size={48} color="#D1D5DB" />
        <Text style={styles.emptyHistoryText}>No payment history yet</Text>
        <Text style={styles.emptyHistorySubtext}>
          Your payment history will appear here after you make your first booking.
        </Text>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading payment information...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment</Text>
        <View style={{ width: 24 }} />
      </View>

      {bookingTotal && (
        <View style={[styles.totalContainer, { backgroundColor: theme.primary }]}>
          <Text style={styles.totalLabel}>Total Amount</Text>
          <Text style={styles.totalAmount}>${bookingTotal.toFixed(2)}</Text>
        </View>
      )}

      {renderTabBar()}

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {activeTab === 'methods' && (
          <View style={styles.methodsContainer}>
            <View style={styles.methodsHeader}>
              <Text style={styles.sectionTitle}>Payment Methods</Text>
              <TouchableOpacity 
                style={[styles.addButton, { backgroundColor: theme.primaryLight }]}
                onPress={() => setShowAddCard(true)}
              >
                <Ionicons name="add" size={20} color={theme.primary} />
                <Text style={[styles.addButtonText, { color: theme.primary }]}>Add Method</Text>
              </TouchableOpacity>
            </View>
            
            {paymentMethods.length > 0 ? (
              paymentMethods.map(renderPaymentMethod)
            ) : (
              <View style={styles.emptyMethods}>
                <Ionicons name="card-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyMethodsText}>No payment methods</Text>
                <Text style={styles.emptyMethodsSubtext}>
                  Add a payment method to get started with bookings.
                </Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'billing' && renderBillingForm()}
        {activeTab === 'history' && renderPaymentHistory()}
      </ScrollView>

      {fromBooking && bookingTotal && selectedMethodId && (
        <View style={styles.bottomContainer}>
          <BlurView intensity={95} style={styles.bottomBlur}>
            <TouchableOpacity 
              style={[styles.processButton, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
              onPress={handleProcessPayment}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="shield-checkmark" size={20} color="#FFFFFF" />
                  <Text style={styles.processButtonText}>
                    Complete Payment • ${bookingTotal.toFixed(2)}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </BlurView>
        </View>
      )}

      {showAddCard && (
        <View style={styles.overlay}>
          <BlurView intensity={50} style={styles.overlayBlur}>
            <TouchableOpacity 
              style={styles.overlayTouchable}
              onPress={() => setShowAddCard(false)}
            />
            {renderAddCardForm()}
          </BlurView>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  totalContainer: {
    backgroundColor: '#0891b2', // Will be overridden dynamically
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#0891b2', // Will be overridden dynamically
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 6,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Roboto',
    letterSpacing: 0.5,
  },
  activeTabText: {
    color: '#0891b2', // Will be overridden dynamically
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Roboto',
    letterSpacing: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  methodsContainer: {
    padding: 20,
  },
  methodsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F7FA', // Will be overridden dynamically
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0891b2', // Will be overridden dynamically
    marginLeft: 6,
  },
  paymentMethodCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  methodSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  methodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#E0F7FA', // Will be overridden dynamically
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  methodInfo: {
    flex: 1,
  },
  methodProvider: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  methodDetails: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  methodNickname: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  methodRight: {
    alignItems: 'center',
  },
  defaultBadge: {
    backgroundColor: '#0891b2', // Will be overridden dynamically
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
  },
  defaultText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: '#0891b2', // Will be overridden dynamically
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#0891b2', // Will be overridden dynamically
  },
  methodActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
  },
  deleteButtonText: {
    color: '#DC2626',
  },
  emptyMethods: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyMethodsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMethodsSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  billingForm: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  inputRow: {
    flexDirection: 'row',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    flex: 1,
    marginRight: 16,
  },
  historyContainer: {
    padding: 20,
  },
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyHistoryText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyHistorySubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  bottomContainer: {
    height: 100,
  },
  bottomBlur: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
    justifyContent: 'center',
  },
  processButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0891b2', // Will be overridden dynamically
    borderRadius: 16,
    paddingVertical: 16,
    gap: 8,
    shadowColor: '#0891b2', // Will be overridden dynamically
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  processButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  overlayBlur: {
    flex: 1,
  },
  overlayTouchable: {
    flex: 1,
  },
  addCardForm: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  formContent: {
    marginBottom: 20,
  },
  addCardButton: {
    backgroundColor: '#0891b2', // Will be overridden dynamically
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0891b2', // Will be overridden dynamically
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addCardButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default PaymentScreen; 