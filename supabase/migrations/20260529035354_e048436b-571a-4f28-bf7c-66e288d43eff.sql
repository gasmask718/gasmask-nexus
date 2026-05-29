UPDATE public.audit_lock SET locked=false WHERE table_name='commission_ledger';
TRUNCATE public._merge_matrix_results;
INSERT INTO public._merge_matrix_results (test_name,expected,actual,pass)
SELECT test_name,expected,actual,pass FROM public._test_merge_bypass_matrix(
  '4045128e-2558-42f0-96c0-295dba956fd3'::uuid,
  '1b81e565-0c16-4184-a122-3351b0eed296'::uuid,
  '79fc4678-b030-46e8-bffc-c06900ca3231'::uuid,
  '43389f3c-d9a9-429a-a772-f3f9a84292da'::uuid);
-- Final cleanup happens in a follow-up after results are inspected.