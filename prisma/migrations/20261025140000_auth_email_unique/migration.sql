-- Auth: one account per email address, compared case-insensitively (signup refuses a second one).
-- Prisma cannot express a functional index (lower(email)) in schema.prisma, so the index lives here only.
-- Step 1 fails loudly if duplicates already exist. It deletes nothing: resolve duplicates by hand, then re-run.
DO $$
DECLARE
  dup_groups integer;
BEGIN
  SELECT count(*) INTO dup_groups
  FROM (
    SELECT lower(email)
    FROM "auth"
    GROUP BY lower(email)
    HAVING count(*) > 1
  ) AS dups;

  IF dup_groups > 0 THEN
    RAISE EXCEPTION 'auth_email_unique: % email address(es) belong to more than one account (case-insensitive). Resolve them by hand, then re-run this migration.', dup_groups;
  END IF;
END
$$;

CREATE UNIQUE INDEX "auth_email_lower_key" ON "auth" (lower("email"));
