import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

type IonIconName = ComponentProps<typeof Ionicons>['name'];

/** Maps service categories to distinct Ionicons (avoid generic sparkles). */
export function iconForServiceCategory(category?: string | null): IonIconName {
  const c = (category || '').toLowerCase();
  if (c.includes('clean') || c.includes('kitchen') || c.includes('bath')) return 'brush-outline';
  if (c.includes('outdoor') || c.includes('yard') || c.includes('lawn') || c.includes('garden')) return 'leaf-outline';
  if (c.includes('move') || c.includes('pack')) return 'cube-outline';
  if (c.includes('hand') || c.includes('repair') || c.includes('fix')) return 'hammer-outline';
  if (c.includes('auto') || c.includes('car')) return 'car-outline';
  if (c.includes('pet')) return 'paw-outline';
  if (c.includes('laundry') || c.includes('iron')) return 'shirt-outline';
  return 'home-outline';
}
