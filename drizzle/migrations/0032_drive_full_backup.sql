CREATE TABLE public.drive_backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','done','failed')),
  trigger text NOT NULL DEFAULT 'nightly',
  drive_folder_id text,
  drive_folder_url text,
  tables_total int DEFAULT 0,
  tables_done int DEFAULT 0,
  rows_total bigint DEFAULT 0,
  error text
);
GRANT SELECT ON public.drive_backup_runs TO authenticated;
GRANT ALL ON public.drive_backup_runs TO service_role;
ALTER TABLE public.drive_backup_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read backup runs" ON public.drive_backup_runs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.drive_backup_items (
  run_id uuid NOT NULL REFERENCES public.drive_backup_runs(id),
  table_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','failed')),
  row_count bigint NOT NULL DEFAULT 0,
  parts int NOT NULL DEFAULT 0,
  bytes bigint NOT NULL DEFAULT 0,
  last_ctid text,
  file_ids text[] NOT NULL DEFAULT '{}',
  error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, table_name)
);
GRANT SELECT ON public.drive_backup_items TO authenticated;
GRANT ALL ON public.drive_backup_items TO service_role;
ALTER TABLE public.drive_backup_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read backup items" ON public.drive_backup_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Page of rows from one public base table, keyset by ctid (TID range scan). Service role only.
CREATE OR REPLACE FUNCTION public.backup_table_page(p_table text, p_after text, p_limit int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public SET statement_timeout = '120s' AS $$
DECLARE r jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name=p_table) THEN
    RAISE EXCEPTION 'not a public table: %', p_table;
  END IF;
  EXECUTE format($q$SELECT jsonb_build_object('rows', coalesce(jsonb_agg(x.j ORDER BY x.c),'[]'::jsonb), 'last', max(x.c)::text)
    FROM (SELECT ctid c, to_jsonb(t) j FROM public.%I t WHERE ctid > $1::tid ORDER BY ctid LIMIT $2) x$q$, p_table)
    INTO r USING coalesce(p_after,'(0,0)'), least(greatest(p_limit,1),5000);
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.backup_table_page(text,text,int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backup_table_page(text,text,int) TO service_role;

-- Schema snapshot as SQL text. Service role only.
CREATE OR REPLACE FUNCTION public.backup_schema_sql()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public SET statement_timeout = '120s' AS $$
DECLARE out text := '-- public schema snapshot ' || now() || E'\n';
BEGIN
  SELECT out || coalesce(string_agg(format('CREATE TYPE public.%I AS ENUM (%s);', t.typname,
    (SELECT string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid=t.oid)), E'\n'),'') || E'\n'
  INTO out FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typtype='e';

  SELECT out || coalesce(string_agg(format(E'CREATE TABLE public.%I (\n%s\n);', c.relname,
    (SELECT string_agg(format('  %I %s%s%s', a.attname, format_type(a.atttypid,a.atttypmod),
        CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END,
        coalesce(' DEFAULT '||pg_get_expr(d.adbin,d.adrelid),'')), E',\n' ORDER BY a.attnum)
     FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
     WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped)), E'\n' ORDER BY c.relname),'') || E'\n'
  INTO out FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p');

  SELECT out || coalesce(string_agg(format('ALTER TABLE public.%I ADD CONSTRAINT %I %s;', c.relname, k.conname, pg_get_constraintdef(k.oid)), E'\n' ORDER BY c.relname, k.contype DESC),'') || E'\n'
  INTO out FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public';

  SELECT out || coalesce(string_agg(indexdef||';', E'\n'),'') || E'\n' INTO out FROM pg_indexes WHERE schemaname='public';

  SELECT out || coalesce(string_agg(format(E'CREATE OR REPLACE VIEW public.%I AS\n%s', viewname, definition), E'\n'),'') || E'\n' INTO out FROM pg_views WHERE schemaname='public';

  SELECT out || coalesce(string_agg(pg_get_functiondef(p.oid)||';', E'\n'),'') || E'\n'
  INTO out FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind IN ('f','p');

  SELECT out || coalesce(string_agg(pg_get_triggerdef(t.oid)||';', E'\n'),'') || E'\n'
  INTO out FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal;

  SELECT out || coalesce(string_agg(format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', relname), E'\n'),'') || E'\n'
  INTO out FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relrowsecurity;

  SELECT out || coalesce(string_agg(format('CREATE POLICY %I ON public.%I AS %s FOR %s TO %s%s%s;', policyname, tablename, permissive, cmd,
     array_to_string(roles, ', '), coalesce(' USING ('||qual||')',''), coalesce(' WITH CHECK ('||with_check||')','')), E'\n'),'')
  INTO out FROM pg_policies WHERE schemaname='public';
  RETURN out;
END $$;
REVOKE ALL ON FUNCTION public.backup_schema_sql() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backup_schema_sql() TO service_role;

CREATE OR REPLACE FUNCTION public.backup_list_tables()
RETURNS SETOF text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT table_name::text FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name $$;
REVOKE ALL ON FUNCTION public.backup_list_tables() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backup_list_tables() TO service_role;