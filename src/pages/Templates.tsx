import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, Plus, Edit, Archive, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function Templates() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const [formData, setFormData] = useState({
    name: "",
    category: "store",
    message_template: "",
    is_active: true,
  });

  const { data: templates, isLoading } = useQuery({
    queryKey: ['communication-templates', searchQuery, categoryFilter],
    queryFn: async () => {
      let query = supabase
        .from('communication_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (searchQuery) {
        query = query.ilike('name', `%${searchQuery}%`);
      }

      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter as any);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const createTemplate = useMutation({
    mutationFn: async (data: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('communication_templates')
        .insert({
          ...data,
          created_by: user.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template created successfully");
      queryClient.invalidateQueries({ queryKey: ['communication-templates'] });
      setOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Failed to create template: " + error.message);
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase
        .from('communication_templates')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template updated successfully");
      queryClient.invalidateQueries({ queryKey: ['communication-templates'] });
      setOpen(false);
      setEditingTemplate(null);
      resetForm();
    },
    onError: (error) => {
      toast.error("Failed to update template: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTemplate) {
      updateTemplate.mutate({ id: editingTemplate.id, data: formData });
    } else {
      createTemplate.mutate(formData);
    }
  };

  const handleEdit = (template: any) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      category: template.category,
      message_template: template.message_template,
      is_active: template.is_active,
    });
    setOpen(true);
  };

  const handleArchive = (template: any) => {
    updateTemplate.mutate({
      id: template.id,
      data: { is_active: !template.is_active },
    });
  };

  const resetForm = () => {
    setFormData({
      name: "",
      category: "store",
      message_template: "",
      is_active: true,
    });
    setEditingTemplate(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-muted-foreground">Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Communication Templates</h1>
            <p className="text-muted-foreground">Manage reusable message templates</p>
          </div>
          
          <Dialog open={open} onOpenChange={(o) => {
            setOpen(o);
            if (!o) {
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingTemplate ? 'Edit Template' : 'Create Template'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Template Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="e.g., Follow-up after delivery"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger id="category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="store">Store</SelectItem>
                      <SelectItem value="wholesaler">Wholesaler</SelectItem>
                      <SelectItem value="influencer">Influencer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message Template</Label>
                  <Textarea
                    id="message"
                    value={formData.message_template}
                    onChange={(e) => setFormData({ ...formData, message_template: e.target.value })}
                    required
                    rows={6}
                    placeholder="Type your message template here..."
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.message_template.length} characters
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="active">Active</Label>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createTemplate.isPending || updateTemplate.isPending}>
                    {editingTemplate ? 'Update' : 'Create'} Template
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Search</Label>
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="store">Store</SelectItem>
                  <SelectItem value="wholesaler">Wholesaler</SelectItem>
                  <SelectItem value="influencer">Influencer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Templates List */}
        <div className="grid gap-4">
          {templates?.map((template) => (
            <Card key={template.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <CardTitle>{template.name}</CardTitle>
                      <Badge variant={template.is_active ? "default" : "secondary"}>
                        {template.is_active ? 'Active' : 'Archived'}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {template.category}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Created {format(new Date(template.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(template)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleArchive(template)}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm whitespace-pre-wrap">{template.message_template}</p>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-4 w-4" />
                      <span>Used {template.usage_count || 0} times</span>
                    </div>
                    {template.last_used_at && (
                      <span>
                        Last used: {format(new Date(template.last_used_at), 'MMM d, yyyy')}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {(!templates || templates.length === 0) && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No templates found</p>
                <Button onClick={() => setOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Template
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}