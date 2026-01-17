import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { 
  MapPin, Calendar, Clock, Eye, AlertTriangle, 
  Lightbulb, Plus, User, Camera, CheckCircle
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import type { WholesalerVisit } from '@/hooks/useWholesalerIntelligence';

interface WholesalerVisitsProps {
  visits: WholesalerVisit[];
  profile: any;
  onAddVisit: (data: Partial<WholesalerVisit>) => Promise<void>;
}

export function WholesalerVisitsSection({ visits, profile, onAddVisit }: WholesalerVisitsProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    visit_type: 'routine',
    duration_minutes: 30,
    observations: '',
    visibility_score: 5,
    placement_feedback: '',
    follow_up_required: false,
    follow_up_notes: '',
  });

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onAddVisit({
        ...formData,
        visit_date: new Date().toISOString(),
      });
      setAddOpen(false);
      setFormData({
        visit_type: 'routine',
        duration_minutes: 30,
        observations: '',
        visibility_score: 5,
        placement_feedback: '',
        follow_up_required: false,
        follow_up_notes: '',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const lastVisit = visits[0];
  const daysSinceLastVisit = lastVisit 
    ? differenceInDays(new Date(), new Date(lastVisit.visit_date))
    : null;
  
  const visitFrequency = profile?.visit_frequency_days || 30;
  const isOverdue = daysSinceLastVisit !== null && daysSinceLastVisit > visitFrequency;

  const getVisitTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'routine': return 'bg-blue-500/20 text-blue-400';
      case 'sales': return 'bg-green-500/20 text-green-400';
      case 'issue': return 'bg-red-500/20 text-red-400';
      case 'audit': return 'bg-purple-500/20 text-purple-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getVisibilityColor = (score: number) => {
    if (score >= 8) return 'text-green-400';
    if (score >= 5) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5 text-orange-500" />
            Field Visits & Observations
          </CardTitle>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Log Visit
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Log Field Visit</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto pr-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Visit Type</label>
                    <Select 
                      value={formData.visit_type}
                      onValueChange={(v) => setFormData(p => ({ ...p, visit_type: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="routine">Routine</SelectItem>
                        <SelectItem value="sales">Sales</SelectItem>
                        <SelectItem value="issue">Issue Resolution</SelectItem>
                        <SelectItem value="introduction">Introduction</SelectItem>
                        <SelectItem value="audit">Audit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Duration (mins)</label>
                    <Input 
                      type="number"
                      value={formData.duration_minutes}
                      onChange={(e) => setFormData(p => ({ ...p, duration_minutes: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Product Visibility (1-10)</label>
                  <div className="flex items-center gap-4 mt-2">
                    <Slider 
                      value={[formData.visibility_score]}
                      onValueChange={([v]) => setFormData(p => ({ ...p, visibility_score: v }))}
                      max={10}
                      min={1}
                      step={1}
                      className="flex-1"
                    />
                    <span className={`text-lg font-bold w-8 ${getVisibilityColor(formData.visibility_score)}`}>
                      {formData.visibility_score}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Observations</label>
                  <Textarea 
                    value={formData.observations}
                    onChange={(e) => setFormData(p => ({ ...p, observations: e.target.value }))}
                    placeholder="What did you observe?"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Placement Feedback</label>
                  <Textarea 
                    value={formData.placement_feedback}
                    onChange={(e) => setFormData(p => ({ ...p, placement_feedback: e.target.value }))}
                    placeholder="How are products displayed?"
                    rows={2}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox"
                    id="follow_up"
                    checked={formData.follow_up_required}
                    onChange={(e) => setFormData(p => ({ ...p, follow_up_required: e.target.checked }))}
                    className="rounded"
                  />
                  <label htmlFor="follow_up" className="text-sm">Follow-up required</label>
                </div>
                {formData.follow_up_required && (
                  <div>
                    <label className="text-sm font-medium">Follow-up Notes</label>
                    <Textarea 
                      value={formData.follow_up_notes}
                      onChange={(e) => setFormData(p => ({ ...p, follow_up_notes: e.target.value }))}
                      placeholder="What needs to be done?"
                      rows={2}
                    />
                  </div>
                )}
                <Button 
                  className="w-full" 
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Log Visit'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Visit Status Alert */}
        {isOverdue && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-sm font-medium text-amber-400">Visit Overdue</p>
              <p className="text-xs text-muted-foreground">
                Last visit was {daysSinceLastVisit} days ago. Schedule frequency is {visitFrequency} days.
              </p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <Calendar className="h-5 w-5 mx-auto text-orange-500 mb-1" />
            <p className="text-2xl font-bold">{visits.length}</p>
            <p className="text-xs text-muted-foreground">Total Visits</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <Clock className="h-5 w-5 mx-auto text-blue-500 mb-1" />
            <p className="text-2xl font-bold">{daysSinceLastVisit ?? '-'}</p>
            <p className="text-xs text-muted-foreground">Days Since Last</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <Eye className="h-5 w-5 mx-auto text-green-500 mb-1" />
            <p className="text-2xl font-bold">
              {lastVisit?.visibility_score ?? '-'}
            </p>
            <p className="text-xs text-muted-foreground">Last Visibility</p>
          </div>
        </div>

        {/* Visit History */}
        <ScrollArea className="h-48">
          <div className="space-y-3">
            {visits.map((visit) => (
              <div 
                key={visit.id}
                className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className={getVisitTypeColor(visit.visit_type)}>
                      {visit.visit_type}
                    </Badge>
                    {visit.follow_up_required && (
                      <Badge variant="outline" className="text-amber-400 border-amber-500/30">
                        Follow-up needed
                      </Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(visit.visit_date), 'MMM d, yyyy')}
                    </p>
                    {visit.duration_minutes && (
                      <p className="text-xs text-muted-foreground">{visit.duration_minutes} min</p>
                    )}
                  </div>
                </div>
                
                {visit.observations && (
                  <p className="text-sm text-muted-foreground">{visit.observations}</p>
                )}
                
                <div className="flex items-center gap-4 mt-2 text-xs">
                  {visit.visibility_score && (
                    <span className={`flex items-center gap-1 ${getVisibilityColor(visit.visibility_score)}`}>
                      <Eye className="h-3 w-3" />
                      Visibility: {visit.visibility_score}/10
                    </span>
                  )}
                  {visit.issues_found && visit.issues_found.length > 0 && (
                    <span className="flex items-center gap-1 text-red-400">
                      <AlertTriangle className="h-3 w-3" />
                      {visit.issues_found.length} issues
                    </span>
                  )}
                  {visit.opportunities && visit.opportunities.length > 0 && (
                    <span className="flex items-center gap-1 text-green-400">
                      <Lightbulb className="h-3 w-3" />
                      {visit.opportunities.length} opportunities
                    </span>
                  )}
                </div>
              </div>
            ))}
            {visits.length === 0 && (
              <div className="text-center py-8">
                <MapPin className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No visits recorded</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => setAddOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Log First Visit
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
