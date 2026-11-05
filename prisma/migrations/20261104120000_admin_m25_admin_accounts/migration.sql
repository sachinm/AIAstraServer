-- M25: staff accounts for the admin app (aiadastra_admin), kept apart from customer accounts in "auth".
-- Passwords live only in AWS Secrets Manager (aiadastra/admin/<username>); this table holds a scrypt hash, never the
-- password. role: admin | superadmin. Adds only.
CREATE TABLE "admin_accounts" (
    "id" TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
    "username" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    -- scrypt$<N>$<r>$<p>$<salt b64url>$<hash b64url>
    "password_hash" TEXT NOT NULL,
    "password_set_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    -- the Secrets Manager secret holding this account's password (name only, never the value)
    "secret_name" TEXT,
    -- bumping it ends every session of this admin
    "token_version" INTEGER NOT NULL DEFAULT 1,
    "disabled_at" TIMESTAMPTZ(6),
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "last_login_ip" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "admin_accounts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "admin_accounts_role_check" CHECK ("role" IN ('admin', 'superadmin'))
);

CREATE UNIQUE INDEX "admin_accounts_username_key" ON "admin_accounts"(lower("username"));

-- Audit rows written by an admin account (admin_actions.actor_user_id stays for actors from "auth").
ALTER TABLE "admin_actions" ADD COLUMN "actor_admin_id" TEXT;
ALTER TABLE "admin_actions"
    ADD CONSTRAINT "admin_actions_actor_admin_fkey" FOREIGN KEY ("actor_admin_id") REFERENCES "admin_accounts"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
CREATE INDEX "admin_actions_actor_admin" ON "admin_actions"("actor_admin_id", "created_at" DESC);
