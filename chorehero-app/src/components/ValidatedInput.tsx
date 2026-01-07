import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ValidationRule, useFormValidation, debounce } from '../utils/validation';
import { COLORS } from '../utils/constants';

interface ValidatedInputProps extends Omit<TextInputProps, 'onChangeText'> {
  label: string;
  field: string;
  value: string;
  onChangeText: (field: string, value: string, isValid: boolean) => void;
  validationRules?: ValidationRule;
  showErrorIcon?: boolean;
  showSuccessIcon?: boolean;
  debounceMs?: number;
  required?: boolean;
  helpText?: string;
  errorStyle?: object;
}

export const ValidatedInput: React.FC<ValidatedInputProps> = ({
  label,
  field,
  value,
  onChangeText,
  validationRules,
  showErrorIcon = true,
  showSuccessIcon = true,
  debounceMs = 300,
  required = false,
  helpText,
  errorStyle,
  style,
  ...textInputProps
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [isValid, setIsValid] = useState(true);

  const fadeAnim = new Animated.Value(0);
  const shakeAnim = new Animated.Value(0);

  const { validateField } = useFormValidation(
    validationRules ? { [field]: validationRules } : {}
  );

  // Debounced validation function
  const debouncedValidate = useCallback(
    debounce((fieldName: string, fieldValue: string) => {
      if (validationRules) {
        const validation = validateField(fieldName, fieldValue);
        setErrors(validation.errors);
        setIsValid(validation.isValid);
        setIsValidated(true);

        // Trigger animations based on validation result
        if (!validation.isValid && fieldValue.length > 0) {
          // Shake animation for errors
          Animated.sequence([
            Animated.timing(shakeAnim, {
              toValue: 10,
              duration: 100,
              useNativeDriver: true,
            }),
            Animated.timing(shakeAnim, {
              toValue: -10,
              duration: 100,
              useNativeDriver: true,
            }),
            Animated.timing(shakeAnim, {
              toValue: 0,
              duration: 100,
              useNativeDriver: true,
            }),
          ]).start();
        }

        // Fade in error message
        Animated.timing(fadeAnim, {
          toValue: validation.isValid ? 0 : 1,
          duration: 200,
          useNativeDriver: true,
        }).start();

        // Notify parent component
        onChangeText(fieldName, fieldValue, validation.isValid);
      } else {
        onChangeText(fieldName, fieldValue, true);
      }
    }, debounceMs),
    [validateField, onChangeText, debounceMs, validationRules]
  );

  const handleTextChange = (text: string) => {
    // Immediate validation for empty required fields
    if (required && text.trim() === '') {
      setErrors(['This field is required']);
      setIsValid(false);
      setIsValidated(true);
      onChangeText(field, text, false);
    } else {
      // Clear validation state on text change
      setIsValidated(false);
      setErrors([]);
      
      // Trigger debounced validation
      debouncedValidate(field, text);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Force validation on blur
    if (validationRules && value) {
      const validation = validateField(field, value);
      setErrors(validation.errors);
      setIsValid(validation.isValid);
      setIsValidated(true);
      onChangeText(field, value, validation.isValid);
    }
  };

  const getInputStyle = () => {
    let borderColor = COLORS.border;
    let backgroundColor = '#FFFFFF';

    if (isFocused) {
      borderColor = COLORS.primary;
    } else if (isValidated) {
      borderColor = isValid ? '#10B981' : '#EF4444';
      backgroundColor = isValid ? '#F0FDF4' : '#FEF2F2';
    }

    return {
      ...styles.input,
      borderColor,
      backgroundColor,
    };
  };

  const getRightIcon = () => {
    if (!isValidated || (!showErrorIcon && !showSuccessIcon)) return null;

    if (!isValid && showErrorIcon) {
      return (
        <Ionicons
          name="alert-circle"
          size={20}
          color="#EF4444"
          style={styles.icon}
        />
      );
    }

    if (isValid && showSuccessIcon && value.length > 0) {
      return (
        <Ionicons
          name="checkmark-circle"
          size={20}
          color="#10B981"
          style={styles.icon}
        />
      );
    }

    return null;
  };

  return (
    <Animated.View 
      style={[
        styles.container,
        { transform: [{ translateX: shakeAnim }] }
      ]}
    >
      <View style={styles.labelContainer}>
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
        {helpText && (
          <TouchableOpacity>
            <Ionicons name="help-circle-outline" size={16} color={COLORS.text.secondary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          {...textInputProps}
          style={[getInputStyle(), style]}
          value={value}
          onChangeText={handleTextChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholderTextColor={COLORS.text.secondary}
        />
        {getRightIcon()}
      </View>

      {helpText && !isValidated && (
        <Text style={styles.helpText}>{helpText}</Text>
      )}

      {isValidated && errors.length > 0 && (
        <Animated.View
          style={[
            styles.errorContainer,
            { opacity: fadeAnim },
            errorStyle,
          ]}
        >
          {errors.map((error, index) => (
            <Text key={index} style={styles.errorText}>
              {error}
            </Text>
          ))}
        </Animated.View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  required: {
    color: '#EF4444',
  },
  inputContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingRight: 44, // Space for icon
    fontSize: 16,
    color: COLORS.text.primary,
    backgroundColor: '#FFFFFF',
  },
  icon: {
    position: 'absolute',
    right: 12,
  },
  helpText: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginTop: 4,
  },
  errorContainer: {
    marginTop: 4,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '500',
  },
});

export default ValidatedInput;