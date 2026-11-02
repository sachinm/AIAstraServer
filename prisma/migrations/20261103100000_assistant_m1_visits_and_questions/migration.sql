-- The public assistant's log and the site's visit log (docs/assistant/01, docs/security/assistant-log-controls.md).
-- Retention: full IP 30 days, questions 90 days, visit rows 400 days, enforced by the scheduled sweep.

CREATE TABLE "assistant_visits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "visit_id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_prefix" TEXT,
    "ip_full" TEXT,
    "user_agent" TEXT,
    "country" TEXT,
    "language" TEXT,
    "referrer" TEXT,
    "landing_path" TEXT,
    "legal_hold" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "assistant_visits_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "assistant_visits_visit_day" ON "assistant_visits"("visit_id", "day");
CREATE INDEX "assistant_visits_ip_prefix_day" ON "assistant_visits"("ip_prefix", "day");
CREATE INDEX "assistant_visits_first_seen" ON "assistant_visits"("first_seen_at");

CREATE TABLE "assistant_questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "visit_id" TEXT NOT NULL,
    "asked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "model" TEXT,
    "tokens_in" INTEGER,
    "tokens_out" INTEGER,
    "latency_ms" INTEGER,
    "legal_hold" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "assistant_questions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "assistant_questions_asked_at" ON "assistant_questions"("asked_at");
CREATE INDEX "assistant_questions_visit_asked" ON "assistant_questions"("visit_id", "asked_at");
