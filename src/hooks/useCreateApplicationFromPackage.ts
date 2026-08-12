import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ApplicationPackage } from '@/lib/funding/applicationPackage';

export interface CreateApplicationInput {
  clientId: string;
  pkg: ApplicationPackage;
  requestedAmount: number | null;
}

/**
 * Creates the real funding_applications record for a READY package and links it
 * back to the lender it came from. A package that is not genuinely READY can
 * never produce an application — the guard lives here as well as in the UI so
 * the rule cannot be bypassed by re-enabling a button.
 *
 * Duplicate protection is enforced by the database
 * (funding_applications_one_open_per_lender): a second open application for the
 * same client/lender pair fails instead of silently creating a duplicate.
 */
export function useCreateApplicationFromPackage() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ clientId, pkg, requestedAmount }: CreateApplicationInput) => {
      if (pkg.status !== 'READY') {
        throw new Error(
          `Package is ${pkg.status.replace('_', ' ')} — an application can only be created from a READY package.`,
        );
      }
      if (pkg.submission_method === 'UNKNOWN') {
        throw new Error('Lender submission method is unknown — resolve it before creating an application.');
      }

      const { data: match } = await supabase
        .from('funding_client_lender_matches')
        .select('id')
        .eq('client_id', clientId)
        .eq('lender_id', pkg.lender_id)
        .maybeSingle();

      const { data, error } = await supabase
        .from('funding_applications')
        .insert({
          client_id: clientId,
          lender_id: pkg.lender_id,
          lender_name: pkg.lender_name,
          product_type: pkg.product_name ?? 'Unspecified',
          requested_amount: requestedAmount ?? 0,
          status: 'Preparing',
          submission_method: pkg.submission_method.toLowerCase(),
          package_status: pkg.status,
          created_from_match_id: match?.id ?? null,
        })
        .select('id, lender_name, submission_method')
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error(
            `An open application already exists for ${pkg.lender_name}. Close or withdraw it before creating another.`,
          );
        }
        throw error;
      }
      return data;
    },
    onSuccess: (app, vars) => {
      qc.invalidateQueries({ queryKey: ['capital-plan', vars.clientId] });
      qc.invalidateQueries({ queryKey: ['funding-applications'] });
      qc.invalidateQueries({ queryKey: ['capital-client-context', vars.clientId] });
      toast.success(`Application created for ${app.lender_name} (${app.submission_method}).`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
