import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, MessageSquare, User, Building2, Users, Truck, Bike } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface Contact {
  id: string;
  name: string;
  phone: string;
  type: string;
  source: string;
}

interface ContactsPanelProps {
  onSelectContact: (contact: Contact) => void;
  selectedContactId?: string;
}

export function ContactsPanel({ onSelectContact, selectedContactId }: ContactsPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  // Fetch contacts from multiple sources
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["all-contacts-for-messaging", activeTab],
    queryFn: async () => {
      const allContacts: Contact[] = [];

      // Fetch from people table
      const { data: people } = await supabase
        .from("people")
        .select("id, name, phone, type")
        .not("phone", "is", null)
        .not("phone", "eq", "");
      
      if (people) {
        allContacts.push(...people.map(p => ({
          id: p.id,
          name: p.name,
          phone: p.phone!,
          type: p.type,
          source: "people"
        })));
      }

      // Fetch from store_contacts
      const { data: storeContacts } = await supabase
        .from("store_contacts")
        .select("id, name, phone, role")
        .not("phone", "is", null)
        .not("phone", "eq", "");
      
      if (storeContacts) {
        allContacts.push(...storeContacts.map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone!,
          type: c.role || "store_contact",
          source: "store_contacts"
        })));
      }

      // Fetch from store_master (primary contacts)
      const { data: stores } = await supabase
        .from("store_master")
        .select("id, store_name, phone, owner_name")
        .not("phone", "is", null)
        .not("phone", "eq", "");
      
      if (stores) {
        allContacts.push(...stores.map(s => ({
          id: s.id,
          name: s.owner_name || s.store_name,
          phone: s.phone!,
          type: "store",
          source: "store_master"
        })));
      }

      // Fetch from ambassadors
      const { data: ambassadors } = await supabase
        .from("ambassadors")
        .select("id, name, phone_primary")
        .not("phone_primary", "is", null)
        .not("phone_primary", "eq", "");
      
      if (ambassadors) {
        allContacts.push(...ambassadors.map(a => ({
          id: a.id,
          name: a.name || "Ambassador",
          phone: a.phone_primary!,
          type: "ambassador",
          source: "ambassadors"
        })));
      }

      // Fetch from wholesalers
      const { data: wholesalers } = await supabase
        .from("wholesalers")
        .select("id, name, phone")
        .not("phone", "is", null)
        .not("phone", "eq", "");
      
      if (wholesalers) {
        allContacts.push(...wholesalers.map(w => ({
          id: w.id,
          name: w.name || "Wholesaler",
          phone: w.phone!,
          type: "wholesaler",
          source: "wholesalers"
        })));
      }

      // Fetch from crm_production
      const { data: production } = await supabase
        .from("crm_production")
        .select("id, name, phone")
        .not("phone", "is", null)
        .not("phone", "eq", "");
      
      if (production) {
        allContacts.push(...production.map(p => ({
          id: p.id,
          name: p.name,
          phone: p.phone!,
          type: "production",
          source: "crm_production"
        })));
      }

      // Fetch from grabba_drivers
      const { data: grabbaDrivers } = await supabase
        .from("grabba_drivers")
        .select("id, name, phone")
        .not("phone", "is", null)
        .not("phone", "eq", "");
      
      if (grabbaDrivers) {
        allContacts.push(...grabbaDrivers.map(d => ({
          id: d.id,
          name: d.name,
          phone: d.phone!,
          type: "driver",
          source: "grabba_drivers"
        })));
      }

      // Fetch from drivers table
      const { data: drivers } = await supabase
        .from("drivers")
        .select("id, full_name, phone")
        .not("phone", "is", null)
        .not("phone", "eq", "");
      
      if (drivers) {
        allContacts.push(...drivers.map(d => ({
          id: d.id,
          name: d.full_name,
          phone: d.phone!,
          type: "driver",
          source: "drivers"
        })));
      }

      // Fetch from bikers table
      const { data: bikers } = await supabase
        .from("bikers")
        .select("id, full_name, phone")
        .not("phone", "is", null)
        .not("phone", "eq", "");
      
      if (bikers) {
        allContacts.push(...bikers.map(d => ({
          id: d.id,
          name: d.full_name,
          phone: d.phone!,
          type: "biker",
          source: "bikers"
        })));
      }

      // Remove duplicates by phone number
      const uniqueContacts = allContacts.reduce((acc, contact) => {
        const normalizedPhone = contact.phone.replace(/\D/g, "");
        if (!acc.some(c => c.phone.replace(/\D/g, "") === normalizedPhone)) {
          acc.push(contact);
        }
        return acc;
      }, [] as Contact[]);

      return uniqueContacts.sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "store":
      case "store_contact":
        return <Building2 className="h-4 w-4" />;
      case "ambassador":
        return <Users className="h-4 w-4" />;
      case "driver":
        return <Truck className="h-4 w-4" />;
      case "biker":
        return <Bike className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "store":
      case "store_contact":
        return "bg-blue-100 text-blue-800";
      case "ambassador":
        return "bg-purple-100 text-purple-800";
      case "driver":
      case "biker":
        return "bg-green-100 text-green-800";
      case "wholesaler":
        return "bg-orange-100 text-orange-800";
      case "production":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const filteredContacts = contacts.filter(c => {
    const matchesSearch = !searchTerm || 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm);
    
    const matchesTab = activeTab === "all" || c.type === activeTab || c.source === activeTab ||
      (activeTab === "driver" && (c.type === "driver" || c.type === "biker"));
    
    return matchesSearch && matchesTab;
  });

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          Contacts
        </CardTitle>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="store">Stores</TabsTrigger>
            <TabsTrigger value="ambassador">Amb.</TabsTrigger>
            <TabsTrigger value="driver">Drivers</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="p-6 text-center text-muted-foreground">
              Loading contacts...
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              No contacts found
            </div>
          ) : (
            <div className="divide-y">
              {filteredContacts.map((contact) => (
                <div
                  key={`${contact.source}-${contact.id}`}
                  className={cn(
                    "p-3 hover:bg-muted/50 transition-colors cursor-pointer",
                    selectedContactId === contact.id && "bg-muted"
                  )}
                  onClick={() => onSelectContact(contact)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        {getTypeIcon(contact.type)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{contact.name}</p>
                        <p className="text-xs text-muted-foreground">{contact.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={`text-xs ${getTypeBadgeColor(contact.type)}`}>
                        {contact.type}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectContact(contact);
                        }}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
