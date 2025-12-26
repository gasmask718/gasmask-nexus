import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, Search, Plus, Phone, Mail, Calendar, DollarSign, 
  Star, Clock, ChevronRight, Filter, UserPlus
} from "lucide-react";
import { 
  STAFF_DEPARTMENTS, 
  STAFF_ROLES, 
  STAFF_CATEGORIES,
  STAFF_STATUSES,
  EMPLOYMENT_TYPES,
  getRoleDisplayName,
  getRoleShortName,
  type UTStaffRole,
  type UTStaffCategory,
  type UTStaffStatus 
} from '@/config/unforgettableStaffConfig';

// Mock staff data for simulation
const generateMockStaff = () => {
  const firstNames = ['Maria', 'Carlos', 'Jessica', 'David', 'Sofia', 'Michael', 'Angela', 'Roberto', 'Diana', 'Luis', 'Carmen', 'Alex'];
  const lastNames = ['Rodriguez', 'Martinez', 'Garcia', 'Johnson', 'Williams', 'Brown', 'Davis', 'Lopez', 'Gonzalez', 'Wilson'];
  
  const roles: UTStaffRole[] = [
    'owner_managing_director', 'operations_director', 'event_production_manager',
    'event_coordinator_lead', 'event_coordinator_assistant', 'client_success_manager',
    'venue_relations_manager', 'vendor_relations_manager',
    'rental_operations_manager', 'setup_crew_lead', 'setup_crew_member', 'setup_crew_member',
    'dj_coordinator', 'dj', 'dj', 'mc_host',
    'catering_coordinator', 'bartender', 'bartender', 'server', 'server',
    'security_coordinator', 'security_guard', 'security_guard',
    'logistics_manager', 'driver', 'loader_runner',
    'photography_coordinator', 'photographer', 'videographer',
    'finance_manager', 'crm_data_manager',
    'marketing_manager', 'social_media_manager',
    'virtual_assistant', 'customer_support_rep'
  ];

  return roles.map((role, idx) => {
    const roleInfo = STAFF_ROLES[role];
    const firstName = firstNames[idx % firstNames.length];
    const lastName = lastNames[idx % lastNames.length];
    
    return {
      id: `staff-${idx + 1}`,
      first_name: firstName,
      last_name: lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@unforgettable.com`,
      phone: `(555) ${String(100 + idx).padStart(3, '0')}-${String(1000 + idx * 11).slice(0, 4)}`,
      role,
      category: roleInfo.defaultCategory,
      employment_type: roleInfo.defaultEmploymentType,
      status: idx < 30 ? 'active' : idx < 33 ? 'pending' : 'on_leave',
      department: roleInfo.department,
      hourly_rate: roleInfo.typicalHourlyRate?.min ? roleInfo.typicalHourlyRate.min + Math.random() * (roleInfo.typicalHourlyRate.max - roleInfo.typicalHourlyRate.min) : null,
      event_rate: roleInfo.typicalEventRate?.min ? roleInfo.typicalEventRate.min + Math.random() * (roleInfo.typicalEventRate.max - roleInfo.typicalEventRate.min) : null,
      events_completed: Math.floor(Math.random() * 50) + 5,
      rating: 4 + Math.random(),
      hire_date: new Date(2023, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
      total_earnings: Math.floor(Math.random() * 15000) + 2000
    };
  });
};

export default function UnforgettableStaff() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('all');

  const mockStaff = useMemo(() => generateMockStaff(), []);

  const filteredStaff = useMemo(() => {
    return mockStaff.filter(staff => {
      const matchesSearch = 
        `${staff.first_name} ${staff.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getRoleDisplayName(staff.role).toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || staff.category === categoryFilter;
      const matchesDepartment = departmentFilter === 'all' || staff.department === departmentFilter;
      const matchesStatus = statusFilter === 'all' || staff.status === statusFilter;
      const matchesTab = activeTab === 'all' || staff.category === activeTab;
      
      return matchesSearch && matchesCategory && matchesDepartment && matchesStatus && matchesTab;
    });
  }, [mockStaff, searchTerm, categoryFilter, departmentFilter, statusFilter, activeTab]);

  const staffCounts = useMemo(() => {
    return {
      all: mockStaff.length,
      internal_staff: mockStaff.filter(s => s.category === 'internal_staff').length,
      event_staff: mockStaff.filter(s => s.category === 'event_staff').length,
      vendor: mockStaff.filter(s => s.category === 'vendor').length,
      partner: mockStaff.filter(s => s.category === 'partner').length
    };
  }, [mockStaff]);

  const getStatusBadge = (status: string) => {
    const statusInfo = STAFF_STATUSES[status as UTStaffStatus];
    if (!statusInfo) return 'bg-muted text-muted-foreground';
    
    const colorMap: Record<string, string> = {
      'bg-emerald-500': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
      'bg-gray-500': 'bg-gray-500/10 text-gray-600 border-gray-500/20',
      'bg-amber-500': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
      'bg-blue-500': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      'bg-red-500': 'bg-red-500/10 text-red-600 border-red-500/20'
    };
    return colorMap[statusInfo.color] || 'bg-muted text-muted-foreground';
  };

  const getCategoryBadge = (category: string) => {
    const categoryInfo = STAFF_CATEGORIES[category as UTStaffCategory];
    if (!categoryInfo) return 'bg-muted text-muted-foreground';
    
    const colorMap: Record<string, string> = {
      'bg-blue-500': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      'bg-purple-500': 'bg-purple-500/10 text-purple-600 border-purple-500/20',
      'bg-amber-500': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
      'bg-emerald-500': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
    };
    return colorMap[categoryInfo.color] || 'bg-muted text-muted-foreground';
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-purple-500 bg-clip-text text-transparent">
            Staff Management
          </h1>
          <p className="text-muted-foreground mt-1">Manage all staff, contractors, and event personnel</p>
        </div>
        <Button className="bg-gradient-to-r from-pink-600 to-purple-500 hover:from-pink-700 hover:to-purple-600">
          <UserPlus className="h-4 w-4 mr-2" />
          Add Staff
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Object.entries(STAFF_CATEGORIES).map(([key, cat]) => (
          <Card key={key} className="border-border/50 cursor-pointer hover:border-pink-500/30 transition-colors" onClick={() => setActiveTab(key)}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{cat.displayName}</p>
                  <p className="text-2xl font-bold mt-1">{staffCounts[key as keyof typeof staffCounts] || 0}</p>
                </div>
                <div className={`p-2 rounded-lg ${cat.color}/10`}>
                  <Users className={`h-5 w-5 ${cat.color.replace('bg-', 'text-')}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        <Card className="border-border/50 cursor-pointer hover:border-pink-500/30 transition-colors" onClick={() => setActiveTab('all')}>
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
      </div>

      {/* Filters */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search staff by name or role..." 
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {STAFF_DEPARTMENTS.map(dept => (
                  <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(STAFF_STATUSES).map(([key, status]) => (
                  <SelectItem key={key} value={key}>{status.displayName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Staff Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="all">All Staff ({staffCounts.all})</TabsTrigger>
          <TabsTrigger value="internal_staff">Internal ({staffCounts.internal_staff})</TabsTrigger>
          <TabsTrigger value="event_staff">Event Staff ({staffCounts.event_staff})</TabsTrigger>
          <TabsTrigger value="vendor">Vendors ({staffCounts.vendor})</TabsTrigger>
          <TabsTrigger value="partner">Partners ({staffCounts.partner})</TabsTrigger>
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
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Name</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Role</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Category</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Contact</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Events</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Rating</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStaff.map((staff) => {
                      const roleInfo = STAFF_ROLES[staff.role];
                      const RoleIcon = roleInfo?.icon || Users;
                      
                      return (
                        <tr 
                          key={staff.id} 
                          className="border-b border-border/30 hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => navigate(`/os/unforgettable/staff/${staff.id}`)}
                        >
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center">
                                <span className="text-sm font-semibold text-pink-600">
                                  {staff.first_name[0]}{staff.last_name[0]}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium">{staff.first_name} {staff.last_name}</p>
                                <p className="text-xs text-muted-foreground">{staff.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <RoleIcon className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{getRoleShortName(staff.role)}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className={getCategoryBadge(staff.category)}>
                              {STAFF_CATEGORIES[staff.category as UTStaffCategory]?.displayName || staff.category}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <Button size="icon" variant="ghost" className="h-8 w-8">
                                <Phone className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8">
                                <Mail className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span>{staff.events_completed}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                              <span>{staff.rating.toFixed(1)}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className={getStatusBadge(staff.status)}>
                              {STAFF_STATUSES[staff.status as UTStaffStatus]?.displayName || staff.status}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/os/unforgettable/staff/${staff.id}`);
                              }}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Department Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {STAFF_DEPARTMENTS.map(dept => {
          const deptStaff = mockStaff.filter(s => s.department === dept.id);
          const DeptIcon = dept.icon;
          
          return (
            <Card key={dept.id} className="border-border/50 hover:border-pink-500/30 transition-colors cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg bg-muted/50 ${dept.color}`}>
                    <DeptIcon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">{dept.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{dept.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        {deptStaff.length} staff
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {dept.roles.length} roles
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
