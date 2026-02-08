// ═══════════════════════════════════════════════════════════════════════════════
// FLOOR 5 — Operational Finance Hub (Brand-Level)
// Revenue, Invoicing, Unpaid, COGS, Payroll, Expenses
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DollarSign, FileText, AlertTriangle, Boxes,
  Users, Receipt, Plus, ArrowRight,
} from 'lucide-react';

import { Floor5RevenueTracker } from '@/components/floor5';
import { Floor5COGSTracker } from '@/components/floor5';
import { Floor5ExpensesView } from '@/components/floor5';
import { Floor5PayrollView } from '@/components/floor5';
import Floor5InvoicesTab from './Floor5InvoicesTab';
import Floor5UnpaidTab from './Floor5UnpaidTab';

export default function Floor5Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 shadow-lg">
            <DollarSign className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Floor 5: Finance & Orders
            </h1>
            <p className="text-sm text-muted-foreground">
              Operational finance — revenue, billing, payroll & costs per brand
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button size="sm" onClick={() => navigate('/billing/invoices/new')}>
            <Plus className="h-4 w-4 mr-1" /> New Invoice
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate('/os/owner/accounting')}>
            Accounting OS <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabbed Layout */}
      <Tabs defaultValue="revenue" className="space-y-6">
        <TabsList className="bg-muted/50 flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="revenue" className="gap-1.5 data-[state=active]:bg-primary/20">
            <DollarSign className="h-3.5 w-3.5" />
            Revenue
          </TabsTrigger>
          <TabsTrigger value="invoices" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Invoices
          </TabsTrigger>
          <TabsTrigger value="unpaid" className="gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Unpaid
          </TabsTrigger>
          <TabsTrigger value="cogs" className="gap-1.5">
            <Boxes className="h-3.5 w-3.5" />
            COGS
          </TabsTrigger>
          <TabsTrigger value="payroll" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Payroll
          </TabsTrigger>
          <TabsTrigger value="expenses" className="gap-1.5">
            <Receipt className="h-3.5 w-3.5" />
            Expenses
          </TabsTrigger>
        </TabsList>

        <TabsContent value="revenue">
          <Floor5RevenueTracker />
        </TabsContent>

        <TabsContent value="invoices">
          <Floor5InvoicesTab />
        </TabsContent>

        <TabsContent value="unpaid">
          <Floor5UnpaidTab />
        </TabsContent>

        <TabsContent value="cogs">
          <Floor5COGSTracker />
        </TabsContent>

        <TabsContent value="payroll">
          <Floor5PayrollView />
        </TabsContent>

        <TabsContent value="expenses">
          <Floor5ExpensesView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
