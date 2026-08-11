import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FundingClientRow } from '@/hooks/useFundingClient';

export interface StrategyRule {
  id: string;
  step_order: number;
  step_key: string;
  step_label: string;
  funding_lane: string | null;
  rationale: string;
  prerequisite_step_keys: string[];
  min_credit_score: number | null;
  min_time_in_business_months: number | null;
  min_monthly_revenue: number | null;
  inquiry_sensitivity: string;
  requires_personal_guarantee: boolean;
  requires_business_entity: boolean;
  requires_tradelines: number;
}

export type StepStatus = 'READY' | 'BLOCKED' | 'NOT_QUALIFIED' | 'UNKNOWN';

export interface StrategyStep extends StrategyRule {
  status: StepStatus;
  /** Why this step sits at this position, plus every gate that was evaluated. */
  explanations: string[];
}

/** Sequencing rules live in the database, never in a component. */
export function useFundingStrategyRules() {
  return useQuery({
    queryKey: ['funding-strategy-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funding_strategy_rules')
        .select('*')
        .eq('is_active', true)
        .order('step_order');
      if (error) throw error;
      return (data ?? []) as unknown as StrategyRule[];
    },
  });
}

interface StrategyInputs {
  client?: FundingClientRow | null;
  /** step_key values that are complete for this client. */
  completedSteps?: string[];
  tradelineCount?: number;
}

/**
 * Turns the configured rules plus the client's real profile into an ordered
 * funding plan. Every step carries the reason it sits where it does and the
 * outcome of each gate — no lender is presented as available on a step whose
 * mandatory gate fails.
 */
export function buildFundingPlan(
  rules: StrategyRule[],
  { client, completedSteps = [], tradelineCount = 0 }: StrategyInputs,
): StrategyStep[] {
  return rules.map((rule) => {
    const explanations: string[] = [`Position ${rule.step_order}: ${rule.rationale}`];
    let blocked = false;
    let failed = false;
    let unknown = false;

    const missingPrereqs = rule.prerequisite_step_keys.filter((k) => !completedSteps.includes(k));
    if (rule.prerequisite_step_keys.length > 0) {
      if (missingPrereqs.length > 0) {
        blocked = true;
        explanations.push(`Prerequisites incomplete: ${missingPrereqs.join(', ')}`);
      } else {
        explanations.push(`Prerequisites complete: ${rule.prerequisite_step_keys.join(', ')}`);
      }
    }

    const gate = (
      label: string,
      required: number | null,
      actual: number | null | undefined,
      unit = '',
    ) => {
      if (required == null) return;
      if (actual == null) {
        unknown = true;
        explanations.push(`${label}: requires ${unit}${required} — client value not on file`);
        return;
      }
      if (Number(actual) < required) {
        failed = true;
        explanations.push(`${label}: ${unit}${actual} is below required ${unit}${required} — FAIL`);
        return;
      }
      explanations.push(`${label}: ${unit}${actual} meets required ${unit}${required} — PASS`);
    };

    gate('Credit score', rule.min_credit_score, client?.credit_score_estimate);
    gate('Time in business (months)', rule.min_time_in_business_months, client?.time_in_business_months);
    gate('Monthly revenue', rule.min_monthly_revenue, client?.monthly_revenue, '$');

    if (rule.requires_business_entity) {
      if (client?.business_name && client?.ein) {
        explanations.push(`Business entity: ${client.business_name} with EIN on file — PASS`);
      } else {
        blocked = true;
        explanations.push('Business entity: registered entity with EIN required — missing');
      }
    }

    if (rule.requires_tradelines > 0) {
      if (tradelineCount >= rule.requires_tradelines) {
        explanations.push(`Tradelines: ${tradelineCount} of ${rule.requires_tradelines} required — PASS`);
      } else {
        blocked = true;
        explanations.push(`Tradelines: ${tradelineCount} of ${rule.requires_tradelines} required — incomplete`);
      }
    }

    if (rule.requires_personal_guarantee) {
      explanations.push('Personal guarantee required by lenders in this lane.');
    }
    explanations.push(`Inquiry sensitivity: ${rule.inquiry_sensitivity}`);

    let status: StepStatus = 'READY';
    if (failed) status = 'NOT_QUALIFIED';
    else if (blocked) status = 'BLOCKED';
    else if (unknown) status = 'UNKNOWN';

    return { ...rule, status, explanations };
  });
}

/** Convenience: rules + plan for one client in a single hook. */
export function useFundingPlan(inputs: StrategyInputs) {
  const rulesQuery = useFundingStrategyRules();
  return {
    ...rulesQuery,
    plan: rulesQuery.data ? buildFundingPlan(rulesQuery.data, inputs) : [],
  };
}
