-- Add is_read column to executive_reports table
ALTER TABLE executive_reports 
ADD COLUMN is_read boolean NOT NULL DEFAULT false;

-- Update RLS policy to allow admins to mark reports as read
CREATE POLICY "Admins can mark reports as read"
ON executive_reports
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);