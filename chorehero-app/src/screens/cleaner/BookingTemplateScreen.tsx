import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
  Switch,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../hooks/useAuth';
import { bookingTemplateService, BookingTemplate, BookingFlowStep, CustomBookingQuestion, CleanerTemplateAddon } from '../../services/bookingTemplateService';

type StackParamList = {
  BookingTemplate: undefined;
  CleanerProfile: undefined;
};

type BookingTemplateNavigationProp = StackNavigationProp<StackParamList, 'BookingTemplate'>;

interface BookingTemplateProps {
  navigation: BookingTemplateNavigationProp;
}

const BookingTemplateScreen: React.FC<BookingTemplateProps> = ({ navigation }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [templates, setTemplates] = useState<BookingTemplate[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<BookingTemplate | null>(null);
  const [flowSteps, setFlowSteps] = useState<BookingFlowStep[]>([]);
  const [customQuestions, setCustomQuestions] = useState<CustomBookingQuestion[]>([]);
  const [templateAddons, setTemplateAddons] = useState<CleanerTemplateAddon[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [showAddonModal, setShowAddonModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'flow' | 'questions' | 'addons' | 'analytics'>('overview');

  // New template form
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');

  // New question form
  const [newQuestion, setNewQuestion] = useState({
    text: '',
    type: 'text' as CustomBookingQuestion['question_type'],
    required: false,
    placeholder: '',
    help: '',
  });

  // New addon form
  const [newAddon, setNewAddon] = useState({
    name: '',
    description: '',
    price: '',
    duration: '',
    category: 'convenience' as CleanerTemplateAddon['category'],
  });

  useEffect(() => {
    if (user?.id) {
      loadTemplateData();
    }
  }, [user?.id]);

  const loadTemplateData = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      // Load all templates
      const templatesResult = await bookingTemplateService.getCleanerTemplates(user.id);
      if (templatesResult.success && templatesResult.data) {
        setTemplates(templatesResult.data);
        
        // Find active template
        const active = templatesResult.data.find(t => t.is_active && t.is_default);
        if (active) {
          setActiveTemplate(active);
          await loadTemplateDetails(active.id);
        }
      }
    } catch (error) {
      console.error('Error loading template data:', error);
      try { (showToast as any) && showToast({ type: 'error', message: 'Failed to load templates' }); } catch {}
    } finally {
      setIsLoading(false);
    }
  };

  const loadTemplateDetails = async (templateId: string) => {
    try {
      const [stepsResult, questionsResult, addonsResult] = await Promise.all([
        bookingTemplateService.getTemplateFlowSteps(templateId),
        bookingTemplateService.getTemplateQuestions(templateId),
        bookingTemplateService.getTemplateAddons(templateId),
      ]);

      if (stepsResult.success) setFlowSteps(stepsResult.data || []);
      if (questionsResult.success) setCustomQuestions(questionsResult.data || []);
      if (addonsResult.success) setTemplateAddons(addonsResult.data || []);
    } catch (error) {
      console.error('Error loading template details:', error);
    }
  };

  const handleCreateTemplate = async () => {
    if (!user?.id || !newTemplateName.trim()) {
      try { (showToast as any) && showToast({ type: 'warning', message: 'Enter a template name' }); } catch {}
      return;
    }

    try {
      const result = await bookingTemplateService.createTemplate(user.id, {
        name: newTemplateName.trim(),
        description: newTemplateDescription.trim(),
        is_active: false,
        is_default: false,
      });

      if (result.success && result.data) {
        setTemplates(prev => [...prev, result.data!]);
        setNewTemplateName('');
        setNewTemplateDescription('');
        setShowCreateModal(false);
        try { (showToast as any) && showToast({ type: 'success', message: 'Template created' }); } catch {}
      } else {
        try { (showToast as any) && showToast({ type: 'error', message: result.error || 'Failed to create template' }); } catch {}
      }
    } catch (error) {
      console.error('Error creating template:', error);
      try { (showToast as any) && showToast({ type: 'error', message: 'Failed to create template' }); } catch {}
    }
  };

  const handleAddQuestion = async () => {
    if (!activeTemplate || !newQuestion.text.trim()) {
      try { (showToast as any) && showToast({ type: 'warning', message: 'Enter a question' }); } catch {}
      return;
    }

    try {
      const result = await bookingTemplateService.addCustomQuestion(activeTemplate.id, {
        question_text: newQuestion.text.trim(),
        question_type: newQuestion.type,
        is_required: newQuestion.required,
        sort_order: customQuestions.length + 1,
        placeholder_text: newQuestion.placeholder.trim() || undefined,
        help_text: newQuestion.help.trim() || undefined,
      });

      if (result.success && result.data) {
        setCustomQuestions(prev => [...prev, result.data!]);
        setNewQuestion({ text: '', type: 'text', required: false, placeholder: '', help: '' });
        setShowQuestionModal(false);
        try { (showToast as any) && showToast({ type: 'success', message: 'Question added' }); } catch {}
      } else {
        try { (showToast as any) && showToast({ type: 'error', message: result.error || 'Failed to add question' }); } catch {}
      }
    } catch (error) {
      console.error('Error adding question:', error);
      try { (showToast as any) && showToast({ type: 'error', message: 'Failed to add question' }); } catch {}
    }
  };

  const handleAddAddon = async () => {
    if (!activeTemplate || !newAddon.name.trim() || !newAddon.price) {
      try { (showToast as any) && showToast({ type: 'warning', message: 'Fill all fields' }); } catch {}
      return;
    }

    try {
      const result = await bookingTemplateService.addTemplateAddon(activeTemplate.id, {
        addon_name: newAddon.name.trim(),
        addon_description: newAddon.description.trim(),
        price: parseFloat(newAddon.price),
        duration_minutes: parseInt(newAddon.duration) || 0,
        category: newAddon.category,
        sort_order: templateAddons.length + 1,
      });

      if (result.success && result.data) {
        setTemplateAddons(prev => [...prev, result.data!]);
        setNewAddon({ name: '', description: '', price: '', duration: '', category: 'convenience' });
        setShowAddonModal(false);
        try { (showToast as any) && showToast({ type: 'success', message: 'Add-on added' }); } catch {}
      } else {
        try { (showToast as any) && showToast({ type: 'error', message: result.error || 'Failed to add add-on' }); } catch {}
      }
    } catch (error) {
      console.error('Error adding addon:', error);
      try { (showToast as any) && showToast({ type: 'error', message: 'Failed to add add-on' }); } catch {}
    }
  };

  const handleToggleTemplateActive = async (template: BookingTemplate) => {
    try {
      const result = await bookingTemplateService.updateTemplate(template.id, {
        is_active: !template.is_active,
        is_default: !template.is_active, // Make active template the default
      });

      if (result.success) {
        setTemplates(prev => 
          prev.map(t => 
            t.id === template.id 
              ? { ...t, is_active: !t.is_active, is_default: !t.is_active }
              : { ...t, is_default: false } // Only one can be default
          )
        );
        
        if (!template.is_active) {
          setActiveTemplate(result.data!);
          await loadTemplateDetails(template.id);
        }
      } else {
        try { (showToast as any) && showToast({ type: 'error', message: result.error || 'Failed to update template' }); } catch {}
      }
    } catch (error) {
      console.error('Error toggling template:', error);
      try { (showToast as any) && showToast({ type: 'error', message: 'Failed to update template' }); } catch {}
    }
  };

  const renderOverviewTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.statsContainer}>
        <LinearGradient
          colors={['#F59E0B', '#F59E0B']}
          style={styles.statCard}
        >
          <Ionicons name="trending-up" size={32} color="white" />
          <Text style={styles.statValue}>{activeTemplate?.completion_rate.toFixed(1) || '0'}%</Text>
          <Text style={styles.statLabel}>Completion Rate</Text>
        </LinearGradient>

        <View style={styles.statCard}>
          <Ionicons name="star" size={32} color="#FFB800" />
          <Text style={styles.statValue}>{activeTemplate?.customer_rating.toFixed(1) || '0'}</Text>
          <Text style={styles.statLabel}>Customer Rating</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="calendar" size={32} color="#6366F1" />
          <Text style={styles.statValue}>{activeTemplate?.usage_count || '0'}</Text>
          <Text style={styles.statLabel}>Total Bookings</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Booking Templates</Text>
        <Text style={styles.sectionDescription}>
          Create customized booking flows to match your cleaning style and attract your ideal customers.
        </Text>
        
        {templates.map(template => (
          <View key={template.id} style={styles.templateCard}>
            <View style={styles.templateHeader}>
              <View style={styles.templateInfo}>
                <Text style={styles.templateName}>{template.name}</Text>
                <Text style={styles.templateDescription}>{template.description}</Text>
              </View>
              <Switch
                value={template.is_active}
                onValueChange={() => handleToggleTemplateActive(template)}
                trackColor={{ false: '#E5E7EB', true: '#F59E0B' }}
                thumbColor="white"
              />
            </View>
            {template.is_active && (
              <View style={styles.activeTemplateBadge}>
                <Text style={styles.activeTemplateText}>Active Template</Text>
              </View>
            )}
          </View>
        ))}

        <TouchableOpacity
          style={styles.createTemplateButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add-circle-outline" size={24} color="#F59E0B" />
          <Text style={styles.createTemplateText}>Create New Template</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFlowTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Booking Flow Steps</Text>
        <Text style={styles.sectionDescription}>
          Customize the order and content of your booking process.
        </Text>

        {flowSteps.map((step, index) => (
          <View key={step.id} style={styles.flowStepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{index + 1}</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>{step.step_title}</Text>
              <Text style={styles.stepDescription}>{step.step_description}</Text>
              <View style={styles.stepTags}>
                <View style={[styles.stepTag, step.is_required && styles.requiredTag]}>
                  <Text style={[styles.stepTagText, step.is_required && styles.requiredTagText]}>
                    {step.is_required ? 'Required' : 'Optional'}
                  </Text>
                </View>
                <View style={styles.stepTag}>
                  <Text style={styles.stepTagText}>{step.step_type.replace('_', ' ')}</Text>
                </View>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  const renderQuestionsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Custom Questions</Text>
            <Text style={styles.sectionDescription}>
              Ask customers specific questions about their cleaning needs.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowQuestionModal(true)}
          >
            <Ionicons name="add" size={20} color="white" />
          </TouchableOpacity>
        </View>

        {customQuestions.map((question, index) => (
          <View key={question.id} style={styles.questionCard}>
            <Text style={styles.questionText}>{question.question_text}</Text>
            <View style={styles.questionMeta}>
              <View style={styles.questionTag}>
                <Text style={styles.questionTagText}>{question.question_type}</Text>
              </View>
              {question.is_required && (
                <View style={[styles.questionTag, styles.requiredTag]}>
                  <Text style={[styles.questionTagText, styles.requiredTagText]}>Required</Text>
                </View>
              )}
            </View>
          </View>
        ))}

        {customQuestions.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="help-circle-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyStateText}>No custom questions yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Add questions to better understand your customers' needs
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderAddonsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Custom Add-ons</Text>
            <Text style={styles.sectionDescription}>
              Offer specialized services that match your expertise.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddonModal(true)}
          >
            <Ionicons name="add" size={20} color="white" />
          </TouchableOpacity>
        </View>

        {templateAddons.map(addon => (
          <View key={addon.id} style={styles.addonCard}>
            <View style={styles.addonHeader}>
              <Text style={styles.addonName}>{addon.addon_name}</Text>
              <Text style={styles.addonPrice}>${addon.price.toFixed(2)}</Text>
            </View>
            <Text style={styles.addonDescription}>{addon.addon_description}</Text>
            <View style={styles.addonMeta}>
              <View style={styles.addonTag}>
                <Text style={styles.addonTagText}>{addon.category}</Text>
              </View>
              {addon.duration_minutes > 0 && (
                <Text style={styles.addonDuration}>+{addon.duration_minutes} min</Text>
              )}
            </View>
          </View>
        ))}

        {templateAddons.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="construct-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyStateText}>No custom add-ons yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Create add-ons to showcase your specialized services
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text style={styles.loadingText}>Loading booking templates...</Text>
        </View>
      </SafeAreaView>
    );
  }

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
        <Text style={styles.headerTitle}>Booking Templates</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
          {[
            { key: 'overview', label: 'Overview', icon: 'analytics' },
            { key: 'flow', label: 'Flow', icon: 'git-branch' },
            { key: 'questions', label: 'Questions', icon: 'help-circle' },
            { key: 'addons', label: 'Add-ons', icon: 'add-circle' },
            { key: 'analytics', label: 'Analytics', icon: 'trending-up' },
          ].map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.activeTab]}
              onPress={() => setActiveTab(tab.key as any)}
            >
              <Ionicons 
                name={tab.icon as any} 
                size={18} 
                color={activeTab === tab.key ? 'white' : '#6B7280'} 
              />
              <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'flow' && renderFlowTab()}
        {activeTab === 'questions' && renderQuestionsTab()}
        {activeTab === 'addons' && renderAddonsTab()}
        {activeTab === 'analytics' && (
          <View style={styles.tabContent}>
            <View style={styles.comingSoon}>
              <Ionicons name="bar-chart" size={64} color="#9CA3AF" />
              <Text style={styles.comingSoonText}>Analytics Coming Soon</Text>
              <Text style={styles.comingSoonSubtext}>
                Track performance, completion rates, and customer feedback
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Create Template Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Template</Text>
            <TouchableOpacity onPress={handleCreateTemplate}>
              <Text style={styles.modalSave}>Create</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Template Name</Text>
              <TextInput
                style={styles.formInput}
                value={newTemplateName}
                onChangeText={setNewTemplateName}
                placeholder="e.g., Deep Clean Specialist"
                maxLength={100}
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Description</Text>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                value={newTemplateDescription}
                onChangeText={setNewTemplateDescription}
                placeholder="Describe what makes this booking flow special..."
                multiline
                numberOfLines={4}
                maxLength={500}
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Add Question Modal */}
      <Modal
        visible={showQuestionModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowQuestionModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Question</Text>
            <TouchableOpacity onPress={handleAddQuestion}>
              <Text style={styles.modalSave}>Add</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Question</Text>
              <TextInput
                style={styles.formInput}
                value={newQuestion.text}
                onChangeText={(text) => setNewQuestion(prev => ({ ...prev, text }))}
                placeholder="e.g., Do you have any pets?"
                maxLength={200}
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Answer Type</Text>
              <View style={styles.pickerContainer}>
                {['text', 'textarea', 'yes_no', 'single_choice', 'multiple_choice'].map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.pickerOption,
                      newQuestion.type === type && styles.pickerOptionActive
                    ]}
                    onPress={() => setNewQuestion(prev => ({ ...prev, type: type as any }))}
                  >
                    <Text style={[
                      styles.pickerOptionText,
                      newQuestion.type === type && styles.pickerOptionTextActive
                    ]}>
                      {type.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <View style={styles.switchRow}>
                <Text style={styles.formLabel}>Required Question</Text>
                <Switch
                  value={newQuestion.required}
                  onValueChange={(required) => setNewQuestion(prev => ({ ...prev, required }))}
                  trackColor={{ false: '#E5E7EB', true: '#F59E0B' }}
                  thumbColor="white"
                />
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Add Addon Modal */}
      <Modal
        visible={showAddonModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddonModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Service</Text>
            <TouchableOpacity onPress={handleAddAddon}>
              <Text style={styles.modalSave}>Add</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Service Name</Text>
              <TextInput
                style={styles.formInput}
                value={newAddon.name}
                onChangeText={(name) => setNewAddon(prev => ({ ...prev, name }))}
                placeholder="e.g., Oven Deep Clean"
                maxLength={100}
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Description</Text>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                value={newAddon.description}
                onChangeText={(description) => setNewAddon(prev => ({ ...prev, description }))}
                placeholder="Describe this additional service..."
                multiline
                numberOfLines={3}
                maxLength={300}
              />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.formLabel}>Price ($)</Text>
                <TextInput
                  style={styles.formInput}
                  value={newAddon.price}
                  onChangeText={(price) => setNewAddon(prev => ({ ...prev, price }))}
                  placeholder="25.00"
                  keyboardType="decimal-pad"
                />
              </View>
              
              <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.formLabel}>Duration (min)</Text>
                <TextInput
                  style={styles.formInput}
                  value={newAddon.duration}
                  onChangeText={(duration) => setNewAddon(prev => ({ ...prev, duration }))}
                  placeholder="30"
                  keyboardType="number-pad"
                />
              </View>
            </View>
          </ScrollView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  placeholder: {
    width: 44,
  },
  tabsContainer: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabsScroll: {
    paddingHorizontal: 20,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  activeTab: {
    backgroundColor: '#F59E0B',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginLeft: 6,
  },
  activeTabText: {
    color: 'white',
  },
  scrollView: {
    flex: 1,
  },
  tabContent: {
    padding: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginVertical: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  templateInfo: {
    flex: 1,
    marginRight: 16,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  templateDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 18,
  },
  activeTemplateBadge: {
    marginTop: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#DCFCE7',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  activeTemplateText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#16A34A',
  },
  createTemplateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    paddingHorizontal: 16,
    backgroundColor: 'white',
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  createTemplateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#F59E0B',
    marginLeft: 8,
  },
  flowStepCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'white',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  stepTags: {
    flexDirection: 'row',
    gap: 8,
  },
  stepTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
  },
  requiredTag: {
    backgroundColor: '#FEF3C7',
  },
  stepTagText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  requiredTagText: {
    color: '#D97706',
  },
  questionCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 8,
  },
  questionMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  questionTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
  },
  questionTagText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  addonCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  addonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addonName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  addonPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F59E0B',
  },
  addonDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  addonMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addonTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
  },
  addonTagText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  addonDuration: {
    fontSize: 12,
    color: '#6B7280',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  comingSoon: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  comingSoonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
  },
  comingSoonSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
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
  modalSave: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F59E0B',
  },
  modalContent: {
    flex: 1,
    padding: 20,
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  pickerOptionActive: {
    backgroundColor: '#F59E0B',
  },
  pickerOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  pickerOptionTextActive: {
    color: 'white',
  },
});

export default BookingTemplateScreen;
