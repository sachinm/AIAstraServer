-- Reading engine M5: topics the app does not discuss (docs/reading-engine/18-declined-topics.md).
-- category: deny (never facilitated, never sent to any agent, text withheld) | decline (fixed reply) | role_gated (declined unless the role allows).
CREATE TABLE "declined_topics" (
  "id" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "reply" TEXT NOT NULL,
  "phrases" JSONB NOT NULL DEFAULT '[]',
  "words" JSONB NOT NULL DEFAULT '[]',
  "allowed_roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 500,
  "notes" TEXT,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" TEXT,
  CONSTRAINT "declined_topics_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "declined_topics_category_check" CHECK ("category" IN ('deny', 'decline', 'role_gated'))
);

INSERT INTO "declined_topics" ("id", "category", "label", "reply", "allowed_roles", "sort_order", "notes", "updated_by") VALUES
  ('self_harm', 'deny', 'Self-harm or suicide', 'I''m really sorry you''re going through this. I can''t answer this one from a chart. If you might act on these thoughts or are in immediate danger, please contact your local emergency number now. In the US you can call or text 988, and in India you can call Tele-MANAS at 14416 or 1-800-891-4416. If you can, tell someone you trust how you feel right now. When you feel ready, I''m glad to talk through your chart with you.', ARRAY[]::TEXT[], 10, 'Examples: I want to end my life | Should I kill myself?', 'migration-m5'),
  ('violence_harm', 'deny', 'Killing, hurting, attacking or harming people or animals', 'AI Astra cannot help with that.', ARRAY[]::TEXT[], 20, 'Examples: How can I kill someone? | When is a good time to hurt my neighbour? | Will I get away with beating him? | How do I poison someone?', 'migration-m5'),
  ('curses_black_magic', 'deny', 'Curses, black magic or spells to control or harm someone', 'AI Astra cannot help with that.', ARRAY[]::TEXT[], 30, 'Examples: How can I curse my ex? | Do vashikaran on my boss | Has someone done black magic on me?', 'migration-m5'),
  ('crime', 'deny', 'Crime: theft, fraud, drugs, hacking, evading police', 'AI Astra cannot help with that.', ARRAY[]::TEXT[], 40, 'Examples: When is a good time to rob a bank? | Will I get caught selling drugs? | Can I evade the police?', 'migration-m5'),
  ('abuse_stalking', 'deny', 'Stalking, harassment, abuse or controlling someone', 'AI Astra cannot help with that.', ARRAY[]::TEXT[], 50, 'Examples: How can I track my ex without her knowing? | How do I make her obey me?', 'migration-m5'),
  ('extremism', 'deny', 'Terrorism, extremism, weapons or explosives', 'AI Astra cannot help with that.', ARRAY[]::TEXT[], 60, 'Examples: When should we attack? | How do I make a bomb?', 'migration-m5'),
  ('sexual_minors', 'deny', 'Sexual content involving minors', 'AI Astra cannot help with that.', ARRAY[]::TEXT[], 70, 'Examples withheld', 'migration-m5'),
  ('death_lifespan', 'decline', 'Death, lifespan or longevity (anyone)', 'AI Astra does not answer questions about death, lifespan or longevity, for you or anyone else.', ARRAY[]::TEXT[], 100, 'Examples: When will I die? | How long will my father live? | What is my lifespan? | Will my mother die this year? | Is there a maraka period for me?', 'migration-m5'),
  ('baby_sex', 'decline', 'Predicting or choosing a baby''s sex', 'AI Astra does not predict or help choose a baby''s sex.', ARRAY[]::TEXT[], 110, 'Examples: Will my baby be a boy or a girl? | How can I conceive a son?', 'migration-m5'),
  ('third_party_surveillance', 'decline', 'Someone else''s private actions (cheating, lying)', 'AI Astra does not answer questions about someone else''s private actions, such as whether a partner is cheating.', ARRAY[]::TEXT[], 120, 'Examples: Is my wife cheating on me? | Is my husband having an affair?', 'migration-m5'),
  ('gambling_markets', 'decline', 'Lottery or betting numbers, stock or crypto picks', 'AI Astra does not give lottery or betting numbers, or say which stock, coin or bet to pick.', ARRAY[]::TEXT[], 130, 'Examples: Give me the lottery numbers for tomorrow | Which stock should I buy? | Which crypto will go up?', 'migration-m5'),
  ('public_events', 'decline', 'Elections, disasters, wars or market crashes', 'AI Astra reads your own chart. It does not forecast elections, disasters, wars or market moves.', ARRAY[]::TEXT[], 140, 'Examples: Who will win the election? | Will there be an earthquake this year? | Will the stock market crash?', 'migration-m5'),
  ('exact_amount', 'decline', 'Exact amounts of money', 'AI Astra does not predict amounts of money. You can ask when income or savings are likely to grow instead.', ARRAY[]::TEXT[], 150, 'Examples: How much money will I earn next year? | How many lakhs will I make?', 'migration-m5'),
  ('remedies', 'decline', 'Remedies: gemstones, mantras, pujas, rituals', 'AI Astra does not recommend remedies such as gemstones, mantras, pujas or rituals.', ARRAY[]::TEXT[], 160, 'Examples: Which gemstone should I wear? | What puja should I do for marriage?', 'migration-m5'),
  ('legal_advice', 'decline', 'Legal advice', 'AI Astra does not give legal advice. Please talk to a lawyer. You can still ask about timing in your chart for a legal matter.', ARRAY[]::TEXT[], 170, 'Examples: Should I sign this contract? | Should I sue my employer?', 'migration-m5'),
  ('health', 'role_gated', 'Illness, disease, diagnosis, accidents, injuries, surgery or recovery', 'AI Astra does not answer questions about illness, disease, diagnosis, accidents or injuries.', ARRAY['astrologer', 'researcher', 'aiastra_admin']::TEXT[], 200, 'Examples: Do I have cancer? | Will my surgery go well? | When will my health improve? | Will I have an accident this year?', 'migration-m5');
