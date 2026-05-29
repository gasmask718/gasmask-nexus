CREATE OR REPLACE FUNCTION public._test_merge_bypass_matrix(p_old_store uuid, p_new_store uuid, p_invoice_id uuid, p_ts_id uuid)
RETURNS TABLE(test_name text, expected text, actual text, pass boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_cl_id uuid := '11111111-1111-1111-1111-111111111111';
  v_bs_id uuid := '22222222-2222-2222-2222-222222222222';
  v_amb  uuid := 'b2ccf2a1-3284-4d17-9376-65147cd29140';
  v_line uuid := '4cc114c1-c244-4497-b428-39de21326b67';
  v_prod uuid := '2d28e463-5296-4d42-b548-896d18ee906e';
  v_actual text; v_pass boolean; v_sentinel text := '__ROLLBACK_OK__';
BEGIN
  BEGIN PERFORM set_config('app.merge_in_progress','true',true); UPDATE tube_sale_ledger SET store_id=p_new_store WHERE id=p_ts_id; RAISE EXCEPTION '%',v_sentinel;
  EXCEPTION WHEN OTHERS THEN IF SQLERRM=v_sentinel THEN v_actual:='success';v_pass:=true; ELSE v_actual:='error: '||SQLERRM;v_pass:=false; END IF; END;
  test_name:='ts.a flag,store_id-only UPDATE'; expected:='success'; actual:=v_actual; pass:=v_pass; RETURN NEXT;

  BEGIN PERFORM set_config('app.merge_in_progress','false',true); UPDATE tube_sale_ledger SET store_id=p_new_store WHERE id=p_ts_id; RAISE EXCEPTION '%',v_sentinel;
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '%merge_in_progress flag required%' THEN v_actual:='blocked: '||SQLERRM;v_pass:=true; ELSIF SQLERRM=v_sentinel THEN v_actual:='UNEXPECTED success';v_pass:=false; ELSE v_actual:='wrong: '||SQLERRM;v_pass:=false; END IF; END;
  test_name:='ts.b noflag,store_id UPDATE'; expected:='BLOCK merge_in_progress flag required'; actual:=v_actual; pass:=v_pass; RETURN NEXT;

  BEGIN PERFORM set_config('app.merge_in_progress','true',true); UPDATE tube_sale_ledger SET store_id=p_new_store, source='changed' WHERE id=p_ts_id; RAISE EXCEPTION '%',v_sentinel;
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '%store_id changes only%' THEN v_actual:='blocked: '||SQLERRM;v_pass:=true; ELSIF SQLERRM=v_sentinel THEN v_actual:='UNEXPECTED success';v_pass:=false; ELSE v_actual:='wrong: '||SQLERRM;v_pass:=false; END IF; END;
  test_name:='ts.c flag,store_id+other UPDATE'; expected:='BLOCK store_id changes only'; actual:=v_actual; pass:=v_pass; RETURN NEXT;

  BEGIN PERFORM set_config('app.merge_in_progress','true',true); DELETE FROM tube_sale_ledger WHERE id=p_ts_id; RAISE EXCEPTION '%',v_sentinel;
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '%DELETE operations are not allowed%' THEN v_actual:='blocked: '||SQLERRM;v_pass:=true; ELSIF SQLERRM=v_sentinel THEN v_actual:='UNEXPECTED success';v_pass:=false; ELSE v_actual:='wrong: '||SQLERRM;v_pass:=false; END IF; END;
  test_name:='ts.d flag,DELETE'; expected:='BLOCK DELETE not allowed'; actual:=v_actual; pass:=v_pass; RETURN NEXT;

  BEGIN PERFORM set_config('app.merge_in_progress','false',true); UPDATE tube_sale_ledger SET source='changed' WHERE id=p_ts_id; RAISE EXCEPTION '%',v_sentinel;
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '%tube_sale_ledger is immutable%' THEN v_actual:='blocked: '||SQLERRM;v_pass:=true; ELSIF SQLERRM=v_sentinel THEN v_actual:='UNEXPECTED success';v_pass:=false; ELSE v_actual:='wrong: '||SQLERRM;v_pass:=false; END IF; END;
  test_name:='ts.e noflag,normal UPDATE'; expected:='BLOCK tube_sale_ledger immutable'; actual:=v_actual; pass:=v_pass; RETURN NEXT;

  -- bag_sale_ledger (real FKs)
  BEGIN INSERT INTO bag_sale_ledger (id,invoice_id,line_item_id,store_id,product_id,bags_delta,source) VALUES (v_bs_id,p_invoice_id,v_line,p_old_store,v_prod,1,'test');
    PERFORM set_config('app.merge_in_progress','true',true); UPDATE bag_sale_ledger SET store_id=p_new_store WHERE id=v_bs_id; RAISE EXCEPTION '%',v_sentinel;
  EXCEPTION WHEN OTHERS THEN IF SQLERRM=v_sentinel THEN v_actual:='success';v_pass:=true; ELSE v_actual:='error: '||SQLERRM;v_pass:=false; END IF; END;
  test_name:='bs.a flag,store_id-only UPDATE'; expected:='success'; actual:=v_actual; pass:=v_pass; RETURN NEXT;

  BEGIN INSERT INTO bag_sale_ledger (id,invoice_id,line_item_id,store_id,product_id,bags_delta,source) VALUES (v_bs_id,p_invoice_id,v_line,p_old_store,v_prod,1,'test');
    PERFORM set_config('app.merge_in_progress','false',true); UPDATE bag_sale_ledger SET store_id=p_new_store WHERE id=v_bs_id; RAISE EXCEPTION '%',v_sentinel;
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '%merge_in_progress flag required%' THEN v_actual:='blocked: '||SQLERRM;v_pass:=true; ELSIF SQLERRM=v_sentinel THEN v_actual:='UNEXPECTED success';v_pass:=false; ELSE v_actual:='wrong: '||SQLERRM;v_pass:=false; END IF; END;
  test_name:='bs.b noflag,store_id UPDATE'; expected:='BLOCK merge_in_progress flag required'; actual:=v_actual; pass:=v_pass; RETURN NEXT;

  BEGIN INSERT INTO bag_sale_ledger (id,invoice_id,line_item_id,store_id,product_id,bags_delta,source) VALUES (v_bs_id,p_invoice_id,v_line,p_old_store,v_prod,1,'test');
    PERFORM set_config('app.merge_in_progress','true',true); UPDATE bag_sale_ledger SET store_id=p_new_store, bags_delta=99 WHERE id=v_bs_id; RAISE EXCEPTION '%',v_sentinel;
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '%store_id changes only%' THEN v_actual:='blocked: '||SQLERRM;v_pass:=true; ELSIF SQLERRM=v_sentinel THEN v_actual:='UNEXPECTED success';v_pass:=false; ELSE v_actual:='wrong: '||SQLERRM;v_pass:=false; END IF; END;
  test_name:='bs.c flag,store_id+other UPDATE'; expected:='BLOCK store_id changes only'; actual:=v_actual; pass:=v_pass; RETURN NEXT;

  BEGIN INSERT INTO bag_sale_ledger (id,invoice_id,line_item_id,store_id,product_id,bags_delta,source) VALUES (v_bs_id,p_invoice_id,v_line,p_old_store,v_prod,1,'test');
    PERFORM set_config('app.merge_in_progress','true',true); DELETE FROM bag_sale_ledger WHERE id=v_bs_id; RAISE EXCEPTION '%',v_sentinel;
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '%DELETE is not allowed%' THEN v_actual:='blocked: '||SQLERRM;v_pass:=true; ELSIF SQLERRM=v_sentinel THEN v_actual:='UNEXPECTED success';v_pass:=false; ELSE v_actual:='wrong: '||SQLERRM;v_pass:=false; END IF; END;
  test_name:='bs.d flag,DELETE'; expected:='BLOCK DELETE not allowed'; actual:=v_actual; pass:=v_pass; RETURN NEXT;

  BEGIN INSERT INTO bag_sale_ledger (id,invoice_id,line_item_id,store_id,product_id,bags_delta,source) VALUES (v_bs_id,p_invoice_id,v_line,p_old_store,v_prod,1,'test');
    PERFORM set_config('app.merge_in_progress','false',true); UPDATE bag_sale_ledger SET bags_delta=99 WHERE id=v_bs_id; RAISE EXCEPTION '%',v_sentinel;
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '%bag_sale_ledger is immutable%' THEN v_actual:='blocked: '||SQLERRM;v_pass:=true; ELSIF SQLERRM=v_sentinel THEN v_actual:='UNEXPECTED success';v_pass:=false; ELSE v_actual:='wrong: '||SQLERRM;v_pass:=false; END IF; END;
  test_name:='bs.e noflag,normal UPDATE'; expected:='BLOCK bag_sale_ledger immutable'; actual:=v_actual; pass:=v_pass; RETURN NEXT;

  -- commission_ledger (real ambassador FK)
  BEGIN INSERT INTO commission_ledger (id,ambassador_id,store_id,source_channel,source_id,gross_amount,commission_rate,commission_amount) VALUES (v_cl_id,v_amb,p_old_store,'store_order',gen_random_uuid(),100,10,10);
    PERFORM set_config('app.merge_in_progress','true',true); UPDATE commission_ledger SET store_id=p_new_store WHERE id=v_cl_id; RAISE EXCEPTION '%',v_sentinel;
  EXCEPTION WHEN OTHERS THEN IF SQLERRM=v_sentinel THEN v_actual:='success';v_pass:=true; ELSE v_actual:='error: '||SQLERRM;v_pass:=false; END IF; END;
  test_name:='cl.a flag,store_id-only UPDATE'; expected:='success'; actual:=v_actual; pass:=v_pass; RETURN NEXT;

  BEGIN INSERT INTO commission_ledger (id,ambassador_id,store_id,source_channel,source_id,gross_amount,commission_rate,commission_amount) VALUES (v_cl_id,v_amb,p_old_store,'store_order',gen_random_uuid(),100,10,10);
    PERFORM set_config('app.merge_in_progress','false',true); UPDATE commission_ledger SET store_id=p_new_store WHERE id=v_cl_id; RAISE EXCEPTION '%',v_sentinel;
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '%merge_in_progress flag required%' THEN v_actual:='blocked: '||SQLERRM;v_pass:=true; ELSIF SQLERRM=v_sentinel THEN v_actual:='UNEXPECTED success';v_pass:=false; ELSE v_actual:='wrong: '||SQLERRM;v_pass:=false; END IF; END;
  test_name:='cl.b noflag,store_id UPDATE'; expected:='BLOCK merge_in_progress flag required'; actual:=v_actual; pass:=v_pass; RETURN NEXT;

  BEGIN INSERT INTO commission_ledger (id,ambassador_id,store_id,source_channel,source_id,gross_amount,commission_rate,commission_amount) VALUES (v_cl_id,v_amb,p_old_store,'store_order',gen_random_uuid(),100,10,10);
    PERFORM set_config('app.merge_in_progress','true',true); UPDATE commission_ledger SET store_id=p_new_store, commission_amount=99 WHERE id=v_cl_id; RAISE EXCEPTION '%',v_sentinel;
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '%store_id changes only%' THEN v_actual:='blocked: '||SQLERRM;v_pass:=true; ELSIF SQLERRM=v_sentinel THEN v_actual:='UNEXPECTED success';v_pass:=false; ELSE v_actual:='wrong: '||SQLERRM;v_pass:=false; END IF; END;
  test_name:='cl.c flag,store_id+other UPDATE'; expected:='BLOCK store_id changes only'; actual:=v_actual; pass:=v_pass; RETURN NEXT;

  BEGIN INSERT INTO commission_ledger (id,ambassador_id,store_id,source_channel,source_id,gross_amount,commission_rate,commission_amount) VALUES (v_cl_id,v_amb,p_old_store,'store_order',gen_random_uuid(),100,10,10);
    PERFORM set_config('app.merge_in_progress','true',true); DELETE FROM commission_ledger WHERE id=v_cl_id; RAISE EXCEPTION '%',v_sentinel;
  EXCEPTION WHEN OTHERS THEN IF SQLERRM=v_sentinel THEN v_actual:='UNEXPECTED success';v_pass:=false; ELSE v_actual:='blocked: '||SQLERRM;v_pass:=true; END IF; END;
  test_name:='cl.d flag,DELETE'; expected:='BLOCK (any block)'; actual:=v_actual; pass:=v_pass; RETURN NEXT;

  BEGIN INSERT INTO commission_ledger (id,ambassador_id,store_id,source_channel,source_id,gross_amount,commission_rate,commission_amount) VALUES (v_cl_id,v_amb,p_old_store,'store_order',gen_random_uuid(),100,10,10);
    PERFORM set_config('app.merge_in_progress','false',true); UPDATE commission_ledger SET commission_amount=99 WHERE id=v_cl_id; RAISE EXCEPTION '%',v_sentinel;
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '%Ledger rows are immutable%' THEN v_actual:='blocked: '||SQLERRM;v_pass:=true; ELSIF SQLERRM=v_sentinel THEN v_actual:='UNEXPECTED success';v_pass:=false; ELSE v_actual:='wrong: '||SQLERRM;v_pass:=false; END IF; END;
  test_name:='cl.e noflag,normal UPDATE'; expected:='BLOCK Ledger rows are immutable'; actual:=v_actual; pass:=v_pass; RETURN NEXT;

  BEGIN INSERT INTO commission_ledger (id,ambassador_id,store_id,source_channel,source_id,gross_amount,commission_rate,commission_amount) VALUES (v_cl_id,v_amb,p_old_store,'store_order',gen_random_uuid(),100,10,10);
    INSERT INTO audit_lock (table_name,locked,locked_at) VALUES ('commission_ledger',true,now()) ON CONFLICT (table_name) DO UPDATE SET locked=true,locked_at=now();
    PERFORM set_config('app.merge_in_progress','true',true); UPDATE commission_ledger SET store_id=p_new_store WHERE id=v_cl_id; RAISE EXCEPTION '%',v_sentinel;
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '%AUDIT_LOCK%' THEN v_actual:='blocked: '||SQLERRM;v_pass:=true; ELSIF SQLERRM=v_sentinel THEN v_actual:='UNEXPECTED success — audit_lock did NOT block!';v_pass:=false; ELSE v_actual:='wrong: '||SQLERRM;v_pass:=false; END IF; END;
  test_name:='cl.f audit_lock SET + flag SET + store_id-only'; expected:='BLOCK AUDIT_LOCK'; actual:=v_actual; pass:=v_pass; RETURN NEXT;

  RETURN;
END;
$fn$;

TRUNCATE public._merge_matrix_results;
INSERT INTO public._merge_matrix_results (test_name,expected,actual,pass)
SELECT test_name,expected,actual,pass FROM public._test_merge_bypass_matrix(
  '4045128e-2558-42f0-96c0-295dba956fd3'::uuid,
  '1b81e565-0c16-4184-a122-3351b0eed296'::uuid,
  '79fc4678-b030-46e8-bffc-c06900ca3231'::uuid,
  '43389f3c-d9a9-429a-a772-f3f9a84292da'::uuid);