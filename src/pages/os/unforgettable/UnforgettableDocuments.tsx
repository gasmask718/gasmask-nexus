import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  FileText,
  Upload,
  Download,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Shield,
  Award,
  Calendar,
  Eye
} from 'lucide-react';

// Mock documents data
const mockDocuments = [
  { id: '1', name: 'Marcus Johnson', type: 'Contract', title: 'Employment Agreement', uploadDate: '2024-01-10', expiryDate: '2025-01-10', status: 'valid' },
  { id: '2', name: 'Sarah Chen', type: 'Certification', title: 'Event Planning Certificate', uploadDate: '2023-06-15', expiryDate: '2024-06-15', status: 'expiring_soon' },
  { id: '3', name: 'Mike Torres', type: 'License', title: 'Bartending License', uploadDate: '2023-08-20', expiryDate: '2025-08-20', status: 'valid' },
  { id: '4', name: 'Jessica Williams', type: 'Contract', title: 'Freelance Agreement', uploadDate: '2024-01-05', expiryDate: '2024-12-31', status: 'valid' },
  { id: '5', name: 'David Kim', type: 'Certification', title: 'OSHA Safety Training', uploadDate: '2023-03-01', expiryDate: '2024-03-01', status: 'expired' },
  { id: '6', name: 'Amanda Brown', type: 'Insurance', title: 'Liability Insurance', uploadDate: '2024-01-01', expiryDate: '2025-01-01', status: 'valid' },
];

const mockCertifications = [
  { id: '1', name: 'Food Handler Certification', required: true, staffWith: 12, staffWithout: 3 },
  { id: '2', name: 'Alcohol Service License', required: true, staffWith: 8, staffWithout: 0 },
  { id: '3', name: 'CPR/First Aid', required: false, staffWith: 15, staffWithout: 10 },
  { id: '4', name: 'Event Safety Training', required: true, staffWith: 20, staffWithout: 5 },
  { id: '5', name: 'Fire Safety Certificate', required: false, staffWith: 18, staffWithout: 7 },
];

export default function UnforgettableDocuments() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const filteredDocuments = mockDocuments.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || doc.type.toLowerCase() === typeFilter;
    return matchesSearch && matchesType;
  });

  const validDocs = mockDocuments.filter(d => d.status === 'valid').length;
  const expiringDocs = mockDocuments.filter(d => d.status === 'expiring_soon').length;
  const expiredDocs = mockDocuments.filter(d => d.status === 'expired').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'valid':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Valid</Badge>;
      case 'expiring_soon':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Expiring Soon</Badge>;
      case 'expired':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'Contract':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">{type}</Badge>;
      case 'Certification':
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">{type}</Badge>;
      case 'License':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{type}</Badge>;
      case 'Insurance':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">{type}</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Documents & Certifications</h1>
          <p className="text-muted-foreground">Manage staff contracts, certifications, and compliance documents</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90">
          <Upload className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <FileText className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Documents</p>
                <p className="text-2xl font-bold text-foreground">{mockDocuments.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valid</p>
                <p className="text-2xl font-bold text-foreground">{validDocs}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <AlertCircle className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Expiring Soon</p>
                <p className="text-2xl font-bold text-foreground">{expiringDocs}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <XCircle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Expired</p>
                <p className="text-2xl font-bold text-foreground">{expiredDocs}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="documents" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="documents">All Documents</TabsTrigger>
          <TabsTrigger value="certifications">Certifications</TabsTrigger>
          <TabsTrigger value="compliance">Compliance Status</TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-background border-border"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40 bg-background border-border">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="contract">Contracts</SelectItem>
                <SelectItem value="certification">Certifications</SelectItem>
                <SelectItem value="license">Licenses</SelectItem>
                <SelectItem value="insurance">Insurance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Documents Table */}
          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Staff Member</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">Type</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Document</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">Uploaded</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">Expires</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.map((doc) => (
                    <tr key={doc.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <p className="font-medium text-foreground">{doc.name}</p>
                      </td>
                      <td className="p-4 text-center">{getTypeBadge(doc.type)}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-foreground">{doc.title}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center text-muted-foreground">{doc.uploadDate}</td>
                      <td className="p-4 text-center text-muted-foreground">{doc.expiryDate}</td>
                      <td className="p-4 text-center">{getStatusBadge(doc.status)}</td>
                      <td className="p-4 text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="certifications" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Certification Requirements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockCertifications.map((cert) => (
                  <div key={cert.id} className="p-4 rounded-lg border border-border bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Award className="h-5 w-5 text-primary" />
                        <p className="font-medium text-foreground">{cert.name}</p>
                        {cert.required && (
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Required</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        <span className="text-sm text-muted-foreground">{cert.staffWith} staff certified</span>
                      </div>
                      {cert.staffWithout > 0 && (
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-400" />
                          <span className="text-sm text-muted-foreground">{cert.staffWithout} staff missing</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-2">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${(cert.staffWith / (cert.staffWith + cert.staffWithout)) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5 text-emerald-400" />
                  Compliant Staff
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {['Marcus Johnson', 'Mike Torres', 'Jessica Williams', 'Amanda Brown'].map((name, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/30">
                      <span className="text-foreground">{name}</span>
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Compliant
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-400" />
                  Action Required
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="p-3 rounded bg-amber-500/10 border border-amber-500/30">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">Sarah Chen</span>
                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                        <Clock className="h-3 w-3 mr-1" />
                        Expiring
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Event Planning Certificate expires in 30 days</p>
                  </div>
                  <div className="p-3 rounded bg-red-500/10 border border-red-500/30">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">David Kim</span>
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                        <XCircle className="h-3 w-3 mr-1" />
                        Expired
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">OSHA Safety Training expired on 2024-03-01</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
