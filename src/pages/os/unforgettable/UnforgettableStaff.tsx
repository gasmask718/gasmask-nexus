import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, Search, Phone, Mail, Calendar, 
  Star, ChevronRight, UserPlus, MapPin, Loader2
} from "lucide-react";
import { useStaffList, useStaffCategories } from '@/hooks/useUnforgettableStaff';
import { GlobalAddButton } from '@/components/crud/GlobalAddButton';

// US States list
const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

export default function UnforgettableStaff() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('all');

  const { data: staff = [], isLoading: staffLoading } = useStaffList();
  const { data: categories = [], isLoading: categoriesLoading } = useStaffCategories();

  const isLoading = staffLoading || categoriesLoading;

  const filteredStaff = useMemo(() => {
    return staff.filter(member => {
      const fullName = `${member.first_name} ${member.last_name}`.toLowerCase();
      const matchesSearch = fullName.includes(searchTerm.toLowerCase()) ||
        member.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.phone?.includes(searchTerm);
      const matchesCategory = categoryFilter === 'all' || member.category_id === categoryFilter;
      const matchesState = stateFilter === 'all' || member.state === stateFilter;
      const matchesStatus = statusFilter === 'all' || member.status === statusFilter;
      
      // Tab filter
      const matchesTab = activeTab === 'all' || 
        (activeTab === 'active' && member.status === 'active') ||
        (activeTab === 'inactive' && member.status === 'inactive');
      
      return matchesSearch && matchesCategory && matchesState && matchesStatus && matchesTab;
    });
  }, [staff, searchTerm, categoryFilter, stateFilter, statusFilter, activeTab]);

  const staffCounts = useMemo(() => {
    return {
      all: staff.length,
      active: staff.filter(s => s.status === 'active').length,
      inactive: staff.filter(s => s.status === 'inactive').length,
    };
  }, [staff]);

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'Uncategorized';
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Unknown';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'inactive':
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-purple-500 bg-clip-text text-transparent">
            Staff Management
          </h1>
          <p className="text-muted-foreground mt-1">Manage all staff members and personnel</p>
        </div>
        <Button 
          onClick={() => navigate('/os/unforgettable/staff/new')}
          className="bg-gradient-to-r from-pink-600 to-purple-500 hover:from-pink-700 hover:to-purple-600"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Add Staff Member
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card 
          className={`border-border/50 cursor-pointer transition-colors ${activeTab === 'all' ? 'border-pink-500' : 'hover:border-pink-500/30'}`}
          onClick={() => setActiveTab('all')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Staff</p>
                <p className="text-2xl font-bold mt-1">{staffCounts.all}</p>
              </div>
              <div className="p-2 rounded-lg bg-pink-500/10">
                <Users className="h-5 w-5 text-pink-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`border-border/50 cursor-pointer transition-colors ${activeTab === 'active' ? 'border-emerald-500' : 'hover:border-emerald-500/30'}`}
          onClick={() => setActiveTab('active')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Active</p>
                <p className="text-2xl font-bold mt-1">{staffCounts.active}</p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Users className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`border-border/50 cursor-pointer transition-colors ${activeTab === 'inactive' ? 'border-gray-500' : 'hover:border-gray-500/30'}`}
          onClick={() => setActiveTab('inactive')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Inactive</p>
                <p className="text-2xl font-bold mt-1">{staffCounts.inactive}</p>
              </div>
              <div className="p-2 rounded-lg bg-gray-500/10">
                <Users className="h-5 w-5 text-gray-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by name, email, or phone..." 
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {US_STATES.map(state => (
                  <SelectItem key={state} value={state}>{state}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Staff Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="all">All Staff ({staffCounts.all})</TabsTrigger>
          <TabsTrigger value="active">Active ({staffCounts.active})</TabsTrigger>
          <TabsTrigger value="inactive">Inactive ({staffCounts.inactive})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-pink-500" />
                Staff Directory ({filteredStaff.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredStaff.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Staff Members Found</h3>
                  <p className="text-muted-foreground mb-4">
                    {staff.length === 0 
                      ? "Get started by adding your first staff member."
                      : "Try adjusting your filters to find staff members."}
                  </p>
                  {staff.length === 0 && (
                    <Button 
                      onClick={() => navigate('/os/unforgettable/staff/new')}
                      className="bg-gradient-to-r from-pink-600 to-purple-500"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add First Staff Member
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">Name</th>
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">Category</th>
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">Location</th>
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">Contact</th>
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">Pay Rate</th>
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStaff.map((member) => (
                        <tr 
                          key={member.id} 
                          className="border-b border-border/30 hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => navigate(`/os/unforgettable/staff/${member.id}`)}
                        >
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center">
                                <span className="text-sm font-semibold text-pink-600">
                                  {member.first_name?.[0]}{member.last_name?.[0]}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium">{member.first_name} {member.last_name}</p>
                                <p className="text-xs text-muted-foreground">{member.email || 'No email'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20">
                              {getCategoryName(member.category_id)}
                            </Badge>
                          </td>
                          <td className="p-3">
                            {member.city && member.state ? (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <MapPin className="h-4 w-4" />
                                <span>{member.city}, {member.state}</span>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              {member.phone && (
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(`tel:${member.phone}`);
                                  }}
                                >
                                  <Phone className="h-4 w-4" />
                                </Button>
                              )}
                              {member.email && (
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(`mailto:${member.email}`);
                                  }}
                                >
                                  <Mail className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            {member.pay_rate ? (
                              <span className="text-sm">
                                ${member.pay_rate}/{member.pay_type === 'hourly' ? 'hr' : 'flat'}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className={getStatusBadge(member.status || 'active')}>
                              {member.status === 'active' ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/os/unforgettable/staff/${member.id}`);
                              }}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Category Quick Stats */}
      {categories.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Staff by Category</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {categories.filter(c => c.is_active).map(category => {
              const categoryStaff = staff.filter(s => s.category_id === category.id);
              return (
                <Card 
                  key={category.id} 
                  className="border-border/50 hover:border-pink-500/30 transition-colors cursor-pointer"
                  onClick={() => setCategoryFilter(category.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-sm">{category.name}</h3>
                        <p className="text-2xl font-bold mt-1">{categoryStaff.length}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-purple-500/10">
                        <Users className="h-4 w-4 text-purple-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            <Card 
              className="border-border/50 border-dashed hover:border-pink-500/30 transition-colors cursor-pointer"
              onClick={() => navigate('/os/unforgettable/staff/categories')}
            >
              <CardContent className="p-4 flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">Manage Categories →</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Floating Add Button */}
      <GlobalAddButton 
        label="Add Staff Member"
        onClick={() => navigate('/os/unforgettable/staff/new')}
        variant="floating"
      />
    </div>
  );
}
