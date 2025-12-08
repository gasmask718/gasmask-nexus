import { Badge } from '@/components/ui/badge';
import { 
  MessageSquareX, 
  Package, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  Clock,
  UserPlus,
  ShoppingCart
} from 'lucide-react';

interface FollowUpReasonBadgeProps {
  reason: string;
  size?: 'sm' | 'default';
}

const reasonConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  no_response: {
    label: 'No Response',
    icon: MessageSquareX,
    className: 'bg-orange-100 text-orange-800 border-orange-200',
  },
  no_order: {
    label: 'No Recent Order',
    icon: Package,
    className: 'bg-red-100 text-red-800 border-red-200',
  },
  low_stock: {
    label: 'Low Stock',
    icon: AlertTriangle,
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  deal_stalled: {
    label: 'Deal Stalled',
    icon: Clock,
    className: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  upsell_opportunity: {
    label: 'Upsell Opportunity',
    icon: TrendingUp,
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  churn_risk: {
    label: 'Churn Risk',
    icon: TrendingDown,
    className: 'bg-red-100 text-red-800 border-red-200',
  },
  negative_sentiment: {
    label: 'Negative Sentiment',
    icon: TrendingDown,
    className: 'bg-red-100 text-red-800 border-red-200',
  },
  positive_sentiment: {
    label: 'Positive Sentiment',
    icon: TrendingUp,
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  onboarding_day_1: {
    label: 'Onboarding Day 1',
    icon: UserPlus,
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  onboarding_day_3: {
    label: 'Onboarding Day 3',
    icon: UserPlus,
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  onboarding_day_7: {
    label: 'Onboarding Day 7',
    icon: UserPlus,
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  onboarding_day_14: {
    label: 'Onboarding Day 14',
    icon: UserPlus,
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  satisfaction_check: {
    label: 'Satisfaction Check',
    icon: ShoppingCart,
    className: 'bg-teal-100 text-teal-800 border-teal-200',
  },
  scheduled_followup: {
    label: 'Scheduled',
    icon: Clock,
    className: 'bg-gray-100 text-gray-800 border-gray-200',
  },
};

export function FollowUpReasonBadge({ reason, size = 'default' }: FollowUpReasonBadgeProps) {
  const config = reasonConfig[reason] || {
    label: reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    icon: Clock,
    className: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  const Icon = config.icon;
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  return (
    <Badge variant="outline" className={`${config.className} ${size === 'sm' ? 'text-xs py-0' : ''}`}>
      <Icon className={`${iconSize} mr-1`} />
      {config.label}
    </Badge>
  );
}
