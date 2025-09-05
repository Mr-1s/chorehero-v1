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
  Image,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../hooks/useAuth';
import { contentService } from '../../services/contentService';

type StackParamList = {
  ContentUploadWithPricing: undefined;
  VideoUpload: undefined;
};

type ContentUploadNavigationProp = StackNavigationProp<StackParamList, 'ContentUploadWithPricing'>;

interface ContentUploadProps {
  navigation: ContentUploadNavigationProp;
}

interface ServiceDetails {
  title: string;
  description: string;
  category: string;
  basePrice: string;
  duration: string;
  tags: string[];
  mediaType: 'video' | 'image';
  mediaUri: string;
}

const serviceCategories = [
  { id: 'deep_clean', name: 'Deep Clean', icon: 'sparkles', suggestedPrice: '120-180' },
  { id: 'standard_clean', name: 'Standard Clean', icon: 'home', suggestedPrice: '60-100' },
  { id: 'kitchen_clean', name: 'Kitchen Specialist', icon: 'restaurant', suggestedPrice: '80-120' },
  { id: 'bathroom_clean', name: 'Bathroom Clean', icon: 'water', suggestedPrice: '50-80' },
  { id: 'move_clean', name: 'Move-in/Move-out', icon: 'car', suggestedPrice: '150-250' },
  { id: 'eco_clean', name: 'Eco-Friendly', icon: 'leaf', suggestedPrice: '70-110' },
  { id: 'office_clean', name: 'Office Clean', icon: 'business', suggestedPrice: '90-140' },
  { id: 'post_construction', name: 'Post-Construction', icon: 'construct', suggestedPrice: '200-350' },
];

const popularTags = [
  'Professional', 'Before/After', 'Deep Clean', 'Fast Service', 'Eco-Friendly',
  'Kitchen', 'Bathroom', 'Living Room', 'Bedroom', 'Office'
];

const ContentUploadWithPricingScreen: React.FC<ContentUploadProps> = ({ navigation }) => {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [serviceDetails, setServiceDetails] = useState<ServiceDetails>({
    title: '',
    description: '',
    category: '',
    basePrice: '',
    duration: '',
    tags: [],
    mediaType: 'video',
    mediaUri: '',
  });

  const handleMediaCapture = async (type: 'camera' | 'library', mediaType: 'video' | 'image') => {
    try {
      let result;
      
      if (type === 'camera') {
        if (mediaType === 'video') {
          result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            allowsEditing: true,
            aspect: [9, 16],
            quality: 0.8,
            videoMaxDuration: 60,
          });
        } else {
          result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
          });
        }
      } else {
        if (mediaType === 'video') {
          result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            allowsEditing: true,
            aspect: [9, 16],
            quality: 0.8,
            videoMaxDuration: 60,
          });
        } else {
          result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
          });
        }
      }

      if (!result.canceled && result.assets[0]) {
        setServiceDetails(prev => ({
          ...prev,
          mediaType,
          mediaUri: result.assets[0].uri,
        }));
        setShowMediaPicker(false);
      }
    } catch (error) {
      console.error('Error capturing media:', error);
      Alert.alert('Error', 'Failed to capture media');
    }
  };

  const handleCategorySelect = (category: typeof serviceCategories[0]) => {
    setServiceDetails(prev => ({
      ...prev,
      category: category.id,
    }));
  };

  const handleTagToggle = (tag: string) => {
    setServiceDetails(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const validateForm = (): boolean => {
    if (!serviceDetails.title.trim()) {
      Alert.alert('Error', 'Please enter a service title');
      return false;
    }
    if (!serviceDetails.description.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return false;
    }
    if (!serviceDetails.category) {
      Alert.alert('Error', 'Please select a service category');
      return false;
    }
    if (!serviceDetails.basePrice || parseFloat(serviceDetails.basePrice) <= 0) {
      Alert.alert('Error', 'Please enter a valid price');
      return false;
    }
    if (!serviceDetails.duration || parseInt(serviceDetails.duration) <= 0) {
      Alert.alert('Error', 'Please enter service duration');
      return false;
    }
    if (!serviceDetails.mediaUri) {
      Alert.alert('Error', 'Please capture or select media');
      return false;
    }
    return true;
  };

  const handlePublish = async () => {
    if (!validateForm() || !user?.id) return;

    setIsUploading(true);
    try {
      // Create content post with pricing information
      const response = await contentService.createPost(user.id, {
        title: serviceDetails.title,
        description: serviceDetails.description,
        content_type: serviceDetails.mediaType,
        media_url: serviceDetails.mediaUri,
        status: 'published',
        tags: serviceDetails.tags,
        metadata: {
          service_category: serviceDetails.category,
          base_price: parseFloat(serviceDetails.basePrice),
          duration_minutes: parseInt(serviceDetails.duration),
          pricing_display: `$${serviceDetails.basePrice}`,
          duration_display: `${Math.floor(parseInt(serviceDetails.duration) / 60)}h ${parseInt(serviceDetails.duration) % 60}m`,
        },
      });

      if (response.success) {
        Alert.alert(
          'Published Successfully! 🎉',
          `Your ${serviceDetails.mediaType} has been published with pricing: $${serviceDetails.basePrice}`,
          [
            {
              text: 'View Content',
              onPress: () => navigation.navigate('VideoUpload'),
            },
            {
              text: 'Create Another',
              onPress: () => {
                setServiceDetails({
                  title: '',
                  description: '',
                  category: '',
                  basePrice: '',
                  duration: '',
                  tags: [],
                  mediaType: 'video',
                  mediaUri: '',
                });
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', response.error || 'Failed to publish content');
      }
    } catch (error) {
      console.error('Error publishing content:', error);
      Alert.alert('Error', 'Failed to publish content');
    } finally {
      setIsUploading(false);
    }
  };

  const selectedCategory = serviceCategories.find(cat => cat.id === serviceDetails.category);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Service Content</Text>
        <TouchableOpacity
          style={[styles.publishButton, !validateForm() && styles.publishButtonDisabled]}
          onPress={handlePublish}
          disabled={isUploading || !validateForm()}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.publishButtonText}>Publish</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Media Preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service Media</Text>
          <TouchableOpacity
            style={styles.mediaContainer}
            onPress={() => setShowMediaPicker(true)}
          >
            {serviceDetails.mediaUri ? (
              <View style={styles.mediaPreview}>
                {serviceDetails.mediaType === 'image' ? (
                  <Image source={{ uri: serviceDetails.mediaUri }} style={styles.mediaImage} />
                ) : (
                  <View style={styles.videoPlaceholder}>
                    <Ionicons name="play-circle" size={64} color="#3ad3db" />
                    <Text style={styles.videoPlaceholderText}>Video Selected</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.changeMediaButton}
                  onPress={() => setShowMediaPicker(true)}
                >
                  <Ionicons name="camera" size={20} color="white" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.emptyMedia}>
                <Ionicons name="camera-outline" size={48} color="#9CA3AF" />
                <Text style={styles.emptyMediaText}>Tap to capture service video or photo</Text>
                <Text style={styles.emptyMediaSubtext}>Show your work and attract customers</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Service Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service Information</Text>
          
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Service Title</Text>
            <TextInput
              style={styles.formInput}
              value={serviceDetails.title}
              onChangeText={(title) => setServiceDetails(prev => ({ ...prev, title }))}
              placeholder="e.g., Professional Kitchen Deep Clean"
              maxLength={100}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Description</Text>
            <TextInput
              style={[styles.formInput, styles.textArea]}
              value={serviceDetails.description}
              onChangeText={(description) => setServiceDetails(prev => ({ ...prev, description }))}
              placeholder="Describe your service, what's included, and what makes it special..."
              multiline
              numberOfLines={4}
              maxLength={500}
            />
          </View>

          {/* Category Selection */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Service Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {serviceCategories.map(category => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryCard,
                    serviceDetails.category === category.id && styles.categoryCardSelected
                  ]}
                  onPress={() => handleCategorySelect(category)}
                >
                  <Ionicons 
                    name={category.icon as any} 
                    size={24} 
                    color={serviceDetails.category === category.id ? 'white' : '#3ad3db'} 
                  />
                  <Text style={[
                    styles.categoryName,
                    serviceDetails.category === category.id && styles.categoryNameSelected
                  ]}>
                    {category.name}
                  </Text>
                  <Text style={[
                    styles.categorySuggestion,
                    serviceDetails.category === category.id && styles.categorySuggestionSelected
                  ]}>
                    ${category.suggestedPrice}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Pricing */}
          <View style={styles.formRow}>
            <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.formLabel}>
                Base Price ($) 
                {selectedCategory && (
                  <Text style={styles.suggestedPrice}> • Suggested: ${selectedCategory.suggestedPrice}</Text>
                )}
              </Text>
              <TextInput
                style={styles.formInput}
                value={serviceDetails.basePrice}
                onChangeText={(basePrice) => setServiceDetails(prev => ({ ...prev, basePrice }))}
                placeholder="85"
                keyboardType="decimal-pad"
              />
            </View>
            
            <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.formLabel}>Duration (minutes)</Text>
              <TextInput
                style={styles.formInput}
                value={serviceDetails.duration}
                onChangeText={(duration) => setServiceDetails(prev => ({ ...prev, duration }))}
                placeholder="120"
                keyboardType="number-pad"
              />
            </View>
          </View>

          {/* Tags */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Tags (Select up to 5)</Text>
            <View style={styles.tagsContainer}>
              {popularTags.map(tag => (
                <TouchableOpacity
                  key={tag}
                  style={[
                    styles.tagChip,
                    serviceDetails.tags.includes(tag) && styles.tagChipSelected
                  ]}
                  onPress={() => handleTagToggle(tag)}
                  disabled={serviceDetails.tags.length >= 5 && !serviceDetails.tags.includes(tag)}
                >
                  <Text style={[
                    styles.tagText,
                    serviceDetails.tags.includes(tag) && styles.tagTextSelected
                  ]}>
                    {tag}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Preview */}
        {serviceDetails.title && serviceDetails.basePrice && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preview</Text>
            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>{serviceDetails.title}</Text>
              <Text style={styles.previewDescription}>{serviceDetails.description}</Text>
              <View style={styles.previewMeta}>
                <Text style={styles.previewPrice}>${serviceDetails.basePrice}</Text>
                {serviceDetails.duration && (
                  <Text style={styles.previewDuration}>
                    • {Math.floor(parseInt(serviceDetails.duration) / 60)}h {parseInt(serviceDetails.duration) % 60}m
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Media Picker Modal */}
      <Modal
        visible={showMediaPicker}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowMediaPicker(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Media</Text>
            <View style={styles.placeholder} />
          </View>
          
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.mediaOption}
              onPress={() => handleMediaCapture('camera', 'video')}
            >
              <Ionicons name="videocam" size={32} color="#3ad3db" />
              <Text style={styles.mediaOptionText}>Record Video</Text>
              <Text style={styles.mediaOptionSubtext}>Show your cleaning process</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.mediaOption}
              onPress={() => handleMediaCapture('camera', 'image')}
            >
              <Ionicons name="camera" size={32} color="#3ad3db" />
              <Text style={styles.mediaOptionText}>Take Photo</Text>
              <Text style={styles.mediaOptionSubtext}>Before/after shots</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.mediaOption}
              onPress={() => handleMediaCapture('library', 'video')}
            >
              <Ionicons name="film" size={32} color="#3ad3db" />
              <Text style={styles.mediaOptionText}>Choose Video</Text>
              <Text style={styles.mediaOptionSubtext}>From your library</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.mediaOption}
              onPress={() => handleMediaCapture('library', 'image')}
            >
              <Ionicons name="images" size={32} color="#3ad3db" />
              <Text style={styles.mediaOptionText}>Choose Photo</Text>
              <Text style={styles.mediaOptionSubtext}>From your library</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
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
  publishButton: {
    backgroundColor: '#3ad3db',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  publishButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 20,
    backgroundColor: 'white',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  mediaContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  mediaPreview: {
    position: 'relative',
    height: 200,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  videoPlaceholderText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 8,
  },
  changeMediaButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyMedia: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyMediaText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
  },
  emptyMediaSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 4,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  suggestedPrice: {
    fontSize: 14,
    color: '#3ad3db',
    fontWeight: '400',
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  formRow: {
    flexDirection: 'row',
  },
  categoryScroll: {
    flexDirection: 'row',
  },
  categoryCard: {
    alignItems: 'center',
    padding: 16,
    marginRight: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: 'white',
    minWidth: 100,
  },
  categoryCardSelected: {
    borderColor: '#3ad3db',
    backgroundColor: '#3ad3db',
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1F2937',
    marginTop: 8,
    textAlign: 'center',
  },
  categoryNameSelected: {
    color: 'white',
  },
  categorySuggestion: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  categorySuggestionSelected: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tagChipSelected: {
    backgroundColor: '#3ad3db',
    borderColor: '#3ad3db',
  },
  tagText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  tagTextSelected: {
    color: 'white',
  },
  previewCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  previewDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  previewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3ad3db',
  },
  previewDuration: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalCancel: {
    fontSize: 16,
    color: '#6B7280',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  placeholder: {
    width: 60,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  mediaOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  mediaOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 16,
    flex: 1,
  },
  mediaOptionSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 16,
  },
});

export default ContentUploadWithPricingScreen;
