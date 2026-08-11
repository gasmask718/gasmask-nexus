import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  buildApplicationPackage,
  type ApplicationPackage,
  type PackageClient,
  type PackageProfile,
} from '@/lib/funding/applicationPackage';

/**
 * Assembles one application package per persisted lender match for a client.
 * Reads only what is on file — the encrypted SSN column is never selected.
 */
export function useApplicationPackages(clientId?: string, client?: PackageClient | null) {
  return useQuery({
    queryKey: ['application-packages', clientId, client?.consent_signed],
    enabled: !!clientId && !!client,
    queryFn: async (): Promise<ApplicationPackage[]> => {
      const [profileRes, docsRes, matchesRes] = await Promise.all([
        supabase
          .from('funding_application_profile')
          .select('*')
          .eq('client_id', clientId!)
          .maybeSingle(),
        supabase
          .from('funding_client_documents')
          .select('document_type, file_name')
          .eq('client_id', clientId!),
        supabase
          .from('funding_client_lender_matches')
          .select(
            `lender_id, match_score, match_reasons, status,
             lender:funding_lender_database (
               lender_name, product_name, submission_method, automation_allowed,
               docs_required, requires_tax_returns, accepts_bank_statements,
               min_credit_score, min_revenue, min_time_in_business_months
             )`,
          )
          .eq('client_id', clientId!)
          .order('match_score', { ascending: false }),
      ]);

      if (profileRes.error) throw profileRes.error;
      if (docsRes.error) throw docsRes.error;
      if (matchesRes.error) throw matchesRes.error;

      const profile = (profileRes.data ?? null) as unknown as PackageProfile | null;
      const documents = (docsRes.data ?? []) as Array<{
        document_type: string | null;
        file_name: string | null;
      }>;

      type MatchRow = {
        lender_id: string;
        match_reasons: string[] | null;
        lender: {
          lender_name: string | null;
          product_name: string | null;
          submission_method: string | null;
          automation_allowed: boolean | null;
          docs_required: string[] | null;
          requires_tax_returns: boolean | null;
          accepts_bank_statements: boolean | null;
          min_credit_score: number | null;
          min_revenue: number | null;
          min_time_in_business_months: number | null;
        } | null;
      };

      const matches = (matchesRes.data ?? []) as unknown as MatchRow[];

      return matches.map((m) => {
        const reasons = m.match_reasons ?? [];
        const verdictLine = reasons.find((r) => r.startsWith('Verdict: '));
        return buildApplicationPackage({
          client: client!,
          profile,
          documents,
          lender: {
            lender_id: m.lender_id,
            lender_name: m.lender?.lender_name ?? 'Unnamed lender',
            product_name: m.lender?.product_name ?? null,
            submission_method: m.lender?.submission_method ?? null,
            automation_allowed: m.lender?.automation_allowed ?? null,
            docs_required: m.lender?.docs_required ?? null,
            requires_tax_returns: m.lender?.requires_tax_returns ?? null,
            accepts_bank_statements: m.lender?.accepts_bank_statements ?? null,
            min_credit_score: m.lender?.min_credit_score ?? null,
            min_revenue: m.lender?.min_revenue ?? null,
            min_time_in_business_months: m.lender?.min_time_in_business_months ?? null,
            match_verdict: verdictLine ? verdictLine.replace('Verdict: ', '') : null,
            match_reasons: reasons.filter((r) => !r.startsWith('Verdict: ')),
          },
        });
      });
    },
  });
}
