import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface CustomerProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  marketing_opt_in: boolean | null;
  stripe_customer_id: string | null;
  status: string | null;
  preferred_language: string | null;
}

const LINK_GUARD_KEY = "dd_guest_orders_linked_v1";

/**
 * Shared account hook: loads (or creates) the caller's customer_profiles row
 * and — once per browser session — calls dd_link_guest_orders() so any guest
 * checkouts made with the same email get attached to the account.
 */
export function useCustomerAccount() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("customer_profiles" as any)
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      toast.error(`Failed to load account profile: ${error.message}`);
      setLoading(false);
      return;
    }

    if (!data) {
      const { data: created, error: createError } = await supabase
        .from("customer_profiles" as any)
        .insert({ user_id: user.id, email: user.email })
        .select("*")
        .single();
      if (createError) {
        toast.error(`Failed to create account profile: ${createError.message}`);
        setLoading(false);
        return;
      }
      setProfile(created as any as CustomerProfile);
    } else {
      setProfile(data as any as CustomerProfile);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!user) return;
    const guardKey = `${LINK_GUARD_KEY}_${user.id}`;
    if (sessionStorage.getItem(guardKey)) return;
    sessionStorage.setItem(guardKey, "1");
    supabase
      .rpc("dd_link_guest_orders" as any)
      .then(({ data, error }) => {
        if (error) {
          console.warn("dd_link_guest_orders failed:", error.message);
          return;
        }
        const count = Number(data) || 0;
        if (count > 0) {
          toast.success(`Linked ${count} previous order${count === 1 ? "" : "s"} to your account`);
        }
      });
  }, [user]);

  return { profile, loading, refetch: loadProfile, user };
}
