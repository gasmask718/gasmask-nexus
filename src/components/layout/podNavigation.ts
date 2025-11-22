import { Shirt, Package, Brain, Upload, Target, BarChart3, Trophy, Users, Settings } from 'lucide-react';

export const podNavigationItems = [
  { to: '/pod', icon: Shirt, label: 'POD Overview', roles: ['admin', 'pod_worker'] },
  { to: '/pod/designs', icon: Package, label: 'Design Library', roles: ['admin', 'pod_worker'] },
  { to: '/pod/generator', icon: Brain, label: 'AI Design Generator', roles: ['admin', 'pod_worker'] },
  { to: '/pod/mockups', icon: Package, label: 'Mockup Generator', roles: ['admin', 'pod_worker'] },
  { to: '/pod/uploads', icon: Upload, label: 'Marketplace Uploads', roles: ['admin', 'pod_worker'] },
  { to: '/pod/videos', icon: Package, label: 'Promo Video Studio', roles: ['admin', 'pod_worker'] },
  { to: '/pod/scheduler', icon: Target, label: 'Content Scheduler', roles: ['admin', 'pod_worker'] },
  { to: '/pod/analytics', icon: BarChart3, label: 'Sales Analytics', roles: ['admin', 'pod_worker'] },
  { to: '/pod/winners', icon: Trophy, label: 'Scaling Engine', roles: ['admin', 'pod_worker'] },
  { to: '/pod/va', icon: Users, label: 'VA Control Panel', roles: ['admin', 'pod_worker'] },
  { to: '/pod/settings', icon: Settings, label: 'POD Settings', roles: ['admin', 'pod_worker'] },
];
