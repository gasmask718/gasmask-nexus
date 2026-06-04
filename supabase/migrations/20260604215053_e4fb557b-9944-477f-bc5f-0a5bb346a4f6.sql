DELETE FROM public.event_spaces WHERE name = 'PASS_B_AUDIT_SPACE';
DELETE FROM public.virtual_tour_requests WHERE venue_name = 'PASS_B_AUDIT_VENUE' OR email = 'audit@passb.test';

INSERT INTO public.floor_directory (floor, section, page_route, page_name, purpose, status, gaps_count, audit_pass) VALUES
('UFT Hub','OS-local','/os/unforgettable','UT Penthouse','UFT hub landing / overview','needs_work',1,'R2/Pass A-B'),
('UFT Hub','OS-local','/os/unforgettable/intelligence','UT Intelligence Command Center','Territory heatmap + AI lead scoring (1,169 rows / 2,756 scored)','ready',0,'R2/Pass A-B'),
('UFT Hub','OS-local','/os/unforgettable/outreach','UT Outreach Command','SMS/email send-side to ut_partner_leads (real Twilio path)','ready',1,'R2/Pass A-B'),
('UFT Hub','OS-local','/os/unforgettable/onboarding','UT Onboarding','Partner onboarding wizard — pure presentational, no writes','stub',1,'R2/Pass A-B'),
('UFT Hub','OS-local','/os/unforgettable/marketplace','UT Marketplace Control','Marketplace control surface — wrapper, no live data','stub',1,'R2/Pass A-B'),
('UFT Hub','OS-local','/os/unforgettable/products','UT Product Engine','Product catalog manager — partial; reads ok, writes thin','needs_work',1,'R2/Pass A-B'),
('UFT Hub','OS-local','/os/unforgettable/automation','UT Automation','Automation rules surface — UI only, no engine wired','stub',1,'R2/Pass A-B'),
('UFT Hub','OS-local','/os/unforgettable/analytics','UT Analytics','Analytics dashboard — hardcoded constants','stub',1,'R2/Pass A-B'),
('UFT Hub','OS-local','/os/unforgettable/pricing-intelligence','UT Pricing Intelligence','Dropship scorer refresh path verified (run_id returned)','ready',0,'R2/Pass A-B'),
('UFT Hub','OS-local','/os/unforgettable/event-spaces','UT Event Spaces','Event space CRUD on event_spaces (real insert proven)','needs_work',2,'R2/Pass A-B'),
('UFT Hub','OS-local','/os/unforgettable/virtual-tours','UT Virtual Tours','Virtual tour requests CRUD (real insert + RPC stack)','needs_work',2,'R2/Pass A-B'),
('UFT Platform','Bridge','/uft/dashboard','UFT Dashboard','Platform metrics — bridge broken (wrong project, no auth)','needs_work',2,'R2/Pass A-B'),
('UFT Platform','Bridge','/uft/revenue','UFT Revenue','Platform revenue — wrapper over broken bridge + constants','needs_work',2,'R2/Pass A-B'),
('UFT Platform','Bridge','/uft/vendors','UFT Vendors','Vendor directory — DEMO_VENDORS hardcoded, no bridge call','stub',2,'R2/Pass A-B'),
('UFT Platform','Bridge','/uft/ambassadors','UFT Ambassadors','Ambassador broadcast button is fake (toast only, no send)','stub',2,'R2/Pass A-B'),
('UFT Platform','Bridge','/uft/launch','UFT Launch Checklist','23-item checklist, localStorage only, no backend','stub',1,'R2/Pass A-B')
ON CONFLICT (page_route) DO UPDATE SET
  floor=EXCLUDED.floor, section=EXCLUDED.section, page_name=EXCLUDED.page_name,
  purpose=EXCLUDED.purpose, status=EXCLUDED.status, gaps_count=EXCLUDED.gaps_count,
  audit_pass=EXCLUDED.audit_pass, last_audited=now();