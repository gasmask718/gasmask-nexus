-- Seed default Grabba businesses if they don't exist
INSERT INTO businesses (id, name, slug, is_active, logo_url, settings, theme_config)
VALUES 
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Grabba R Us', 'grabba-r-us', true, null, '{}', '{"primary": "#A020F0", "icon": "🟪"}'),
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'Hot Mama Grabba', 'hot-mama-grabba', true, null, '{}', '{"primary": "#B76E79", "icon": "🟣"}'),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', 'GasMask', 'gasmask', true, null, '{}', '{"primary": "#FF0000", "icon": "🔴"}'),
  ('d4e5f6a7-b8c9-0123-def0-234567890123', 'Hot Scalati', 'hot-scalati', true, null, '{}', '{"primary": "#FF7A00", "icon": "🟠"}')
ON CONFLICT (slug) DO NOTHING;