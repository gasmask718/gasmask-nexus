import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Building2, Scale, FileText, Star } from "lucide-react";
import { toast } from "sonner";

export default function RealEstatePartners() {
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    company_name: "",
    partner_type: "title_company",
    contact_name: "",
    email: "",
    phone: "",
    state: "",
    states_served: "",
    wholesale_friendly: true,
    average_close_days: "",
    fees_range: "",
    notes: "",
  });

  useEffect(() => {
    fetchPartners();
  }, []);

  const fetchPartners = async () => {
    try {
      const { data, error } = await supabase
        .from("closing_partners")
        .select("*")
        .order("company_name");

      if (error) throw error;
      setPartners(data || []);
    } catch (error) {
      console.error("Error fetching partners:", error);
      toast.error("Failed to load partners");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from("closing_partners").insert([{
        ...formData,
        states_served: formData.states_served.split(",").map(s => s.trim()),
        average_close_days: formData.average_close_days ? parseInt(formData.average_close_days) : null,
      }]);

      if (error) throw error;
      toast.success("Partner added successfully");
      setDialogOpen(false);
      fetchPartners();
      setFormData({
        company_name: "",
        partner_type: "title_company",
        contact_name: "",
        email: "",
        phone: "",
        state: "",
        states_served: "",
        wholesale_friendly: true,
        average_close_days: "",
        fees_range: "",
        notes: "",
      });
    } catch (error) {
      console.error("Error adding partner:", error);
      toast.error("Failed to add partner");
    }
  };

  const getPartnerIcon = (type: string) => {
    switch (type) {
      case "title_company": return Building2;
      case "attorney": return Scale;
      default: return FileText;
    }
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold mb-2">Closing Partners Directory</h1>
          <p className="text-muted-foreground">
            Manage title companies, attorneys, and closing agents
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Partner
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Closing Partner</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Company Name</Label>
                  <Input
                    required
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Partner Type</Label>
                  <Select
                    value={formData.partner_type}
                    onValueChange={(value) => setFormData({ ...formData, partner_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="title_company">Title Company</SelectItem>
                      <SelectItem value="attorney">Attorney</SelectItem>
                      <SelectItem value="closing_agent">Closing Agent</SelectItem>
                      <SelectItem value="escrow">Escrow</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Contact Name</Label>
                  <Input
                    value={formData.contact_name}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Primary State</Label>
                  <Input
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="GA"
                  />
                </div>
                <div>
                  <Label>States Served (comma-separated)</Label>
                  <Input
                    value={formData.states_served}
                    onChange={(e) => setFormData({ ...formData, states_served: e.target.value })}
                    placeholder="GA, FL, TN"
                  />
                </div>
                <div>
                  <Label>Average Close Days</Label>
                  <Input
                    type="number"
                    value={formData.average_close_days}
                    onChange={(e) => setFormData({ ...formData, average_close_days: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Fees Range</Label>
                  <Input
                    value={formData.fees_range}
                    onChange={(e) => setFormData({ ...formData, fees_range: e.target.value })}
                    placeholder="$500-$1000"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full">Add Partner</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Partners</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{partners.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Wholesale Friendly</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {partners.filter(p => p.wholesale_friendly).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">States Covered</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {new Set(partners.flatMap(p => p.states_served || [])).size}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Close Time</CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {Math.round(
                partners.filter(p => p.average_close_days).reduce((sum, p) => sum + p.average_close_days, 0) /
                partners.filter(p => p.average_close_days).length || 0
              )} days
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Partners</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading partners...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>States</TableHead>
                  <TableHead>Close Time</TableHead>
                  <TableHead>Wholesale</TableHead>
                  <TableHead>Rating</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.map((partner) => {
                  const Icon = getPartnerIcon(partner.partner_type);
                  return (
                    <TableRow key={partner.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{partner.company_name}</div>
                            <div className="text-sm text-muted-foreground">{partner.state}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {partner.partner_type.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div>{partner.contact_name || "—"}</div>
                          <div className="text-sm text-muted-foreground">{partner.email || "—"}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {partner.states_served?.length || 0} states
                      </TableCell>
                      <TableCell>
                        {partner.average_close_days ? `${partner.average_close_days} days` : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={partner.wholesale_friendly ? "default" : "secondary"}>
                          {partner.wholesale_friendly ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {partner.rating ? (
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 fill-primary text-primary" />
                            <span>{partner.rating.toFixed(1)}</span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
