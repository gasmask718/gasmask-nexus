import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, ChevronDown } from "lucide-react";

interface BrandSwitcherProps {
  currentBrandId: string;
}

export function BrandSwitcher({ currentBrandId }: BrandSwitcherProps) {
  const navigate = useNavigate();

  const { data: businesses = [] } = useQuery({
    queryKey: ["all-businesses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("id, name, primary_color, logo_url")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const handleSwitch = (brandId: string) => {
    if (brandId !== currentBrandId) {
      navigate(`/crm/brand/${brandId}`);
    }
  };

  const currentBrand = businesses.find((b) => b.id === currentBrandId);

  return (
    <Select value={currentBrandId} onValueChange={handleSwitch}>
      <SelectTrigger className="w-[220px] bg-white/10 border-white/20 text-white hover:bg-white/20">
        <div className="flex items-center gap-2">
          {currentBrand?.logo_url ? (
            <img
              src={currentBrand.logo_url}
              alt=""
              className="h-5 w-5 rounded object-cover"
            />
          ) : (
            <Building2 className="h-4 w-4" />
          )}
          <span className="truncate">{currentBrand?.name || "Select Brand"}</span>
        </div>
      </SelectTrigger>
      <SelectContent>
        {businesses.map((business) => (
          <SelectItem key={business.id} value={business.id}>
            <div className="flex items-center gap-2">
              {business.logo_url ? (
                <img
                  src={business.logo_url}
                  alt=""
                  className="h-5 w-5 rounded object-cover"
                />
              ) : (
                <div
                  className="h-5 w-5 rounded"
                  style={{ backgroundColor: business.primary_color || "#6366f1" }}
                />
              )}
              <span>{business.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
