import React, { useState, useRef } from 'react';
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
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../hooks/useAuth';
import { contentService } from '../../services/contentService';
import { COLORS } from '../../utils/constants';
import { ContentType, ContentUploadProgress } from '../../types/content';
import CleanerFloatingNavigation from '../../components/CleanerFloatingNavigation';

type StackParamList = {
  ContentCreation: undefined;
  CleanerProfile: undefined;
  ContentFeed: undefined;
};

type ContentCreationNavigationProp = StackNavigationProp<StackParamList, 'ContentCreation'>;

interface ContentCreationProps {
  navigation: ContentCreationNavigationProp;
}

const ContentCreationScreen: React.FC<ContentCreationProps> = ({ navigation }) => {
  const { user } = useAuth();
  const [contentType, setContentType] = useState<ContentType>('video');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [secondaryMediaUri, setSecondaryMediaUri] = useState<string | null>(null); // For before/after
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationName, setLocationName] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<ContentUploadProgress | null>(null);
  const [isPosting, setIsPosting] = useState(false);

  const videoRef = useRef<Video>(null);

  // Predefined tag suggestions
  const suggestedTags = [
    'deep-clean', 'kitchen', 'bathroom', 'living-room', 'bedroom',
    'before-after', 'eco-friendly', 'organization', 'declutter',
    'move-in', 'move-out', 'spring-cleaning', 'holiday-prep'
  ];

  const handleMediaPicker = async (type: 'camera' | 'library') => {
    try {
      let result;
      
      if (type === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Camera permission is required to take photos/videos.');
          return;
        }

        result = await ImagePicker.launchCameraAsync({
          mediaTypes: contentType === 'video' ? ImagePicker.MediaTypeOptions.Videos : ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
          videoMaxDuration: contentType === 'video' ? 60 : undefined,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: contentType === 'video' ? ImagePicker.MediaTypeOptions.Videos : ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
          videoMaxDuration: contentType === 'video' ? 60 : undefined,
        });
      }

      if (!result.canceled && result.assets[0]) {
        setMediaUri(result.assets[0].uri);
        
        // Auto-generate title based on content type
        if (!title) {
          const defaultTitle = contentType === 'video' 
            ? 'My Cleaning Process' 
            : 'Before & After Transformation';
          setTitle(defaultTitle);
        }
      }
    } catch (error) {
      console.error('Media picker error:', error);
      Alert.alert('Error', 'Failed to select media. Please try again.');
    }
  };

  const handleSecondaryMediaPicker = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSecondaryMediaUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Secondary media picker error:', error);
    }
  };

  const addTag = (tag: string) => {
    const cleanTag = tag.toLowerCase().trim();
    if (cleanTag && !tags.includes(cleanTag) && tags.length < 10) {
      setTags([...tags, cleanTag]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleTagInputSubmit = () => {
    if (tagInput.trim()) {
      addTag(tagInput);
    }
  };

  const uploadMedia = async (): Promise<{ mediaUrl?: string; thumbnailUrl?: string; secondaryUrl?: string }> => {
    if (!mediaUri) return {};

    try {
      setIsUploading(true);
      
      // Upload primary media
      const primaryUpload = await contentService.uploadContentMedia(
        mediaUri,
        contentType === 'before_after' ? 'image' : contentType,
        user?.id || 'anonymous',
        (progress) => {
          setUploadProgress(progress);
        }
      );

      if (!primaryUpload.success) {
        throw new Error(primaryUpload.error || 'Upload failed');
      }

      let secondaryUrl = undefined;
      
      // Upload secondary media for before/after posts
      if (contentType === 'before_after' && secondaryMediaUri) {
        const secondaryUpload = await contentService.uploadContentMedia(
          secondaryMediaUri,
          'image',
          user?.id || 'anonymous'
        );

        if (secondaryUpload.success) {
          secondaryUrl = secondaryUpload.media_url;
        }
      }

      return {
        mediaUrl: primaryUpload.media_url,
        thumbnailUrl: primaryUpload.thumbnail_url,
        secondaryUrl
      };
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const handlePost = async () => {
    if (!user || !mediaUri || !title.trim()) {
      Alert.alert('Missing Information', 'Please add a title and select media to post.');
      return;
    }

    try {
      setIsPosting(true);

      // Upload media first
      const uploadResult = await uploadMedia();
      
      if (!uploadResult.mediaUrl) {
        throw new Error('Media upload failed');
      }

      // Create the post
      const postData = {
        title: title.trim(),
        description: description.trim() || undefined,
        content_type: contentType,
        media_url: uploadResult.mediaUrl,
        thumbnail_url: uploadResult.thumbnailUrl,
        secondary_media_url: uploadResult.secondaryUrl,
        location_name: locationName.trim() || undefined,
        tags: tags,
        status: 'published' as const
      };

      const result = await contentService.createPost(user.id, postData);

      if (result.success) {
        Alert.alert(
          'Post Created! 🎉',
          'Your content has been posted successfully and is now live.',
          [
            {
              text: 'View Post',
              onPress: () => navigation.navigate('ContentFeed')
            },
            {
              text: 'Create Another',
              onPress: () => {
                // Reset form
                setMediaUri(null);
                setSecondaryMediaUri(null);
                setTitle('');
                setDescription('');
                setLocationName('');
                setTags([]);
                setTagInput('');
              }
            }
          ]
        );
      } else {
        throw new Error(result.error || 'Failed to create post');
      }
    } catch (error) {
      console.error('Post creation error:', error);
      Alert.alert(
        'Post Failed',
        error instanceof Error ? error.message : 'Failed to create post. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsPosting(false);
    }
  };

  const renderMediaPreview = () => {
    if (!mediaUri) return null;

    return (
      <View style={styles.mediaPreview}>
        {contentType === 'video' ? (
          <Video
            ref={videoRef}
            source={{ uri: mediaUri }}
            style={styles.videoPreview}
            useNativeControls
            resizeMode={"cover" as any}
            shouldPlay={false}
          />
        ) : (
          <Image source={{ uri: mediaUri }} style={styles.imagePreview} />
        )}
        
        {contentType === 'before_after' && (
          <View style={styles.beforeAfterContainer}>
            <Text style={styles.beforeAfterLabel}>Before</Text>
            <TouchableOpacity 
              style={styles.addAfterButton}
              onPress={handleSecondaryMediaPicker}
            >
              {secondaryMediaUri ? (
                <Image source={{ uri: secondaryMediaUri }} style={styles.afterImage} />
              ) : (
                <View style={styles.addAfterPlaceholder}>
                  <Ionicons name="add" size={32} color={COLORS.text.secondary} />
                  <Text style={styles.addAfterText}>Add After Photo</Text>
                </View>
              )}
            </TouchableOpacity>
            {secondaryMediaUri && <Text style={styles.beforeAfterLabel}>After</Text>}
          </View>
        )}

        <TouchableOpacity 
          style={styles.changeMediaButton}
          onPress={() => setMediaUri(null)}
        >
          <Ionicons name="close" size={20} color={COLORS.text.inverse} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderUploadProgress = () => {
    if (!uploadProgress || !isUploading) return null;

    return (
      <View style={styles.uploadProgressContainer}>
        <View style={styles.uploadProgressHeader}>
          <Text style={styles.uploadProgressTitle}>Uploading...</Text>
          <Text style={styles.uploadProgressPercent}>{Math.round(uploadProgress.progress)}%</Text>
        </View>
        <View style={styles.uploadProgressBar}>
          <View 
            style={[
              styles.uploadProgressFill, 
              { width: `${uploadProgress.progress}%` }
            ]} 
          />
        </View>
        <Text style={styles.uploadProgressStage}>
          {uploadProgress.stage === 'uploading' && 'Uploading media...'}
          {uploadProgress.stage === 'processing' && 'Processing...'}
          {uploadProgress.stage === 'generating_thumbnail' && 'Generating thumbnail...'}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Post</Text>
        <TouchableOpacity 
          style={[
            styles.postButton,
            (!mediaUri || !title.trim() || isUploading || isPosting) && styles.postButtonDisabled
          ]}
          onPress={handlePost}
          disabled={!mediaUri || !title.trim() || isUploading || isPosting}
        >
          {isPosting ? (
            <ActivityIndicator size="small" color={COLORS.text.inverse} />
          ) : (
            <Text style={styles.postButtonText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Content Type Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Content Type</Text>
            <View style={styles.contentTypeSelector}>
              {(['video', 'image', 'before_after'] as ContentType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.contentTypeButton,
                    contentType === type && styles.contentTypeButtonActive
                  ]}
                  onPress={() => {
                    setContentType(type);
                    setMediaUri(null);
                    setSecondaryMediaUri(null);
                  }}
                >
                  <Ionicons 
                    name={
                      type === 'video' ? 'videocam' : 
                      type === 'image' ? 'image' : 'images'
                    } 
                    size={20} 
                    color={contentType === type ? COLORS.text.inverse : COLORS.text.secondary} 
                  />
                  <Text style={[
                    styles.contentTypeText,
                    contentType === type && styles.contentTypeTextActive
                  ]}>
                    {type === 'video' ? 'Video' : 
                     type === 'image' ? 'Photo' : 'Before/After'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Media Upload */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {contentType === 'video' ? 'Video' : 'Photo'}
            </Text>
            
            {mediaUri ? (
              renderMediaPreview()
            ) : (
              <View style={styles.mediaUploadContainer}>
                <TouchableOpacity 
                  style={styles.mediaUploadButton}
                  onPress={() => handleMediaPicker('camera')}
                >
                  <Ionicons name="camera" size={32} color={COLORS.primary} />
                  <Text style={styles.mediaUploadText}>
                    {contentType === 'video' ? 'Record Video' : 'Take Photo'}
                  </Text>
                </TouchableOpacity>
                
                <View style={styles.mediaUploadDivider}>
                  <Text style={styles.mediaUploadDividerText}>or</Text>
                </View>
                
                <TouchableOpacity 
                  style={styles.mediaUploadButton}
                  onPress={() => handleMediaPicker('library')}
                >
                  <Ionicons name="folder" size={32} color={COLORS.primary} />
                  <Text style={styles.mediaUploadText}>
                    Choose from Library
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {renderUploadProgress()}
          </View>

          {/* Post Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Post Details</Text>
            
            <TextInput
              style={styles.titleInput}
              placeholder="Add a catchy title..."
              value={title}
              onChangeText={setTitle}
              maxLength={100}
              multiline={false}
            />
            
            <TextInput
              style={styles.descriptionInput}
              placeholder="Describe your cleaning process, tips, or story..."
              value={description}
              onChangeText={setDescription}
              maxLength={500}
              multiline
              numberOfLines={4}
            />

            <TextInput
              style={styles.locationInput}
              placeholder="Location (e.g., Kitchen, Bathroom, Living Room)"
              value={locationName}
              onChangeText={setLocationName}
              maxLength={50}
            />
          </View>

          {/* Tags */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tags</Text>
            <Text style={styles.sectionSubtitle}>
              Help others discover your content
            </Text>

            {/* Current Tags */}
            {tags.length > 0 && (
              <View style={styles.currentTags}>
                {tags.map((tag, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.tag}
                    onPress={() => removeTag(tag)}
                  >
                    <Text style={styles.tagText}>{tag}</Text>
                    <Ionicons name="close" size={16} color={COLORS.text.inverse} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Tag Input */}
            <View style={styles.tagInputContainer}>
              <TextInput
                style={styles.tagInput}
                placeholder="Add a tag..."
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={handleTagInputSubmit}
                maxLength={20}
              />
              <TouchableOpacity 
                style={styles.addTagButton}
                onPress={handleTagInputSubmit}
              >
                <Ionicons name="add" size={20} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            {/* Suggested Tags */}
            <Text style={styles.suggestedTagsTitle}>Suggested:</Text>
            <View style={styles.suggestedTags}>
              {suggestedTags
                .filter(tag => !tags.includes(tag))
                .slice(0, 6)
                .map((tag, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.suggestedTag}
                    onPress={() => addTag(tag)}
                  >
                    <Text style={styles.suggestedTagText}>{tag}</Text>
                  </TouchableOpacity>
                ))}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      
      {/* Show cleaner navigation if user is a cleaner */}
      {user?.role === 'cleaner' && (
        <CleanerFloatingNavigation navigation={navigation as any} currentScreen="Content" unreadCount={3} />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  postButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  postButtonDisabled: {
    backgroundColor: COLORS.text.disabled,
  },
  postButtonText: {
    color: COLORS.text.inverse,
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginBottom: 12,
  },
  
  // Content Type Selector
  contentTypeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  contentTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  contentTypeButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  contentTypeText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text.secondary,
  },
  contentTypeTextActive: {
    color: COLORS.text.inverse,
  },

  // Media Upload
  mediaUploadContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  mediaUploadButton: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
  },
  mediaUploadText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text.primary,
  },
  mediaUploadDivider: {
    marginVertical: 8,
  },
  mediaUploadDividerText: {
    fontSize: 14,
    color: COLORS.text.secondary,
  },

  // Media Preview
  mediaPreview: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  videoPreview: {
    width: '100%',
    height: 200,
    backgroundColor: COLORS.surface,
  },
  imagePreview: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  beforeAfterContainer: {
    marginTop: 12,
    gap: 8,
  },
  beforeAfterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  addAfterButton: {
    height: 120,
    borderRadius: 8,
    overflow: 'hidden',
  },
  afterImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  addAfterPlaceholder: {
    flex: 1,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    gap: 4,
  },
  addAfterText: {
    fontSize: 12,
    color: COLORS.text.secondary,
  },
  changeMediaButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    padding: 8,
  },

  // Upload Progress
  uploadProgressContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
  },
  uploadProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  uploadProgressTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text.primary,
  },
  uploadProgressPercent: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  uploadProgressBar: {
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    marginBottom: 8,
  },
  uploadProgressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  uploadProgressStage: {
    fontSize: 12,
    color: COLORS.text.secondary,
  },

  // Form Inputs
  titleInput: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text.primary,
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  descriptionInput: {
    fontSize: 14,
    color: COLORS.text.primary,
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  locationInput: {
    fontSize: 14,
    color: COLORS.text.primary,
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  // Tags
  currentTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.text.inverse,
  },
  tagInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  tagInput: {
    flex: 1,
    padding: 12,
    fontSize: 14,
    color: COLORS.text.primary,
  },
  addTagButton: {
    padding: 12,
  },
  suggestedTagsTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.text.secondary,
    marginBottom: 8,
  },
  suggestedTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestedTag: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  suggestedTagText: {
    fontSize: 12,
    color: COLORS.text.secondary,
  },
});

export default ContentCreationScreen; 