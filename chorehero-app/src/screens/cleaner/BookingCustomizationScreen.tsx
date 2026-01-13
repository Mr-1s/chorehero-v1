import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import CleanerFloatingNavigation from '../../components/CleanerFloatingNavigation';
import { bookingTemplateService, CustomBookingQuestion, BookingTemplate } from '../../services/bookingTemplateService';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/Toast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type BookingCustomizationNavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: BookingCustomizationNavigationProp;
}

const QUESTION_TYPES = [
  { id: 'text', label: 'Short Answer', icon: 'text-outline' },
  { id: 'textarea', label: 'Long Answer', icon: 'document-text-outline' },
  { id: 'single_choice', label: 'Multiple Choice', icon: 'radio-button-on-outline' },
  { id: 'yes_no', label: 'Yes/No', icon: 'toggle-outline' },
  { id: 'number', label: 'Number', icon: 'calculator-outline' },
];

const SUGGESTED_QUESTIONS = [
  { text: 'Do you have any pets?', type: 'yes_no' },
  { text: 'What areas would you like us to focus on?', type: 'textarea' },
  { text: 'Are there any areas we should avoid?', type: 'textarea' },
  { text: 'Do you have any allergies to cleaning products?', type: 'yes_no' },
  { text: 'How many bedrooms need cleaning?', type: 'number' },
  { text: 'How many bathrooms need cleaning?', type: 'number' },
  { text: 'What type of flooring do you have?', type: 'single_choice', options: ['Hardwood', 'Carpet', 'Tile', 'Mixed'] },
  { text: 'Do you have your own cleaning supplies?', type: 'single_choice', options: ['Yes, use mine', 'No, bring yours', 'Either is fine'] },
  { text: 'Any special instructions for entry?', type: 'textarea' },
];

const BookingCustomizationScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [template, setTemplate] = useState<BookingTemplate | null>(null);
  const [questions, setQuestions] = useState<CustomBookingQuestion[]>([]);
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
  
  // New question form
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionType, setNewQuestionType] = useState<string>('text');
  const [newQuestionRequired, setNewQuestionRequired] = useState(false);
  const [newQuestionOptions, setNewQuestionOptions] = useState<string[]>(['']);
  const [editingQuestion, setEditingQuestion] = useState<CustomBookingQuestion | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      // Get or create default template
      let currentTemplate = await bookingTemplateService.getActiveTemplate(user.id);
      
      if (!currentTemplate) {
        // Create default template
        currentTemplate = await bookingTemplateService.createTemplate(user.id, {
          name: 'My Booking Flow',
          description: 'Customize questions customers see when booking',
          is_default: true,
        });
      }
      
      if (currentTemplate) {
        setTemplate(currentTemplate);
        // Load questions for this template
        const templateQuestions = await bookingTemplateService.getTemplateQuestions(currentTemplate.id);
        setQuestions(templateQuestions);
      }
    } catch (error) {
      console.error('Error loading booking customization:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddQuestion = async () => {
    if (!template || !newQuestionText.trim()) return;
    
    setIsSaving(true);
    try {
      const newQuestion = await bookingTemplateService.addQuestion(template.id, {
        question_text: newQuestionText.trim(),
        question_type: newQuestionType as any,
        is_required: newQuestionRequired,
        sort_order: questions.length,
        options: newQuestionType === 'single_choice' ? newQuestionOptions.filter(o => o.trim()) : undefined,
      });
      
      if (newQuestion) {
        setQuestions(prev => [...prev, newQuestion]);
        showToast({ type: 'success', message: 'Question added!' });
        resetQuestionForm();
        setShowAddQuestionModal(false);
      }
    } catch (error) {
      console.error('Error adding question:', error);
      showToast({ type: 'error', message: 'Failed to add question' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteQuestion = (questionId: string) => {
    Alert.alert(
      'Delete Question',
      'Are you sure you want to remove this question from your booking form?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await bookingTemplateService.deleteQuestion(questionId);
              setQuestions(prev => prev.filter(q => q.id !== questionId));
              showToast({ type: 'success', message: 'Question removed' });
            } catch (error) {
              showToast({ type: 'error', message: 'Failed to delete question' });
            }
          },
        },
      ]
    );
  };

  const handleAddSuggestedQuestion = async (suggestion: any) => {
    if (!template) return;
    
    try {
      const newQuestion = await bookingTemplateService.addQuestion(template.id, {
        question_text: suggestion.text,
        question_type: suggestion.type,
        is_required: false,
        sort_order: questions.length,
        options: suggestion.options,
      });
      
      if (newQuestion) {
        setQuestions(prev => [...prev, newQuestion]);
        showToast({ type: 'success', message: 'Question added!' });
      }
    } catch (error) {
      showToast({ type: 'error', message: 'Failed to add question' });
    }
  };

  const resetQuestionForm = () => {
    setNewQuestionText('');
    setNewQuestionType('text');
    setNewQuestionRequired(false);
    setNewQuestionOptions(['']);
    setEditingQuestion(null);
  };

  const getQuestionTypeIcon = (type: string) => {
    const typeInfo = QUESTION_TYPES.find(t => t.id === type);
    return typeInfo?.icon || 'help-circle-outline';
  };

  const getQuestionTypeLabel = (type: string) => {
    const typeInfo = QUESTION_TYPES.find(t => t.id === type);
    return typeInfo?.label || type;
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text style={styles.loadingText}>Loading your booking settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Customization</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Introduction */}
        <View style={styles.introCard}>
          <View style={styles.introIcon}>
            <Ionicons name="settings-outline" size={28} color="#F59E0B" />
          </View>
          <Text style={styles.introTitle}>Customize Your Booking Flow</Text>
          <Text style={styles.introText}>
            Add custom questions to learn more about your customers before each job. 
            This helps you prepare and provide better service!
          </Text>
        </View>

        {/* Questions Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Custom Questions</Text>
            <Text style={styles.sectionSubtitle}>
              {questions.length} question{questions.length !== 1 ? 's' : ''} added
            </Text>
          </View>

          {questions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="help-circle-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No custom questions yet</Text>
              <Text style={styles.emptyText}>
                Add questions to gather important info from customers
              </Text>
            </View>
          ) : (
            questions.map((question, index) => (
              <View key={question.id} style={styles.questionCard}>
                <View style={styles.questionHeader}>
                  <View style={styles.questionNumber}>
                    <Text style={styles.questionNumberText}>{index + 1}</Text>
                  </View>
                  <View style={styles.questionContent}>
                    <Text style={styles.questionText}>{question.question_text}</Text>
                    <View style={styles.questionMeta}>
                      <View style={styles.questionTypeBadge}>
                        <Ionicons 
                          name={getQuestionTypeIcon(question.question_type) as any} 
                          size={12} 
                          color="#6B7280" 
                        />
                        <Text style={styles.questionTypeText}>
                          {getQuestionTypeLabel(question.question_type)}
                        </Text>
                      </View>
                      {question.is_required && (
                        <View style={styles.requiredBadge}>
                          <Text style={styles.requiredText}>Required</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={styles.deleteButton}
                    onPress={() => handleDeleteQuestion(question.id)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => setShowAddQuestionModal(true)}
          >
            <Ionicons name="add-circle" size={22} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Create Custom Question</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.suggestButton}
            onPress={() => setShowSuggestionsModal(true)}
          >
            <Ionicons name="bulb-outline" size={22} color="#F59E0B" />
            <Text style={styles.suggestButtonText}>Browse Suggestions</Text>
          </TouchableOpacity>
        </View>

        {/* Tips */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>💡 Pro Tips</Text>
          <Text style={styles.tipsText}>
            • Keep questions short and clear{'\n'}
            • Only mark essential questions as required{'\n'}
            • Use multiple choice when possible for faster booking{'\n'}
            • Pet and allergy questions help you prepare
          </Text>
        </View>
      </ScrollView>

      {/* Floating Navigation */}
      <CleanerFloatingNavigation 
        navigation={navigation as any}
        currentScreen="Profile"
      />

      {/* Add Question Modal */}
      <Modal
        visible={showAddQuestionModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddQuestionModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => {
                setShowAddQuestionModal(false);
                resetQuestionForm();
              }}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Add Question</Text>
              <TouchableOpacity 
                onPress={handleAddQuestion}
                disabled={!newQuestionText.trim() || isSaving}
                style={[styles.saveButton, !newQuestionText.trim() && styles.saveButtonDisabled]}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Add</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Question Text */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Question *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your question..."
                  placeholderTextColor="#9CA3AF"
                  value={newQuestionText}
                  onChangeText={setNewQuestionText}
                  multiline
                />
              </View>

              {/* Question Type */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Answer Type</Text>
                <View style={styles.typeGrid}>
                  {QUESTION_TYPES.map(type => (
                    <TouchableOpacity
                      key={type.id}
                      style={[
                        styles.typeOption,
                        newQuestionType === type.id && styles.typeOptionSelected
                      ]}
                      onPress={() => setNewQuestionType(type.id)}
                    >
                      <Ionicons 
                        name={type.icon as any} 
                        size={20} 
                        color={newQuestionType === type.id ? '#F59E0B' : '#6B7280'} 
                      />
                      <Text style={[
                        styles.typeOptionText,
                        newQuestionType === type.id && styles.typeOptionTextSelected
                      ]}>
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Options for Multiple Choice */}
              {newQuestionType === 'single_choice' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Options</Text>
                  {newQuestionOptions.map((option, index) => (
                    <View key={index} style={styles.optionRow}>
                      <TextInput
                        style={styles.optionInput}
                        placeholder={`Option ${index + 1}`}
                        placeholderTextColor="#9CA3AF"
                        value={option}
                        onChangeText={(text) => {
                          const newOptions = [...newQuestionOptions];
                          newOptions[index] = text;
                          setNewQuestionOptions(newOptions);
                        }}
                      />
                      {index > 0 && (
                        <TouchableOpacity
                          onPress={() => {
                            setNewQuestionOptions(prev => prev.filter((_, i) => i !== index));
                          }}
                        >
                          <Ionicons name="close-circle" size={22} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                  <TouchableOpacity
                    style={styles.addOptionButton}
                    onPress={() => setNewQuestionOptions(prev => [...prev, ''])}
                  >
                    <Ionicons name="add" size={18} color="#F59E0B" />
                    <Text style={styles.addOptionText}>Add Option</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Required Toggle */}
              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchLabel}>Required Question</Text>
                  <Text style={styles.switchHint}>Customer must answer to book</Text>
                </View>
                <Switch
                  value={newQuestionRequired}
                  onValueChange={setNewQuestionRequired}
                  trackColor={{ false: '#E5E7EB', true: '#FCD34D' }}
                  thumbColor={newQuestionRequired ? '#F59E0B' : '#FFFFFF'}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Suggestions Modal */}
      <Modal
        visible={showSuggestionsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSuggestionsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowSuggestionsModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Suggested Questions</Text>
              <View style={{ width: 50 }} />
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.suggestionHint}>
                Tap a question to add it to your booking form
              </Text>
              {SUGGESTED_QUESTIONS.map((suggestion, index) => {
                const isAdded = questions.some(q => 
                  q.question_text.toLowerCase() === suggestion.text.toLowerCase()
                );
                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.suggestionCard, isAdded && styles.suggestionCardAdded]}
                    onPress={() => !isAdded && handleAddSuggestedQuestion(suggestion)}
                    disabled={isAdded}
                  >
                    <View style={styles.suggestionContent}>
                      <Text style={[styles.suggestionText, isAdded && styles.suggestionTextAdded]}>
                        {suggestion.text}
                      </Text>
                      <View style={styles.suggestionMeta}>
                        <Ionicons 
                          name={getQuestionTypeIcon(suggestion.type) as any} 
                          size={14} 
                          color="#9CA3AF" 
                        />
                        <Text style={styles.suggestionType}>
                          {getQuestionTypeLabel(suggestion.type)}
                        </Text>
                      </View>
                    </View>
                    {isAdded ? (
                      <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                    ) : (
                      <Ionicons name="add-circle-outline" size={24} color="#F59E0B" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
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
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  introCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  introIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  introTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  introText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  questionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  questionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  questionNumberText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B45309',
  },
  questionContent: {
    flex: 1,
  },
  questionText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 6,
  },
  questionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  questionTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  questionTypeText: {
    fontSize: 11,
    color: '#6B7280',
  },
  requiredBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  requiredText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '500',
  },
  deleteButton: {
    padding: 4,
  },
  actionButtons: {
    gap: 10,
    marginBottom: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  suggestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    gap: 8,
  },
  suggestButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F59E0B',
  },
  tipsCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  tipsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 8,
  },
  tipsText: {
    fontSize: 13,
    color: '#B45309',
    lineHeight: 22,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  saveButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalBody: {
    padding: 16,
    paddingBottom: 40,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#1F2937',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeOptionSelected: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  typeOptionText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  typeOptionTextSelected: {
    color: '#B45309',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  optionInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#1F2937',
  },
  addOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  addOptionText: {
    fontSize: 14,
    color: '#F59E0B',
    fontWeight: '500',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    padding: 14,
    borderRadius: 10,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
  },
  switchHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  suggestionHint: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
    textAlign: 'center',
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  suggestionCardAdded: {
    backgroundColor: '#F0FDF4',
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 4,
  },
  suggestionTextAdded: {
    color: '#6B7280',
  },
  suggestionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  suggestionType: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});

export default BookingCustomizationScreen;
