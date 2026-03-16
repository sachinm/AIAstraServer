-- Add role column to auth table for superadmin and future roles.
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor) if you manage schema there,
-- or apply via your migration tool.
ALTER TABLE auth ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- Optional: ensure superadmin can be identified (no unique constraint on role).
COMMENT ON COLUMN auth.role IS 'User role: user, superadmin, etc.';
