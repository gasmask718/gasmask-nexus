import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Phone, Mail, MapPin } from "lucide-react";

export default function RealEstateLeads() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSource, setFilterSource] = useState("all");

  useEffect(() => {
    fetchLeads();
  }, [filterSource]);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("leads_raw")
        .select(`
          *,
          lead_scores(motivation_score, overall_score),
          seller_profiles(motivation_score, willingness_to_sell)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (filterSource !== "all") {
        query = query.eq("lead_source", filterSource as any);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error("Error fetching leads:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLeads = leads.filter((lead) =>
    lead.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.owner_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getScoreBadge = (score: number | undefined) => {
    if (!score) return <Badge variant="secondary">N/A</Badge>;
    if (score >= 75) return <Badge variant="default">Hot</Badge>;
    if (score >= 50) return <Badge variant="secondary">Warm</Badge>;
    return <Badge variant="outline">Cold</Badge>;
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">Lead Intelligence</h1>
        <p className="text-muted-foreground">AI-Scored Property Leads</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter & Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by address, city, or owner..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Filter by source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="probate">Probate</SelectItem>
                <SelectItem value="pre_foreclosure">Pre-Foreclosure</SelectItem>
                <SelectItem value="tax_delinquent">Tax Delinquent</SelectItem>
                <SelectItem value="code_violation">Code Violation</SelectItem>
                <SelectItem value="mls">MLS</SelectItem>
                <SelectItem value="expired_listing">Expired Listing</SelectItem>
                <SelectItem value="fsbo">FSBO</SelectItem>
                <SelectItem value="wholesale_network">Wholesale Network</SelectItem>
                <SelectItem value="zillow">Zillow</SelectItem>
                <SelectItem value="redfin">Redfin</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={fetchLeads}>Refresh</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leads ({filteredLeads.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading leads...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Address</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Property Type</TableHead>
                  <TableHead>Est. Value</TableHead>
                  <TableHead>AI Score</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{lead.address}</div>
                          <div className="text-sm text-muted-foreground">
                            {lead.city}, {lead.state} {lead.zip_code}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div>{lead.owner_name || "Unknown"}</div>
                        {lead.owner_phone && (
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {lead.owner_phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{lead.lead_source?.replace("_", " ")}</Badge>
                    </TableCell>
                    <TableCell>{lead.property_type?.replace("_", " ") || "N/A"}</TableCell>
                    <TableCell>${(lead.estimated_value || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      {getScoreBadge(lead.lead_scores?.[0]?.overall_score || lead.seller_profiles?.[0]?.motivation_score)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Phone className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline">
                          <Mail className="h-4 w-4" />
                        </Button>
                      </div>
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