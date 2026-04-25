export type DynamicFieldType =
  | 'text'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'boolean'
  | 'textarea'
  | 'photo'
  | 'date'
  | 'time'
  | 'counter';

export interface DynamicQuestion {
  id: string;
  type: DynamicFieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  default?: string | number | boolean | string[];
}

export interface ServiceConfigResult {
  serviceId: string;
  serviceName: string;
  proServiceId?: string;
  pricingType?: 'fixed' | 'hourly' | 'quote';
  basePrice?: number;
  hourlyRate?: number;
  questions: DynamicQuestion[];
}
