DO $$
DECLARE
  v record;
  remaining int;
  progressed boolean;
  ok boolean;
BEGIN
  CREATE TABLE public._qty_viewbak(name text primary key, def text, grants text[], done boolean default false);

  WITH RECURSIVE deps AS (
    SELECT 'public.invoice_line_items'::text COLLATE "C" AS obj
    UNION
    SELECT (dn.nspname||'.'||dv.relname)::text COLLATE "C"
    FROM deps
    JOIN pg_class src ON src.oid = deps.obj::regclass
    JOIN pg_depend d ON d.refobjid = src.oid
    JOIN pg_rewrite r ON r.oid = d.objid
    JOIN pg_class dv ON dv.oid = r.ev_class AND dv.relkind = 'v'
    JOIN pg_namespace dn ON dn.oid = dv.relnamespace
    WHERE dn.nspname||'.'||dv.relname <> deps.obj
  )
  INSERT INTO public._qty_viewbak(name, def, grants)
  SELECT obj, pg_get_viewdef(obj::regclass, true),
         ARRAY(SELECT grantee||':'||privilege_type FROM information_schema.role_table_grants g
               WHERE g.table_schema = split_part(obj,'.',1) AND g.table_name = split_part(obj,'.',2))
  FROM deps WHERE obj <> 'public.invoice_line_items';

  FOR v IN SELECT name FROM public._qty_viewbak LOOP
    EXECUTE format('DROP VIEW IF EXISTS %s CASCADE', v.name);
  END LOOP;

  ALTER TABLE public.invoice_line_items ALTER COLUMN quantity TYPE numeric USING quantity::numeric;

  LOOP
    progressed := false;
    FOR v IN SELECT * FROM public._qty_viewbak WHERE NOT done LOOP
      ok := true;
      BEGIN
        EXECUTE format('CREATE VIEW %s AS %s', v.name, v.def);
      EXCEPTION WHEN others THEN ok := false;
      END;
      IF ok THEN
        UPDATE public._qty_viewbak SET done = true WHERE name = v.name;
        progressed := true;
      END IF;
    END LOOP;
    SELECT count(*) INTO remaining FROM public._qty_viewbak WHERE NOT done;
    EXIT WHEN remaining = 0;
    IF NOT progressed THEN
      RAISE EXCEPTION 'Could not recreate views: %', (SELECT string_agg(name, ', ') FROM public._qty_viewbak WHERE NOT done);
    END IF;
  END LOOP;

  FOR v IN SELECT name, unnest(grants) AS g FROM public._qty_viewbak LOOP
    EXECUTE format('GRANT %s ON %s TO %I', split_part(v.g,':',2), v.name, split_part(v.g,':',1));
  END LOOP;

  DROP TABLE public._qty_viewbak;
END $$;