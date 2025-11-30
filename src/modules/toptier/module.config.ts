import { Car } from 'lucide-react';
import { ModuleConfig } from '../types';

export const topTierConfig: ModuleConfig = {
  id: 'toptier',
  name: 'TopTier Experience OS',
  description: 'Luxury Black Truck, Roses & Premium Gifting Services',
  basePath: '/os/toptier',
  icon: Car,
  color: 'amber',
  permissions: ['admin', 'employee', 'manager'],
  isEnabled: true,
  order: 10,
};
