-- Sync businesses table with all brands from the spec
INSERT INTO public.businesses (name, slug, theme_config, is_active)
SELECT 'Top Tier Experience', 'top-tier-experience', '{"primary": "#000000", "icon": "⚫"}', true
WHERE NOT EXISTS (SELECT 1 FROM public.businesses WHERE name = 'Top Tier Experience');

INSERT INTO public.businesses (name, slug, theme_config, is_active)
SELECT 'Unforgettable Times USA', 'unforgettable-times-usa', '{"primary": "#4169E1", "icon": "🔵"}', true
WHERE NOT EXISTS (SELECT 1 FROM public.businesses WHERE name = 'Unforgettable Times USA');

INSERT INTO public.businesses (name, slug, theme_config, is_active)
SELECT 'iClean WeClean', 'iclean-weclean', '{"primary": "#00CED1", "icon": "🧹"}', true
WHERE NOT EXISTS (SELECT 1 FROM public.businesses WHERE name = 'iClean WeClean');

INSERT INTO public.businesses (name, slug, theme_config, is_active)
SELECT 'The Playboxxx', 'the-playboxxx', '{"primary": "#FF1493", "icon": "🎮"}', true
WHERE NOT EXISTS (SELECT 1 FROM public.businesses WHERE name = 'The Playboxxx');

INSERT INTO public.businesses (name, slug, theme_config, is_active)
SELECT 'Prime Source Depot', 'prime-source-depot', '{"primary": "#228B22", "icon": "🟢"}', true
WHERE NOT EXISTS (SELECT 1 FROM public.businesses WHERE name = 'Prime Source Depot');

INSERT INTO public.businesses (name, slug, theme_config, is_active)
SELECT 'Funding Company', 'funding-company', '{"primary": "#FFD700", "icon": "💰"}', true
WHERE NOT EXISTS (SELECT 1 FROM public.businesses WHERE name = 'Funding Company');

INSERT INTO public.businesses (name, slug, theme_config, is_active)
SELECT 'OS Dynasty', 'os-dynasty', '{"primary": "#1E1E2F", "icon": "👑"}', true
WHERE NOT EXISTS (SELECT 1 FROM public.businesses WHERE name = 'OS Dynasty');

INSERT INTO public.businesses (name, slug, theme_config, is_active)
SELECT 'Hot Scolatti', 'hot-scolatti', '{"primary": "#FF7F11", "icon": "🟠"}', true
WHERE NOT EXISTS (SELECT 1 FROM public.businesses WHERE name = 'Hot Scolatti');