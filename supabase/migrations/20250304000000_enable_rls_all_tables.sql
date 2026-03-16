-- Enable RLS on all public tables to fix Supabase security findings.
-- With RLS enabled and no permissive policies, anon/authenticated get no rows;
-- your backend (Prisma with service_role/direct URL) bypasses RLS and keeps working.

-- 1) Auth: prevent API access so password is never exposed
ALTER TABLE public.auth ENABLE ROW LEVEL SECURITY;

-- Remove auth table from PostgREST/API for anon and authenticated so password is never exposed
REVOKE ALL ON public.auth FROM anon;
REVOKE ALL ON public.auth FROM authenticated;

-- 2) User data tables
ALTER TABLE public.kundlis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_generated_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 3) System config
ALTER TABLE public.system_prompts ENABLE ROW LEVEL SECURITY;

-- Optional: view for future use if you ever need to expose profile via API (no password).
-- Do not grant anon/authenticated access to this view until you add RLS policies.
CREATE OR REPLACE VIEW public.auth_profiles AS
SELECT id, username, date_of_birth, place_of_birth, time_of_birth, email, gender,
       is_active, kundli_added, role, created_at
FROM public.auth;

COMMENT ON VIEW public.auth_profiles IS 'Auth fields without password. Use this view if exposing profiles via API; add RLS policies as needed.';
