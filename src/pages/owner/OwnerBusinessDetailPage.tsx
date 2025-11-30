import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Building2, DollarSign, CheckSquare, ShoppingCart, Brain } from 'lucide-react';

const businessData: Record<string, { name: string; revenue: string; openTasks: number; activeOrders: number; aiNote: string }> = {
  'gasmask': { name: 'GasMask OS', revenue: '$128,450', openTasks: 12, activeOrders: 45, aiNote: '1. Follow up on 5 low-stock SKUs. 2. Review driver performance in Zone 3.' },
  'hotmama': { name: 'HotMama', revenue: '$24,980', openTasks: 3, activeOrders: 8, aiNote: '1. Expand marketing to new demographics. 2. Consider bundle pricing strategy.' },
  'scalati': { name: 'Hot Scalati', revenue: '$18,200', openTasks: 2, activeOrders: 6, aiNote: '1. Premium product positioning working well. 2. Explore wholesale partnerships.' },
  'grabba-r-us': { name: 'Grabba R Us', revenue: '$22,100', openTasks: 5, activeOrders: 15, aiNote: '1. Retail channel growing steadily. 2. Optimize delivery routes for cost savings.' },
  'toptier': { name: 'TopTier Experience', revenue: '$58,320', openTasks: 8, activeOrders: 22, aiNote: '1. Weekend pricing optimization opportunity. 2. Launch roses bundle for +AOV.' },
  'unforgettable': { name: 'Unforgettable Times', revenue: '$32,740', openTasks: 6, activeOrders: 12, aiNote: '1. Address 3% revenue decline with targeted campaign. 2. Review competitor pricing.' },
  'iclean': { name: 'iClean WeClean', revenue: '$21,560', openTasks: 4, activeOrders: 18, aiNote: '1. Expand service area to adjacent neighborhoods. 2. Implement referral program.' },
  'playboxxx': { name: 'PlayBoxxx', revenue: '$76,910', openTasks: 7, activeOrders: 0, aiNote: '1. Strong growth - maintain momentum. 2. Review creator payout schedule.' },
  'funding': { name: 'Funding Company', revenue: '$39,200', openTasks: 9, activeOrders: 0, aiNote: '1. Address 2 files over SLA immediately. 2. Streamline underwriting process.' },
  'grants': { name: 'Grant Company', revenue: '$18,400', openTasks: 5, activeOrders: 0, aiNote: '1. 3 client grants ready for submission. 2. Update compliance documentation.' },
  'wealth': { name: 'Wealth Engine', revenue: '$15,000', openTasks: 2, activeOrders: 0, aiNote: '1. Portfolio rebalancing due next week. 2. Review crypto allocation.' },
  'sports': { name: 'Sports Betting AI', revenue: '$8,500', openTasks: 3, activeOrders: 0, aiNote: '1. Bankroll management on track. 2. Edge calculator showing positive EV opportunities.' },
};

export default function OwnerBusinessDetailPage() {
  const { businessId } = useParams<{ businessId: string }>();
  const navigate = useNavigate();
  
  const business = businessId ? businessData[businessId] : null;
  
  if (!business) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Business not found</p>
        <Button variant="outline" onClick={() => navigate('/os/owner')} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/os/owner')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{business.name}</h1>
            <p className="text-sm text-muted-foreground">Business ID: {businessId}</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-xl border-emerald-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Revenue MTD</p>
                <p className="text-2xl font-bold">{business.revenue}</p>
              </div>
              <DollarSign className="h-6 w-6 text-emerald-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-blue-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open Tasks</p>
                <p className="text-2xl font-bold">{business.openTasks}</p>
              </div>
              <CheckSquare className="h-6 w-6 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-purple-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Orders</p>
                <p className="text-2xl font-bold">{business.activeOrders}</p>
              </div>
              <ShoppingCart className="h-6 w-6 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Quick Note */}
      <Card className="rounded-xl border-amber-500/30 bg-gradient-to-br from-amber-950/30 to-amber-900/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="h-4 w-4 text-amber-400" />
            AI Quick Note — Top Things to Fix Today
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground/90">{business.aiNote}</p>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
          <CardDescription className="text-xs">Navigate to business-specific areas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 flex-wrap">
            <Button variant="outline" size="sm">View CRM</Button>
            <Button variant="outline" size="sm">View Tasks</Button>
            <Button variant="outline" size="sm">View Analytics</Button>
            <Button variant="outline" size="sm">View Team</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
