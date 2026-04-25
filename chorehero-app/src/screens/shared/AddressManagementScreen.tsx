import React, { useState, useEffect } from 'react';
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
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabase';
import { geocodeMailingAddress } from '../../services/addressGeocoding';
import { wp, hp } from '../../utils/responsive';

type StackParamList = {
  AddressManagementScreen: undefined;
  Profile: undefined;
};

type AddressManagementScreenProps = {
  navigation: StackNavigationProp<StackParamList, 'AddressManagementScreen'>;
};

interface Address {
  id?: string;
  street: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  nickname?: string;
  access_instructions?: string;
  is_default: boolean;
}

const AddressManagementScreen: React.FC<AddressManagementScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [newAddress, setNewAddress] = useState<Address>({
    street: '',
    city: '',
    state: '',
    zip_code: '',
    country: 'US',
    nickname: '',
    access_instructions: '',
    is_default: false,
  });

  useEffect(() => {
    loadAddresses();
  }, []);

  const loadAddresses = async () => {
    try {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      setAddresses(data || []);
    } catch (error) {
      console.error('Error loading addresses:', error);
      Alert.alert('Error', 'Failed to load addresses');
    } finally {
      setIsLoading(false);
    }
  };

  const saveAddress = async () => {
    try {
      if (!user?.id) return;

      // Validate required fields
      if (!newAddress.street.trim() || !newAddress.city.trim() || 
          !newAddress.state.trim() || !newAddress.zip_code.trim()) {
        Alert.alert('Error', 'Please fill in all required fields');
        return;
      }

      // If setting as default, unset other defaults first
      if (newAddress.is_default) {
        await supabase
          .from('addresses')
          .update({ is_default: false })
          .eq('user_id', user.id);
      }

      const street = newAddress.street.trim();
      const city = newAddress.city.trim();
      const state = newAddress.state.trim();
      const zip_code = newAddress.zip_code.trim();

      const geo = await geocodeMailingAddress({
        street,
        city,
        state,
        zip_code,
        country: newAddress.country || 'US',
      });

      const addressData = {
        user_id: user.id,
        street,
        city,
        state,
        zip_code,
        country: newAddress.country,
        nickname: newAddress.nickname?.trim() || null,
        access_instructions: newAddress.access_instructions?.trim() || null,
        is_default: newAddress.is_default,
        ...(geo ? { latitude: geo.latitude, longitude: geo.longitude } : {}),
      };

      if (editingAddress?.id) {
        // Update existing address
        const { error } = await supabase
          .from('addresses')
          .update(addressData)
          .eq('id', editingAddress.id);

        if (error) throw error;
      } else {
        // Create new address
        const { error } = await supabase
          .from('addresses')
          .insert(addressData);

        if (error) throw error;
      }

      // Reset form and reload
      setNewAddress({
        street: '',
        city: '',
        state: '',
        zip_code: '',
        country: 'US',
        nickname: '',
        access_instructions: '',
        is_default: false,
      });
      setEditingAddress(null);
      setShowAddModal(false);
      loadAddresses();

      Alert.alert('Success', `Address ${editingAddress ? 'updated' : 'added'} successfully`);
    } catch (error) {
      console.error('Error saving address:', error);
      Alert.alert('Error', 'Failed to save address');
    }
  };

  const deleteAddress = async (addressId: string) => {
    Alert.alert(
      'Delete Address',
      'Are you sure you want to delete this address?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('addresses')
                .delete()
                .eq('id', addressId);

              if (error) throw error;

              loadAddresses();
              Alert.alert('Success', 'Address deleted successfully');
            } catch (error) {
              console.error('Error deleting address:', error);
              Alert.alert('Error', 'Failed to delete address');
            }
          },
        },
      ]
    );
  };

  const setDefaultAddress = async (addressId: string) => {
    try {
      if (!user?.id) return;

      // Unset all defaults first
      await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', user.id);

      // Set new default
      const { error } = await supabase
        .from('addresses')
        .update({ is_default: true })
        .eq('id', addressId);

      if (error) throw error;

      loadAddresses();
      Alert.alert('Success', 'Default address updated');
    } catch (error) {
      console.error('Error setting default address:', error);
      Alert.alert('Error', 'Failed to update default address');
    }
  };

  const openAddModal = () => {
    setEditingAddress(null);
    setNewAddress({
      street: '',
      city: '',
      state: '',
      zip_code: '',
      country: 'US',
      nickname: '',
      access_instructions: '',
      is_default: false,
    });
    setShowAddModal(true);
  };

  const openEditModal = (address: Address) => {
    setEditingAddress(address);
    setNewAddress({ ...address });
    setShowAddModal(true);
  };

  const renderAddressCard = (address: Address) => (
    <View key={address.id} style={styles.addressCard}>
      <View style={styles.addressHeader}>
        <View style={styles.addressTitleRow}>
          <Text style={styles.addressNickname}>
            {address.nickname || 'Home Address'}
          </Text>
          {address.is_default && (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultBadgeText}>Default</Text>
            </View>
          )}
        </View>
        <View style={styles.addressActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => openEditModal(address)}
          >
            <Ionicons name="pencil" size={16} color="#6B7280" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => deleteAddress(address.id!)}
          >
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.addressText}>
        {address.street}
      </Text>
      <Text style={styles.addressText}>
        {address.city}, {address.state} {address.zip_code}
      </Text>

      {address.access_instructions && (
        <Text style={styles.accessInstructions}>
          📝 {address.access_instructions}
        </Text>
      )}

      {!address.is_default && (
        <TouchableOpacity
          style={styles.setDefaultButton}
          onPress={() => setDefaultAddress(address.id!)}
        >
          <Text style={styles.setDefaultButtonText}>Set as Default</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderInput = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder?: string,
    multiline?: boolean
  ) => (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multilineInput]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#26B7C9" />
          <Text style={styles.loadingText}>Loading addresses...</Text>
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
        <Text style={styles.headerTitle}>Manage Addresses</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={openAddModal}
        >
          <Ionicons name="add" size={24} color="#26B7C9" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {addresses.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="location-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyStateTitle}>No addresses added</Text>
            <Text style={styles.emptyStateText}>
              Add your first address to make booking easier
            </Text>
          </View>
        ) : (
          addresses.map(renderAddressCard)
        )}
      </ScrollView>

      {/* Add/Edit Address Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowAddModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingAddress ? 'Edit Address' : 'Add Address'}
            </Text>
            <TouchableOpacity
              style={styles.modalSaveButton}
              onPress={saveAddress}
            >
              <Text style={styles.modalSaveText}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScrollView}>
            {renderInput(
              'Nickname (Optional)',
              newAddress.nickname || '',
              (text) => setNewAddress(prev => ({ ...prev, nickname: text })),
              'Home, Work, etc.'
            )}

            {renderInput(
              'Street Address *',
              newAddress.street,
              (text) => setNewAddress(prev => ({ ...prev, street: text })),
              '123 Main Street'
            )}

            <View style={styles.inputRow}>
              <View style={styles.inputHalf}>
                {renderInput(
                  'City *',
                  newAddress.city,
                  (text) => setNewAddress(prev => ({ ...prev, city: text })),
                  'San Francisco'
                )}
              </View>
              <View style={styles.inputHalf}>
                {renderInput(
                  'State *',
                  newAddress.state,
                  (text) => setNewAddress(prev => ({ ...prev, state: text })),
                  'CA'
                )}
              </View>
            </View>

            {renderInput(
              'ZIP Code *',
              newAddress.zip_code,
              (text) => setNewAddress(prev => ({ ...prev, zip_code: text })),
              '94102'
            )}

            {renderInput(
              'Access Instructions (Optional)',
              newAddress.access_instructions || '',
              (text) => setNewAddress(prev => ({ ...prev, access_instructions: text })),
              'Buzzer code, parking instructions, etc.',
              true
            )}

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setNewAddress(prev => ({ ...prev, is_default: !prev.is_default }))}
            >
              <View style={[styles.checkbox, newAddress.is_default && styles.checkboxChecked]}>
                {newAddress.is_default && (
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                )}
              </View>
              <Text style={styles.checkboxLabel}>Set as default address</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: hp('1.5%'),
    fontSize: wp('4%'),
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('2%'),
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: wp('5.5%'),
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: '#1F2937',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: wp('5.5%'),
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('10%'),
  },
  emptyStateTitle: {
    fontSize: wp('5%'),
    fontWeight: '600',
    color: '#374151',
    marginTop: hp('2%'),
    marginBottom: hp('1%'),
  },
  emptyStateText: {
    fontSize: wp('4%'),
    color: '#6B7280',
    textAlign: 'center',
  },
  addressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: wp('3%'),
    padding: 16,
    marginBottom: hp('2%'),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: hp('1.5%'),
  },
  addressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  addressNickname: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#1F2937',
    marginRight: 8,
  },
  defaultBadge: {
    backgroundColor: '#26B7C9',
    paddingHorizontal: wp('2%'),
    paddingVertical: hp('0.5%'),
    borderRadius: wp('3%'),
  },
  defaultBadgeText: {
    fontSize: wp('3%'),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addressActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  addressText: {
    fontSize: wp('3.5%'),
    color: '#6B7280',
    marginBottom: hp('0.5%'),
  },
  accessInstructions: {
    fontSize: wp('3.5%'),
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: hp('1%'),
  },
  setDefaultButton: {
    marginTop: hp('1.5%'),
    paddingVertical: hp('1%'),
    paddingHorizontal: wp('4%'),
    backgroundColor: '#F3F4F6',
    borderRadius: wp('2%'),
    alignSelf: 'flex-start',
  },
  setDefaultButtonText: {
    fontSize: wp('3.5%'),
    fontWeight: '500',
    color: '#374151',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('2%'),
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalCancelButton: {
    padding: 8,
  },
  modalCancelText: {
    fontSize: wp('4%'),
    color: '#6B7280',
  },
  modalTitle: {
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: '#1F2937',
  },
  modalSaveButton: {
    padding: 8,
  },
  modalSaveText: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#26B7C9',
  },
  modalScrollView: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: hp('2.5%'),
  },
  inputLabel: {
    fontSize: wp('3.5%'),
    fontWeight: '600',
    color: '#374151',
    marginBottom: hp('1%'),
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: wp('3%'),
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.5%'),
    fontSize: wp('4%'),
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputHalf: {
    width: '48%',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: hp('1%'),
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: wp('1.5%'),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#26B7C9',
    borderColor: '#26B7C9',
  },
  checkboxLabel: {
    fontSize: wp('4%'),
    color: '#374151',
  },
});

export default AddressManagementScreen;