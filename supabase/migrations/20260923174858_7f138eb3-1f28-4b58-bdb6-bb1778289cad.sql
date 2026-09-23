INSERT INTO public.ambassador_invites (
  invited_by_ambassador_id, invited_by_user_id, invite_token, token_hash,
  email, phone, region_id, target_ambassador_id, status, expires_at
) VALUES (
  NULL,
  'c2a6648e-2069-421c-9310-4a09a2df1499',
  'c13dca04c69a881523012b195fe83f9c64506bd3421083376ee074257a902bf7',
  'e2c4e2954cf4b33d4233def49dac0590c48689d26d451bf421c12896a8b43c56',
  'InnerstateTransportation@gmail.com',
  '+19297771122',
  NULL,
  'f2ae6ea4-65d4-4cbf-9b63-cc1ed20eae36',
  'pending',
  now() + interval '14 days'
) RETURNING id;

INSERT INTO public.ambassador_invite_events (invite_id, event_type, actor_user_id, metadata)
SELECT id, 'created', 'c2a6648e-2069-421c-9310-4a09a2df1499',
  jsonb_build_object('email','InnerstateTransportation@gmail.com','target_ambassador_id','f2ae6ea4-65d4-4cbf-9b63-cc1ed20eae36','note','staff-created replacement for expired invite 3e8a05fc-e80b-45bc-919c-8a6fb5943185')
FROM public.ambassador_invites
WHERE invite_token = 'c13dca04c69a881523012b195fe83f9c64506bd3421083376ee074257a902bf7';