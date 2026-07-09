
-- QA CL cleanup
DELETE FROM grant_applications WHERE id='abc229d4-2caa-45e1-973d-a8e7b67b84a2';
DELETE FROM client_grant_matches WHERE client_id='ec679bf2-7306-480f-b454-1a7043b51072';
UPDATE funding_clients SET grant_eligible=false, grant_checked_at=NULL WHERE id='ec679bf2-7306-480f-b454-1a7043b51072';
