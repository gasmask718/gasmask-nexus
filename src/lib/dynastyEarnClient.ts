/**
 * Dynasty Earn — cross-project Supabase client.
 *
 * Reads from the Dynasty Earn Supabase project (ciouiczwspwfgtecivfo),
 * NOT the Dynasty OS project. Used exclusively by the /os/dynasty-earn
 * admin surface to read earners, brands, programs, commissions, campaigns,
 * and payouts owned by that separate project.
 *
 * Configure via Lovable project secrets:
 *   VITE_DYNASTY_EARN_SUPABASE_URL
 *   VITE_DYNASTY_EARN_SUPABASE_KEY
 * Both from:
 *   supabase.com/dashboard/project/ciouiczwspwfgtecivfo/settings/api
 *
 * If either secret is missing, `earnDb` is null and the UI must render
 * the "Connect Dynasty Earn database" amber banner instead of querying.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const EARN_URL = import.meta.env.VITE_DYNASTY_EARN_SUPABASE_URL as string | undefined;
const EARN_KEY = import.meta.env.VITE_DYNASTY_EARN_SUPABASE_KEY as string | undefined;

export const earnDb: SupabaseClient | null =
  EARN_URL && EARN_KEY ? createClient(EARN_URL, EARN_KEY) : null;

export const isEarnConnected = (): boolean => !!earnDb;
