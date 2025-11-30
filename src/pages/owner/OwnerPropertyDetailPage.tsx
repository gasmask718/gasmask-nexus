import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Home, DollarSign, TrendingUp, Calendar } from 'lucide-react';

const propertyData: Record<string, { name: string; equity: number; loanAmount: number; monthlyIncome: number; status: string; timeline: { date: string; event: string }[] }> = {
  'prop-1': { name: 'Rental Property #1', equity: 120000, loanAmount: 200000, monthlyIncome: 2800, status: 'Occupied', timeline: [{ date: 'Jan 2023', event: 'Purchased' }, { date: 'Feb 2023', event: 'Minor repairs completed' }, { date: 'Mar 2023', event: 'First tenant moved in' }] },
  'prop-2': { name: 'Rental Property #2', equity: 95000, loanAmount: 190000, monthlyIncome: 2400, status: 'Occupied', timeline: [{ date: 'Jun 2022', event: 'Purchased' }, { date: 'Jul 2022', event: 'Renovation started' }, { date: 'Oct 2022', event: 'Tenant placed' }] },
  'prop-3': { name: 'Rental Property #3', equity: 135000, loanAmount: 240000, monthlyIncome: 3200, status: 'Occupied', timeline: [{ date: 'Mar 2023', event: 'Purchased' }, { date: 'Apr 2023', event: 'Property inspection' }, { date: 'May 2023', event: 'Leased' }] },
  'prop-4': { name: 'Airbnb Unit #1', equity: 60000, loanAmount: 120000, monthlyIncome: 2800, status: 'Active', timeline: [{ date: 'Sep 2023', event: 'Purchased' }, { date: 'Oct 2023', event: 'Furnished' }, { date: 'Nov 2023', event: 'Listed on Airbnb' }] },
  'prop-5': { name: 'Commercial Space', equity: 40000, loanAmount: 480000, monthlyIncome: 1300, status: 'Leased', timeline: [{ date: 'Dec 2022', event: 'Purchased' }, { date: 'Jan 2023', event: 'Commercial lease signed' }, { date: 'Feb 2023', event: 'Tenant buildout complete' }] },
};

export default function OwnerPropertyDetailPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const navigate = useNavigate();
  
  const property = propertyId ? propertyData[propertyId] : null;
  
  if (!property) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Property not found</p>
        <Button variant="outline" onClick={() => navigate('/os/owner/holdings')} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Holdings
        </Button>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    Occupied: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    Active: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    Leased: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    Renovating: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    'Under Review': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
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
            <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30">
              <Home className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{property.name}</h1>
              <p className="text-sm text-muted-foreground">Property ID: {propertyId}</p>
            </div>
          </div>
        </div>
        <Badge variant="outline" className={statusColors[property.status] || 'bg-muted'}>
          {property.status}
        </Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-xl border-emerald-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Equity</p>
                <p className="text-2xl font-bold">${(property.equity / 1000).toFixed(0)}K</p>
              </div>
              <TrendingUp className="h-6 w-6 text-emerald-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-red-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Loan Amount</p>
                <p className="text-2xl font-bold">${(property.loanAmount / 1000).toFixed(0)}K</p>
              </div>
              <DollarSign className="h-6 w-6 text-red-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-blue-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Monthly Income</p>
                <p className="text-2xl font-bold">${property.monthlyIncome.toLocaleString()}</p>
              </div>
              <DollarSign className="h-6 w-6 text-blue-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <Card className="rounded-xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Property Timeline</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {property.timeline.map((item, idx) => (
              <div key={idx} className="flex items-center gap-4 p-3 rounded-lg border bg-card/50">
                <Badge variant="outline" className="text-xs">{item.date}</Badge>
                <span className="text-sm">{item.event}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
