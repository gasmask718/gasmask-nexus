-- Add realestate_worker role to app_role enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role' AND 'realestate_worker' = ANY(enum_range(NULL::app_role)::text[])) THEN
        ALTER TYPE app_role ADD VALUE 'realestate_worker';
    END IF;
END $$;

-- Delete existing role for the admin user
DELETE FROM user_roles WHERE user_id = '6019a316-2d95-4662-997c-c47bd0b37697';

-- Insert admin role for the admin user
INSERT INTO user_roles (user_id, role) 
VALUES ('6019a316-2d95-4662-997c-c47bd0b37697', 'admin');