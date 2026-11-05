-- M23: account lock-out, session revocation and the admin audit log (docs/admin/01 §4.1.1). Adds only.
-- A lock is locked_at IS NOT NULL. token_version is compared with the JWT's `tv` claim; bumping it ends every session.
ALTER TABLE "auth"
    ADD COLUMN "locked_at" TIMESTAMPTZ(6),
    ADD COLUMN "locked_reason" TEXT,
    ADD COLUMN "locked_by" TEXT,
    ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "last_seen_at" TIMESTAMPTZ(6);

CREATE INDEX "auth_locked_at" ON "auth"("locked_at") WHERE "locked_at" IS NOT NULL;
CREATE INDEX "auth_created_at" ON "auth"("created_at" DESC);

-- One row per admin write. Never holds birth data, charts, questions or answers: before/after carry plan, quota,
-- role and lock columns only. actor_kind: admin | cli | system.
CREATE TABLE "admin_actions" (
    "id" TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
    "actor_user_id" TEXT,
    "actor_kind" TEXT NOT NULL DEFAULT 'admin',
    "action" TEXT NOT NULL,
    "target_user_id" TEXT,
    "reason" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "admin_actions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "admin_actions_actor_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
    CONSTRAINT "admin_actions_target_fkey" FOREIGN KEY ("target_user_id") REFERENCES "auth"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE INDEX "admin_actions_target" ON "admin_actions"("target_user_id", "created_at" DESC);
CREATE INDEX "admin_actions_actor" ON "admin_actions"("actor_user_id", "created_at" DESC);
CREATE INDEX "admin_actions_created" ON "admin_actions"("created_at" DESC);
