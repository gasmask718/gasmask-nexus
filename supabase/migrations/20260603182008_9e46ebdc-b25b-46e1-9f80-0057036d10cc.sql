WITH best_agent AS (
  SELECT DISTINCT ON (business)
    business,
    agent_id,
    name
  FROM public.dc_agents
  WHERE is_active = true
  ORDER BY business,
           CASE WHEN agent_type = 'inbound' THEN 0 ELSE 1 END,
           created_at ASC
)
UPDATE public.dc_phone_numbers p
SET assigned_agent_id = b.agent_id,
    assigned_agent_name = b.name
FROM best_agent b
WHERE p.business = b.business
  AND p.assigned_agent_id IS NULL;