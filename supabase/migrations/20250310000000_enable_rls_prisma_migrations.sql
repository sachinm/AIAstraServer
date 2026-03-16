-- Enable RLS on Prisma's migrations table (created by Prisma, exposed to PostgREST).
-- With RLS enabled and no permissive policies, anon/authenticated get no rows.
-- Prisma uses the direct connection (bypasses RLS) and can still run migrations.

ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;
