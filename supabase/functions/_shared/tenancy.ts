// ═══════════════════════════════════════════════════════════════════════════
// _shared/tenancy.ts — one tenancy gate for service-role edge functions
// ═══════════════════════════════════════════════════════════════════════════
//
// THE BUG CLASS THIS EXISTS TO KILL:
//
//   const supabase = createClient(url, SERVICE_ROLE_KEY);   // RLS is off
//   const { business_id } = await req.json();               // caller's word
//   await supabase.from('outbound_campaigns').select('*').eq('business_id', business_id);
//
// A service-role client bypasses RLS entirely, so any identifier read from the
// request body is an unvalidated authorization decision: any authenticated user
// can name any business and be served. The sweep in SEC-017 found this shape in
// 37 functions.
//
// USAGE:
//
//   const t = await tenancy(req);                    // throws 401 if no valid JWT
//   const businessId = await t.resolveBusinessId(body);
//   const row = await t.loadOwned('outbound_campaigns', body.campaign_id);
//   // attribute audit columns to t.userId — NEVER to body.approved_by
//
// Errors are thrown as HttpError and should be surfaced by the caller's catch.
// 403s name the business, because a 403 that says which business is debuggable.
//
// ═══════════════════════════════════════════════════════════════════════════

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

/** Platform-wide roles that may act on any business. */
const PLATFORM_ROLES = ['owner', 'admin'] as const;

export interface TenancyContext {
  /** `sub` from the verified JWT. The only trustworthy identity in the request. */
  userId: string;
  /** Businesses the caller belongs to, via business_members. */
  memberBusinessIds: string[];
  /** True when the caller holds a platform-wide owner/admin role in user_roles. */
  isPlatformAdmin: boolean;
  /** Service-role client. RLS does not apply — every filter must come from here. */
  admin: SupabaseClient;

  /**
   * Resolves the business a body-scoped action targets.
   *  - body.business_id present -> validated against membership (403 if not a member)
   *  - absent, exactly one membership -> derived
   *  - absent, several memberships -> 400 listing the businesses to choose from
   *  - absent, no membership -> 403
   *  - absent, platform admin -> 400 (an admin must say which business)
   */
  resolveBusinessId(body?: { business_id?: string | null } | null): Promise<string>;

  /** Confirms the caller may act on `businessId`, or throws 403 naming it. */
  assertBusinessAccess(businessId: string): Promise<void>;

  /** Loads a row by id and confirms the caller's business owns it. 404 then 403. */
  loadOwned<T = Record<string, unknown>>(
    table: string,
    id: string,
    opts?: LoadOwnedOptions,
  ): Promise<T>;

  /** Human label for a business id: `"Acme" (uuid)`, falling back to the id. */
  businessLabel(businessId: string): Promise<string>;
}

export interface LoadOwnedOptions {
  /** Column holding the owning business. Default `business_id`. */
  businessColumn?: string;
  /** Primary-key column. Default `id`. */
  idColumn?: string;
  /** Columns to select. Default `*`. */
  select?: string;
  /** Noun used in the 404 message. Default the table name. */
  label?: string;
}

/**
 * Verifies the bearer token and loads the caller's tenancy facts once.
 * Throws HttpError(401) when the request carries no valid user JWT.
 */
export async function tenancy(req: Request): Promise<TenancyContext> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Unauthorized');
  }

  const anon = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  );
  const { data: claimsData, error: claimsError } = await anon.auth.getClaims(
    authHeader.replace('Bearer ', ''),
  );
  const userId = claimsData?.claims?.sub as string | undefined;
  if (claimsError || !userId) {
    throw new HttpError(401, 'Unauthorized');
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const [{ data: memberships, error: membershipError }, { data: platformRoles }] = await Promise.all([
    admin.from('business_members').select('business_id').eq('user_id', userId),
    admin.from('user_roles').select('role').eq('user_id', userId).in('role', PLATFORM_ROLES as unknown as string[]),
  ]);
  if (membershipError) {
    throw new Error(`Membership lookup failed: ${membershipError.message}`);
  }

  const memberBusinessIds = [
    ...new Set((memberships ?? []).map((m: { business_id: string }) => m.business_id).filter(Boolean)),
  ];
  const isPlatformAdmin = (platformRoles ?? []).length > 0;

  const labelCache = new Map<string, string>();
  const businessLabel = async (id: string): Promise<string> => {
    const cached = labelCache.get(id);
    if (cached) return cached;
    const { data: biz } = await admin.from('businesses').select('name').eq('id', id).maybeSingle();
    const label = biz?.name ? `"${biz.name}" (${id})` : id;
    labelCache.set(id, label);
    return label;
  };

  const assertBusinessAccess = async (businessId: string): Promise<void> => {
    if (!businessId) throw new HttpError(400, 'business_id is required.');
    if (isPlatformAdmin) return;
    if (memberBusinessIds.includes(businessId)) return;
    throw new HttpError(
      403,
      `You are not a member of ${await businessLabel(businessId)} and cannot act on its records.`,
    );
  };

  const resolveBusinessId = async (
    body?: { business_id?: string | null } | null,
  ): Promise<string> => {
    const requested =
      typeof body?.business_id === 'string' && body.business_id.trim() !== ''
        ? body.business_id.trim()
        : null;

    if (requested) {
      await assertBusinessAccess(requested);
      return requested;
    }
    if (isPlatformAdmin) {
      throw new HttpError(400, 'business_id is required for platform administrators.');
    }
    if (memberBusinessIds.length === 0) {
      throw new HttpError(403, 'Your account has no business membership, so it cannot act on business records.');
    }
    if (memberBusinessIds.length > 1) {
      const names = await Promise.all(memberBusinessIds.map(businessLabel));
      throw new HttpError(
        400,
        `You belong to more than one business. Specify business_id — one of: ${names.join(', ')}.`,
      );
    }
    return memberBusinessIds[0];
  };

  const loadOwned = async <T = Record<string, unknown>>(
    table: string,
    id: string,
    opts: LoadOwnedOptions = {},
  ): Promise<T> => {
    const businessColumn = opts.businessColumn ?? 'business_id';
    const idColumn = opts.idColumn ?? 'id';
    const label = opts.label ?? table;
    if (!id) throw new HttpError(400, `Missing ${label} id.`);

    const { data: row, error } = await admin
      .from(table)
      .select(opts.select ?? '*')
      .eq(idColumn, id)
      .maybeSingle();
    if (error) throw new Error(`${label} lookup failed: ${error.message}`);
    if (!row) throw new HttpError(404, `${label} ${id} not found.`);

    const owner = (row as Record<string, unknown>)[businessColumn];
    if (typeof owner !== 'string' || !owner) {
      // A row with no owner cannot be proven to belong to the caller. Refuse
      // rather than fall open.
      throw new HttpError(403, `${label} ${id} has no ${businessColumn} and cannot be authorized.`);
    }
    await assertBusinessAccess(owner);
    return row as T;
  };

  return {
    userId,
    memberBusinessIds,
    isPlatformAdmin,
    admin,
    resolveBusinessId,
    assertBusinessAccess,
    loadOwned,
    businessLabel,
  };
}

/** Maps a thrown HttpError to a response; rethrow-safe for unexpected errors. */
export function tenancyErrorResponse(error: unknown, corsHeaders: Record<string, string>): Response | null {
  if (error instanceof HttpError) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: error.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  return null;
}
