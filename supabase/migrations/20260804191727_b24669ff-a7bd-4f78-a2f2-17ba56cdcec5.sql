-- props_master: replace single permissive ALL policy with operator set
DROP POLICY IF EXISTS "Authenticated users can manage props_master" ON public.props_master;
CREATE POLICY "auth_read_props_master" ON public.props_master
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "operator_insert_props_master" ON public.props_master
  FOR INSERT TO authenticated WITH CHECK (public.is_sbo_operator());
CREATE POLICY "operator_update_props_master" ON public.props_master
  FOR UPDATE TO authenticated USING (public.is_sbo_operator()) WITH CHECK (public.is_sbo_operator());
CREATE POLICY "operator_delete_props_master" ON public.props_master
  FOR DELETE TO authenticated USING (public.is_sbo_operator());

-- prop_results: remove public read, scope to operators
DROP POLICY IF EXISTS "Prop results are viewable by everyone" ON public.prop_results;
CREATE POLICY "operator_select_prop_results" ON public.prop_results
  FOR SELECT TO authenticated USING (public.is_sbo_operator());
CREATE POLICY "operator_insert_prop_results" ON public.prop_results
  FOR INSERT TO authenticated WITH CHECK (public.is_sbo_operator());
CREATE POLICY "operator_update_prop_results" ON public.prop_results
  FOR UPDATE TO authenticated USING (public.is_sbo_operator()) WITH CHECK (public.is_sbo_operator());
CREATE POLICY "operator_delete_prop_results" ON public.prop_results
  FOR DELETE TO authenticated USING (public.is_sbo_operator());

-- confirmed_game_winners: remove public read + any-authenticated writes
DROP POLICY IF EXISTS "Anyone can read confirmed winners" ON public.confirmed_game_winners;
DROP POLICY IF EXISTS "Authenticated users can insert confirmed winners" ON public.confirmed_game_winners;
DROP POLICY IF EXISTS "Authenticated users can update confirmed winners" ON public.confirmed_game_winners;
CREATE POLICY "operator_select_confirmed_game_winners" ON public.confirmed_game_winners
  FOR SELECT TO authenticated USING (public.is_sbo_operator());
CREATE POLICY "operator_insert_confirmed_game_winners" ON public.confirmed_game_winners
  FOR INSERT TO authenticated WITH CHECK (public.is_sbo_operator());
CREATE POLICY "operator_update_confirmed_game_winners" ON public.confirmed_game_winners
  FOR UPDATE TO authenticated USING (public.is_sbo_operator()) WITH CHECK (public.is_sbo_operator());
CREATE POLICY "operator_delete_confirmed_game_winners" ON public.confirmed_game_winners
  FOR DELETE TO authenticated USING (public.is_sbo_operator());

-- Revoke anon access left over from the public-read era
REVOKE ALL ON public.prop_results FROM anon;
REVOKE ALL ON public.confirmed_game_winners FROM anon;
REVOKE ALL ON public.props_master FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prop_results TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.confirmed_game_winners TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.props_master TO authenticated;
GRANT ALL ON public.prop_results TO service_role;
GRANT ALL ON public.confirmed_game_winners TO service_role;
GRANT ALL ON public.props_master TO service_role;

-- Redundant service_role policies (service_role bypasses RLS)
DROP POLICY IF EXISTS "Service role can manage prop stat context" ON public.sbo_prop_stat_context;
DROP POLICY IF EXISTS "Service role manages telegram posts" ON public.sbo_telegram_posts;
DROP POLICY IF EXISTS "Allow service role full access sbo_top_plays" ON public.sbo_top_plays;