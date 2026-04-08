
INSERT INTO public.cb_dispatch_config (category, max_partners_per_request, target_margin_percentage, default_markup_type, default_markup_value, quote_expiration_hours)
VALUES ('private_jet', 15, 15, 'percentage', 15, 48)
ON CONFLICT (category) DO NOTHING;
