export type UnifiedPackageType = 'fixed' | 'estimate' | 'hourly';

export interface UnifiedBookingParams {
  serviceId?: string;
  proId?: string;
  cleanerId?: string;
  serviceType?: string;
  serviceName?: string;
  basePrice?: number;
  quoteId?: string;
  jobId?: string;
  hourlyRate?: number;
  packageId?: string;
  packageType?: UnifiedPackageType;
  packageBasePriceCents?: number;
  estimatedHours?: number;
  selectedService?: string;
  selectedTime?: string;
  duration?: number;
}
