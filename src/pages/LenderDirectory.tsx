import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Star, DollarSign, Clock, MapPin, Building2 } from "lucide-react";
import { toast } from "sonner";

export default function LenderDirectory() {
  const [lenders, setLenders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [formData, setFormData] = useState({
    lender_name: "",
    lender_type: "hard_money",
    contact_name: "",
    email: "",
    phone: "",
    website: "",
    states_active: "",
    min_loan_amount: "",
    max_loan_amount: "",
    min_credit_score: "",
    max_ltv: "",
    interest_rate_range: "",
    points_range: "",
    speed_to_close_days: "",
    rehab_holdback_available: false,
    notes: "",
  });

  useEffect(() => {
    fetchLenders();
  }, []);

  const fetchLenders = async () => {
    try {
      const { data, error } = await supabase
        .from("lenders")
        .select("*")
        .order("lender_name");

      if (error) throw error;
      setLenders(data || []);
    } catch (error) {
      console.error("Error fetching lenders:", error);
      toast.error("Failed to load lenders");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from("lenders").insert([{
        ...formData,
        states_active: formData.states_active.split(",").map(s => s.trim()),
        min_loan_amount: formData.min_loan_amount ? parseFloat(formData.min_loan_amount) : null,
        max_loan_amount: formData.max_loan_amount ? parseFloat(formData.max_loan_amount) : null,
        min_credit_score: formData.min_credit_score ? parseInt(formData.min_credit_score) : null,
        max_ltv: formData.max_ltv ? parseFloat(formData.max_ltv) : null,
        speed_to_close_days: formData.speed_to_close_days ? parseInt(formData.speed_to_close_days) : null,
      }]);

      if (error) throw error;
      toast.success("Lender added successfully");
      setDialogOpen(false);
      fetchLenders();
    } catch (error) {
      console.error("Error adding lender:", error);
      toast.error("Failed to add lender");
    }
  };

  const filteredLenders = filter === "all" ? lenders : lenders.filter(l => l.lender_type === filter);

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold mb-2">Lender Directory</h1>
          <p className="text-muted-foreground">Complete CRM of lending partners</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Lender
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Lender</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Lender Name</Label>
                  <Input
                    required
                    value={formData.lender_name}
                    onChange={(e) => setFormData({ ...formData, lender_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Lender Type</Label>
                  <Select
                    value={formData.lender_type}
                    onValueChange={(value) => setFormData({ ...formData, lender_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hard_money">Hard Money</SelectItem>
                      <SelectItem value="private_money">Private Money</SelectItem>
                      <SelectItem value="fund">Fund</SelectItem>
                      <SelectItem value="institutional">Institutional</SelectItem>
                      <SelectItem value="bank">Bank</SelectItem>
                      <SelectItem value="credit_union">Credit Union</SelectItem>
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
                  <Label>States Active (comma-separated)</Label>
                  <Input
                    value={formData.states_active}
                    onChange={(e) => setFormData({ ...formData, states_active: e.target.value })}
                    placeholder="GA, FL, TN"
                  />
                </div>
                <div>
                  <Label>Min Loan Amount</Label>
                  <Input
                    type="number"
                    value={formData.min_loan_amount}
                    onChange={(e) => setFormData({ ...formData, min_loan_amount: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Max Loan Amount</Label>
                  <Input
                    type="number"
                    value={formData.max_loan_amount}
                    onChange={(e) => setFormData({ ...formData, max_loan_amount: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Max LTV (%)</Label>
                  <Input
                    type="number"
                    value={formData.max_ltv}
                    onChange={(e) => setFormData({ ...formData, max_ltv: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Interest Rate Range</Label>
                  <Input
                    value={formData.interest_rate_range}
                    onChange={(e) => setFormData({ ...formData, interest_rate_range: e.target.value })}
                    placeholder="10-12%"
                  />
                </div>
                <div>
                  <Label>Points Range</Label>
                  <Input
                    value={formData.points_range}
                    onChange={(e) => setFormData({ ...formData, points_range: e.target.value })}
                    placeholder="2-3"
                  />
                </div>
                <div>
                  <Label>Speed to Close (days)</Label>
                  <Input
                    type="number"
                    value={formData.speed_to_close_days}
                    onChange={(e) => setFormData({ ...formData, speed_to_close_days: e.target.value })}
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
              <Button type="submit" className="w-full">Add Lender</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2">
        {["all", "hard_money", "private_money", "fund", "institutional"].map(type => (
          <Button
            key={type}
            variant={filter === type ? "default" : "outline"}
            onClick={() => setFilter(type)}
          >
            {type.replace("_", " ").toUpperCase()}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Lenders</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{filteredLenders.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Close Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {Math.round(
                filteredLenders.filter(l => l.speed_to_close_days).reduce((sum, l) => sum + l.speed_to_close_days, 0) /
                filteredLenders.filter(l => l.speed_to_close_days).length || 0
              )} days
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">States Covered</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {new Set(filteredLenders.flatMap(l => l.states_active || [])).size}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Max Loan</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ${(filteredLenders.filter(l => l.max_loan_amount).reduce((sum, l) => sum + l.max_loan_amount, 0) /
              filteredLenders.filter(l => l.max_loan_amount).length / 1000000 || 0).toFixed(1)}M
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Lenders</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading lenders...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lender</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Loan Range</TableHead>
                  <TableHead>Max LTV</TableHead>
                  <TableHead>Rate Range</TableHead>
                  <TableHead>Close Time</TableHead>
                  <TableHead>Rating</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLenders.map((lender) => (
                  <TableRow key={lender.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{lender.lender_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {lender.states_active?.length || 0} states
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {lender.lender_type.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div>{lender.contact_name || "—"}</div>
                        <div className="text-sm text-muted-foreground">{lender.email || "—"}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {lender.min_loan_amount && lender.max_loan_amount ? (
                        <div>
                          ${(lender.min_loan_amount / 1000).toFixed(0)}K - 
                          ${(lender.max_loan_amount / 1000000).toFixed(1)}M
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {lender.max_ltv ? `${lender.max_ltv}%` : "—"}
                    </TableCell>
                    <TableCell>
                      {lender.interest_rate_range || "—"}
                    </TableCell>
                    <TableCell>
                      {lender.speed_to_close_days ? `${lender.speed_to_close_days} days` : "—"}
                    </TableCell>
                    <TableCell>
                      {lender.rating ? (
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-primary text-primary" />
                          <span>{lender.rating.toFixed(1)}</span>
                        </div>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
