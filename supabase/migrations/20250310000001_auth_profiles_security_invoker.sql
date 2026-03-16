-- Recreate auth_profiles view with SECURITY INVOKER (fixes Supabase security finding).
-- With security_invoker=true, the view runs with the invoking user's privileges and RLS,
-- not the view owner's (SECURITY DEFINER).

DROP VIEW IF EXISTS public.auth_profiles;

CREATE VIEW public.auth_profiles
WITH (security_invoker = true) AS
SELECT id, username, date_of_birth, place_of_birth, time_of_birth, email, gender,
       is_active, kundli_added, role, created_at
FROM public.auth;

COMMENT ON VIEW public.auth_profiles IS 'Auth fields without password. Use this view if exposing profiles via API; add RLS policies as needed.';
