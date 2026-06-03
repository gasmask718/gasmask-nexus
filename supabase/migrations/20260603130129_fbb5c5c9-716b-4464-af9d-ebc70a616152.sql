
-- 1. Reactivate the 17 real chauffeurs
UPDATE tt_partners SET is_active = true
WHERE id IN (
  '0083b38c-06f2-4010-bad9-e4b5fb6fe5ed','640fbaa0-7707-4241-a424-b3e313b2e38b',
  'c10b9b91-18a0-42c0-ba43-268e2cc55312','78c5f7c0-99b2-46af-960c-c1c867727464',
  '6001bf42-7e12-482b-b628-3f962784af64','a3db938c-db8b-4aab-ba0e-4f1dea20b3fe',
  '73b70230-7712-4523-9125-9ec5acf913c7','41c35f17-c5ee-4957-a083-9c9e42f3a852',
  '80c53f5c-c0b2-4e91-90a2-0a2949135322','f9ac4753-4300-4ed9-a2a3-29a3ed3e0c0e',
  '998342f5-9d41-4e09-8de8-d5cd0cfb6d5c','31d84c2a-17e9-4d40-b718-a4b683a5a2bd',
  '1e73abb7-5932-40a5-9243-574373179fa1','45dd6cbc-e0c5-4bd3-bdab-2039d4915589',
  '890a609d-675f-4d70-b3c7-c1088e036a3a','7b161292-7fca-4d9e-9778-6214f6e5787c',
  'abee22a2-4a2e-4f03-b3f7-37b7e965784b'
);

-- 2. TEST_Drivers A/B/C were already status='inactive' pre-test (per prior query) — no change needed.

-- 3. Delete synthetic dispatch requests for the test booking
DELETE FROM tt_dispatch_requests WHERE booking_id = 'b2b2b2b2-c3c3-d4d4-e5e5-f6f6f6f6f6f6';

-- 4. Delete synthetic booking
DELETE FROM tt_bookings WHERE id = 'b2b2b2b2-c3c3-d4d4-e5e5-f6f6f6f6f6f6';

-- 5. Delete synthetic Phase 2 driver
DELETE FROM tt_drivers WHERE id = 'd3d3d3d3-e4e4-f5f5-a6a6-b7b7b7b7b7b7';

-- 6. Delete synthetic Phase 2 partner
DELETE FROM tt_partners WHERE id = 'a1a1a1a1-b2b2-c3c3-d4d4-e5e5e5e5e5e5';
