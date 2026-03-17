
-- Conversion Patterns: abstracted structural/psychological patterns from high-performing sites
CREATE TABLE public.brandaro_conversion_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type text NOT NULL, -- cta_placement, trust_element, headline_pattern, section_order, offer_structure, form_placement, urgency_trigger, social_proof, risk_reversal
  pattern_key text NOT NULL, -- unique identifier like 'cta_above_fold_primary'
  industry_type text, -- null = universal
  pattern_data jsonb NOT NULL DEFAULT '{}', -- structured pattern definition
  source_url text, -- where it was observed (for provenance, not copying)
  source_quality text DEFAULT 'unverified', -- verified, unverified, high_performer
  usage_frequency integer DEFAULT 0, -- how often seen in successful sites
  pattern_score numeric DEFAULT 50, -- weighted effectiveness score
  conversion_correlation numeric DEFAULT 0, -- correlation with actual conversions from Brandaro tracking
  engagement_boost numeric DEFAULT 0, -- measured engagement improvement
  times_used_in_builds integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(pattern_key, industry_type)
);

ALTER TABLE public.brandaro_conversion_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read conversion patterns" ON public.brandaro_conversion_patterns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role manages conversion patterns" ON public.brandaro_conversion_patterns FOR ALL TO service_role USING (true);

-- Track which patterns were used in each build
CREATE TABLE public.brandaro_build_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  build_job_id uuid,
  pattern_id uuid REFERENCES public.brandaro_conversion_patterns(id) ON DELETE SET NULL,
  applied_at timestamptz DEFAULT now(),
  resulted_in_conversion boolean DEFAULT false,
  engagement_delta numeric DEFAULT 0
);

ALTER TABLE public.brandaro_build_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read build patterns" ON public.brandaro_build_patterns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role manages build patterns" ON public.brandaro_build_patterns FOR ALL TO service_role USING (true);

-- Seed universal conversion patterns (proven, not copied)
INSERT INTO public.brandaro_conversion_patterns (pattern_type, pattern_key, industry_type, pattern_data, source_quality, usage_frequency, pattern_score) VALUES
  -- CTA Placement
  ('cta_placement', 'cta_above_fold_primary', NULL, '{"position":"above_fold","style":"button_primary","text_pattern":"action_verb + benefit","size":"large","color":"primary_contrast"}', 'verified', 100, 92),
  ('cta_placement', 'cta_sticky_bottom_mobile', NULL, '{"position":"sticky_bottom","style":"full_width_bar","visibility":"mobile_only","trigger":"scroll_past_hero"}', 'verified', 85, 88),
  ('cta_placement', 'cta_after_testimonials', NULL, '{"position":"after_social_proof","style":"button_primary","context":"trust_reinforced"}', 'verified', 75, 85),
  ('cta_placement', 'cta_exit_intent', NULL, '{"position":"overlay","trigger":"exit_intent","style":"modal","offer":"discount_or_free"}', 'verified', 60, 72),
  -- Trust Elements
  ('trust_element', 'trust_badges_below_hero', NULL, '{"position":"below_hero","elements":["years_in_business","reviews_count","license_badge","guarantee_badge"],"layout":"horizontal_strip"}', 'verified', 90, 90),
  ('trust_element', 'trust_google_reviews_widget', NULL, '{"position":"mid_page","type":"embedded_reviews","source":"google","min_rating":4.5,"show_count":true}', 'verified', 80, 87),
  ('trust_element', 'trust_before_after_gallery', NULL, '{"position":"services_section","type":"image_comparison","layout":"slider_or_grid"}', 'verified', 65, 78),
  -- Headline Patterns
  ('headline_pattern', 'headline_problem_agitate_solve', NULL, '{"structure":"problem_statement + agitation + solution","length":"8_to_12_words","includes_location":true}', 'verified', 95, 93),
  ('headline_pattern', 'headline_number_benefit', NULL, '{"structure":"number + specific_benefit","example":"5-Star Rated Plumbing in [City]","power_words":["trusted","guaranteed","fast","professional"]}', 'verified', 70, 80),
  -- Section Order
  ('section_order', 'order_classic_local', NULL, '{"sequence":["hero_with_cta","trust_strip","services_grid","why_choose_us","testimonials","service_area","cta_section","faq","contact_form","footer"],"rationale":"value_first_trust_then_action"}', 'verified', 88, 91),
  ('section_order', 'order_urgency_first', NULL, '{"sequence":["hero_with_urgency","limited_offer","services","social_proof","guarantee","cta","faq","contact"],"rationale":"scarcity_drives_action"}', 'verified', 55, 75),
  -- Social Proof
  ('social_proof', 'social_proof_counter_strip', NULL, '{"type":"animated_counters","metrics":["projects_completed","happy_clients","years_experience","5_star_reviews"],"position":"below_hero_or_mid"}', 'verified', 82, 86),
  ('social_proof', 'social_proof_video_testimonial', NULL, '{"type":"video","position":"dedicated_section","layout":"featured_single_or_carousel","max_duration_seconds":60}', 'verified', 45, 82),
  -- Risk Reversal
  ('risk_reversal', 'guarantee_money_back', NULL, '{"type":"guarantee_badge","text":"100% Satisfaction Guarantee","position":"near_cta","visual":"shield_icon"}', 'verified', 78, 89),
  ('risk_reversal', 'guarantee_free_estimate', NULL, '{"type":"free_offer","text":"Free Estimate - No Obligation","position":"hero_and_contact","reduces_friction":true}', 'verified', 90, 91),
  -- Form Placement
  ('form_placement', 'form_sticky_sidebar', NULL, '{"position":"right_sidebar","type":"sticky","fields":["name","phone","service_needed"],"max_fields":4,"submit_text":"Get My Free Quote"}', 'verified', 70, 84),
  ('form_placement', 'form_hero_inline', NULL, '{"position":"within_hero","type":"inline","fields":["phone_or_email"],"single_field_priority":true,"submit_text":"Call Me Now"}', 'verified', 60, 80),
  -- Urgency
  ('urgency_trigger', 'urgency_limited_slots', NULL, '{"type":"scarcity","text_pattern":"Only X slots left this week","visual":"countdown_or_badge","position":"hero_or_cta"}', 'verified', 50, 74),
  ('urgency_trigger', 'urgency_seasonal_offer', NULL, '{"type":"time_limited","text_pattern":"Season Special - Ends [Date]","visual":"banner_top","position":"top_bar"}', 'verified', 65, 77);

-- Industry-specific patterns
INSERT INTO public.brandaro_conversion_patterns (pattern_type, pattern_key, industry_type, pattern_data, source_quality, usage_frequency, pattern_score) VALUES
  ('section_order', 'order_plumbing_emergency', 'plumbing', '{"sequence":["hero_emergency_cta","24_7_badge","services","pricing_transparency","reviews","service_area","contact"],"rationale":"emergency_intent_fast_action"}', 'verified', 70, 90),
  ('section_order', 'order_cleaning_trust', 'cleaning', '{"sequence":["hero_clean_home","trust_badges","before_after","pricing_packages","reviews","booking_form"],"rationale":"visual_proof_then_easy_booking"}', 'verified', 65, 85),
  ('section_order', 'order_hvac_seasonal', 'hvac', '{"sequence":["hero_seasonal_offer","emergency_strip","services","maintenance_plans","reviews","financing","contact"],"rationale":"seasonal_urgency_plus_plans"}', 'verified', 60, 83),
  ('section_order', 'order_roofing_visual', 'roofing', '{"sequence":["hero_storm_damage","free_inspection_cta","before_after_gallery","certifications","reviews","financing","contact"],"rationale":"visual_damage_assessment_flow"}', 'verified', 55, 82),
  ('headline_pattern', 'headline_plumbing_emergency', 'plumbing', '{"structure":"emergency_keyword + location + speed","example":"24/7 Emergency Plumber in [City] - Fast Response","power_words":["emergency","fast","licensed","affordable"]}', 'verified', 80, 91),
  ('headline_pattern', 'headline_cleaning_benefit', 'cleaning', '{"structure":"benefit + ease","example":"Spotless Home Without Lifting a Finger","power_words":["spotless","professional","trusted","eco-friendly"]}', 'verified', 60, 79);
