import { Phone, Brain, FileText, MessageSquare, Mail, Settings, Activity, PhoneCall, BarChart3 } from 'lucide-react';

export const callCenterNavItems = [
  { to: '/call-center/dashboard', icon: Phone, label: 'Dashboard', roles: ['admin', 'callcenter_worker'] },
  { to: '/call-center/numbers', icon: Phone, label: 'Phone Numbers', roles: ['admin'] },
  { to: '/call-center/ai-agents', icon: Brain, label: 'AI Agents', roles: ['admin'] },
  { to: '/call-center/logs', icon: FileText, label: 'Call Logs', roles: ['admin', 'callcenter_worker'] },
  { to: '/call-center/live-monitoring', icon: Activity, label: 'Live Monitoring', roles: ['admin', 'callcenter_worker'] },
  { to: '/call-center/dialer', icon: PhoneCall, label: 'Cloud Dialer', roles: ['admin', 'callcenter_worker'] },
  { to: '/call-center/analytics', icon: BarChart3, label: 'Analytics', roles: ['admin'] },
  { to: '/call-center/settings', icon: Settings, label: 'Settings', roles: ['admin'] },
];
