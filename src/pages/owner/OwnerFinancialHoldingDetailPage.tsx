import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Wallet, DollarSign, TrendingUp, TrendingDown, Shield, FileText } from 'lucide-react';

const allocationData: Record<string, { name: string; value: number; percentage: number; trend: number; riskLevel: string; ownerNote: string }> = {
  'index-funds': { name: 'Index Funds', value: 85000, percentage: 46, trend: 3.2, riskLevel: 'Low', ownerNote: 'Long-term growth strategy. Primarily S&P 500 and Total Market funds. Rebalance quarterly.' },
  'individual-stocks': { name: 'Individual Stocks', value: 58000, percentage: 31, trend: 5.8, riskLevel: 'Medium', ownerNote: 'Growth picks in tech and healthcare. Monitor NVDA, AAPL, MSFT positions closely.' },
  'crypto': { name: 'Crypto (BTC/ETH)', value: 42000, percentage: 23, trend: -2.1, riskLevel: 'High', ownerNote: 'Volatile but strategic. 70% BTC, 30% ETH. Consider DCA during dips.' },
  'cash': { name: 'Cash Reserves', value: 75000, percentage: 100, trend: 0.5, riskLevel: 'Low', ownerNote: 'Emergency fund and opportunity capital. Keep 6-12 months of expenses liquid.' },
};

export default function OwnerFinancialHoldingDetailPage() {
  const { allocationId } = useParams<{ allocationId: string }>();
  const navigate = useNavigate();
  
  const allocation = allocationId ? allocationData[allocationId] : null;
  
  if (!allocation) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Allocation not found</p>
        <Button variant="outline" onClick={() => navigate('/os/owner/holdings')} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Holdings
        </Button>
      </div>
    );
  }

  const riskColors: Record<string, string> = {
    Low: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    Medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    High: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/os/owner/holdings')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 border border-blue-500/30">
              <Wallet className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{allocation.name}</h1>
              <p className="text-sm text-muted-foreground">Allocation ID: {allocationId}</p>
            </div>
          </div>
        </div>
        <Badge variant="outline" className={riskColors[allocation.riskLevel]}>
          <Shield className="h-3 w-3 mr-1" />
          {allocation.riskLevel} Risk
        </Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-xl border-blue-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Value</p>
                <p className="text-2xl font-bold">${(allocation.value / 1000).toFixed(0)}K</p>
              </div>
              <DollarSign className="h-6 w-6 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-purple-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Allocation</p>
                <p className="text-2xl font-bold">{allocation.percentage}%</p>
              </div>
              <Wallet className="h-6 w-6 text-purple-400" />
            </div>
          </CardContent>
        </Card>
        <Card className={`rounded-xl ${allocation.trend >= 0 ? 'border-emerald-500/30' : 'border-red-500/30'}`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Trend</p>
                <p className={`text-2xl font-bold ${allocation.trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {allocation.trend >= 0 ? '+' : ''}{allocation.trend}%
                </p>
              </div>
              {allocation.trend >= 0 ? (
                <TrendingUp className="h-6 w-6 text-emerald-400" />
              ) : (
                <TrendingDown className="h-6 w-6 text-red-400" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Owner Note */}
      <Card className="rounded-xl border-amber-500/30 bg-gradient-to-br from-amber-950/30 to-amber-900/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-amber-400" />
            Owner Note
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground/90">{allocation.ownerNote}</p>
        </CardContent>
      </Card>
    </div>
  );
}
