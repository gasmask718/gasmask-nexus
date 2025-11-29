// ═══════════════════════════════════════════════════════════════════════════════
// FOLLOW-UP SETTINGS PAGE — Configure automated follow-up rules
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFollowUpEngine } from '@/hooks/useFollowUpEngine';
import { toast } from 'sonner';
import { 
  FileText, 
  Store, 
  Package, 
  Truck, 
  Users,
  Save,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function FollowUpSettings() {
  const navigate = useNavigate();
  const { settings, updateSettings, loading } = useFollowUpEngine();
  const [saving, setSaving] = useState(false);
  const [localSettings, setLocalSettings] = useState(settings);

  React.useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  const handleSave = async (category: string) => {
    if (!localSettings) return;
    setSaving(true);
    try {
      const success = await updateSettings(category, (localSettings as any)[category]);
      if (success) {
        toast.success(`${category} settings saved`);
      } else {
        toast.error('Failed to save settings');
      }
    } catch {
      toast.error('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const updateLocalSetting = (category: string, key: string, value: any) => {
    setLocalSettings((prev: any) => ({
      ...prev,
      [category]: {
        ...prev?.[category],
        [key]: value,
      },
    }));
  };

  if (loading || !localSettings) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Follow-Up Settings</h1>
          <p className="text-muted-foreground">Configure automated follow-up rules and messages</p>
        </div>
      </div>

      <Tabs defaultValue="invoice" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="invoice" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Invoice
          </TabsTrigger>
          <TabsTrigger value="store" className="flex items-center gap-2">
            <Store className="h-4 w-4" />
            Store
          </TabsTrigger>
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Inventory
          </TabsTrigger>
          <TabsTrigger value="driver" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Driver
          </TabsTrigger>
          <TabsTrigger value="ambassador" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Ambassador
          </TabsTrigger>
        </TabsList>

        {/* Invoice Settings */}
        <TabsContent value="invoice">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Follow-Up Rules</CardTitle>
              <CardDescription>Configure automatic invoice reminder messages and escalation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <Label htmlFor="invoice-auto">Enable Auto Reminders</Label>
                <Switch
                  id="invoice-auto"
                  checked={localSettings.invoice?.auto_reminder_enabled}
                  onCheckedChange={(v) => updateLocalSetting('invoice', 'auto_reminder_enabled', v)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Max Reminders Before Escalation</Label>
                  <Input
                    type="number"
                    value={localSettings.invoice?.max_reminders || 4}
                    onChange={(e) => updateLocalSetting('invoice', 'max_reminders', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Escalation After Days</Label>
                  <Input
                    type="number"
                    value={localSettings.invoice?.escalation_after_days || 15}
                    onChange={(e) => updateLocalSetting('invoice', 'escalation_after_days', parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Day 1 Message (Friendly)</Label>
                  <Textarea
                    value={localSettings.invoice?.day1_message || ''}
                    onChange={(e) => updateLocalSetting('invoice', 'day1_message', e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Day 5 Message</Label>
                  <Textarea
                    value={localSettings.invoice?.day5_message || ''}
                    onChange={(e) => updateLocalSetting('invoice', 'day5_message', e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Day 10 Message</Label>
                  <Textarea
                    value={localSettings.invoice?.day10_message || ''}
                    onChange={(e) => updateLocalSetting('invoice', 'day10_message', e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Day 15+ Message (Urgent)</Label>
                  <Textarea
                    value={localSettings.invoice?.day15_message || ''}
                    onChange={(e) => updateLocalSetting('invoice', 'day15_message', e.target.value)}
                    rows={2}
                  />
                </div>
              </div>

              <Button onClick={() => handleSave('invoice')} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Invoice Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Store Settings */}
        <TabsContent value="store">
          <Card>
            <CardHeader>
              <CardTitle>Store Visit & Churn Rules</CardTitle>
              <CardDescription>Configure store recovery and visit scheduling</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <Label htmlFor="store-route">Enable Auto Route Creation</Label>
                <Switch
                  id="store-route"
                  checked={localSettings.store?.auto_route_enabled}
                  onCheckedChange={(v) => updateLocalSetting('store', 'auto_route_enabled', v)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Churn Warning (Days)</Label>
                  <Input
                    type="number"
                    value={localSettings.store?.churn_threshold_days || 14}
                    onChange={(e) => updateLocalSetting('store', 'churn_threshold_days', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Critical Churn (Days)</Label>
                  <Input
                    type="number"
                    value={localSettings.store?.critical_churn_days || 30}
                    onChange={(e) => updateLocalSetting('store', 'critical_churn_days', parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Auto Reminder Message</Label>
                  <Textarea
                    value={localSettings.store?.auto_reminder_message || ''}
                    onChange={(e) => updateLocalSetting('store', 'auto_reminder_message', e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Recovery Message (Critical)</Label>
                  <Textarea
                    value={localSettings.store?.recovery_message || ''}
                    onChange={(e) => updateLocalSetting('store', 'recovery_message', e.target.value)}
                    rows={2}
                  />
                </div>
              </div>

              <Button onClick={() => handleSave('store')} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Store Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inventory Settings */}
        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <CardTitle>Inventory & Reorder Rules</CardTitle>
              <CardDescription>Configure low stock alerts and reorder automation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <Label htmlFor="inv-auto">Enable Auto Reorder</Label>
                <Switch
                  id="inv-auto"
                  checked={localSettings.inventory?.auto_reorder_enabled}
                  onCheckedChange={(v) => updateLocalSetting('inventory', 'auto_reorder_enabled', v)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="inv-notify">Notify Supplier</Label>
                <Switch
                  id="inv-notify"
                  checked={localSettings.inventory?.notify_supplier}
                  onCheckedChange={(v) => updateLocalSetting('inventory', 'notify_supplier', v)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Low Stock Threshold (%)</Label>
                  <Input
                    type="number"
                    value={localSettings.inventory?.low_stock_threshold_percent || 25}
                    onChange={(e) => updateLocalSetting('inventory', 'low_stock_threshold_percent', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reorder Lead Days</Label>
                  <Input
                    type="number"
                    value={localSettings.inventory?.reorder_lead_days || 3}
                    onChange={(e) => updateLocalSetting('inventory', 'reorder_lead_days', parseInt(e.target.value))}
                  />
                </div>
              </div>

              <Button onClick={() => handleSave('inventory')} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Inventory Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Driver Settings */}
        <TabsContent value="driver">
          <Card>
            <CardHeader>
              <CardTitle>Driver Performance Rules</CardTitle>
              <CardDescription>Configure driver monitoring and alerts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <Label htmlFor="drv-reassign">Enable Auto Reassignment</Label>
                <Switch
                  id="drv-reassign"
                  checked={localSettings.driver?.auto_reassign_enabled}
                  onCheckedChange={(v) => updateLocalSetting('driver', 'auto_reassign_enabled', v)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="drv-alert">Alert Operations</Label>
                <Switch
                  id="drv-alert"
                  checked={localSettings.driver?.alert_operations}
                  onCheckedChange={(v) => updateLocalSetting('driver', 'alert_operations', v)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Late Threshold (min)</Label>
                  <Input
                    type="number"
                    value={localSettings.driver?.late_threshold_minutes || 30}
                    onChange={(e) => updateLocalSetting('driver', 'late_threshold_minutes', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Missed Stop Threshold</Label>
                  <Input
                    type="number"
                    value={localSettings.driver?.missed_stop_threshold || 2}
                    onChange={(e) => updateLocalSetting('driver', 'missed_stop_threshold', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Performance Review Days</Label>
                  <Input
                    type="number"
                    value={localSettings.driver?.performance_review_days || 7}
                    onChange={(e) => updateLocalSetting('driver', 'performance_review_days', parseInt(e.target.value))}
                  />
                </div>
              </div>

              <Button onClick={() => handleSave('driver')} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Driver Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ambassador Settings */}
        <TabsContent value="ambassador">
          <Card>
            <CardHeader>
              <CardTitle>Ambassador Engagement Rules</CardTitle>
              <CardDescription>Configure ambassador re-engagement and motivation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <Label htmlFor="amb-auto">Enable Auto Reactivation</Label>
                <Switch
                  id="amb-auto"
                  checked={localSettings.ambassador?.auto_reactivation_enabled}
                  onCheckedChange={(v) => updateLocalSetting('ambassador', 'auto_reactivation_enabled', v)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="amb-tips">Weekly Tips Enabled</Label>
                <Switch
                  id="amb-tips"
                  checked={localSettings.ambassador?.weekly_tips_enabled}
                  onCheckedChange={(v) => updateLocalSetting('ambassador', 'weekly_tips_enabled', v)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Inactivity Warning (Days)</Label>
                  <Input
                    type="number"
                    value={localSettings.ambassador?.inactivity_threshold_days || 14}
                    onChange={(e) => updateLocalSetting('ambassador', 'inactivity_threshold_days', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Critical Inactivity (Days)</Label>
                  <Input
                    type="number"
                    value={localSettings.ambassador?.critical_inactivity_days || 30}
                    onChange={(e) => updateLocalSetting('ambassador', 'critical_inactivity_days', parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Motivational Message</Label>
                <Textarea
                  value={localSettings.ambassador?.motivational_message || ''}
                  onChange={(e) => updateLocalSetting('ambassador', 'motivational_message', e.target.value)}
                  rows={3}
                />
              </div>

              <Button onClick={() => handleSave('ambassador')} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Ambassador Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
