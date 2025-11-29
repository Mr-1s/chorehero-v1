// Simple service templates for default booking forms (config, not code)
export type TemplateStep = 'location' | 'service' | 'addons' | 'schedule' | 'payment' | 'review';

export interface ServiceTemplate {
  id: string;            // e.g., 'express', 'standard', 'deep', 'moveout'
  name: string;          // Display name
  steps: TemplateStep[]; // Which steps are shown
  addOns?: { id: string; name: string; price: number; icon: string }[];
  pricing?: 'flat' | 'hourly' | 'tiered';
}

export const SERVICE_TEMPLATES: Record<string, ServiceTemplate> = {
  express: {
    id: 'express',
    name: 'Express Clean',
    steps: ['location', 'service', 'addons', 'schedule', 'payment', 'review'],
    addOns: [
      { id: 'inside_fridge', name: 'Inside Fridge', price: 15, icon: 'snow-outline' },
      { id: 'laundry', name: 'Laundry', price: 10, icon: 'shirt-outline' },
    ],
    pricing: 'flat',
  },
  standard: {
    id: 'standard',
    name: 'Standard Clean',
    steps: ['location', 'service', 'addons', 'schedule', 'payment', 'review'],
    addOns: [
      { id: 'inside_oven', name: 'Inside Oven', price: 20, icon: 'flame-outline' },
      { id: 'inside_cabinets', name: 'Inside Cabinets', price: 25, icon: 'file-tray-outline' },
    ],
    pricing: 'flat',
  },
  deep: {
    id: 'deep',
    name: 'Deep Clean',
    steps: ['location', 'service', 'addons', 'schedule', 'payment', 'review'],
    addOns: [
      { id: 'inside_fridge', name: 'Inside Fridge', price: 15, icon: 'snow-outline' },
      { id: 'inside_oven', name: 'Inside Oven', price: 20, icon: 'flame-outline' },
      { id: 'inside_cabinets', name: 'Inside Cabinets', price: 25, icon: 'file-tray-outline' },
    ],
    pricing: 'flat',
  },
  moveout: {
    id: 'moveout',
    name: 'Move-out Clean',
    steps: ['location', 'service', 'addons', 'schedule', 'payment', 'review'],
    addOns: [
      { id: 'inside_oven', name: 'Inside Oven', price: 20, icon: 'flame-outline' },
      { id: 'inside_cabinets', name: 'Inside Cabinets', price: 25, icon: 'file-tray-outline' },
    ],
    pricing: 'flat',
  },
};

export const getTemplateForService = (serviceIdOrName: string): ServiceTemplate | null => {
  const key = (serviceIdOrName || '').toLowerCase();
  if (SERVICE_TEMPLATES[key]) return SERVICE_TEMPLATES[key];
  // Try fuzzy matching by name fragments
  const found = Object.values(SERVICE_TEMPLATES).find(t => key.includes(t.id) || key.includes(t.name.toLowerCase()));
  return found || null;
};
