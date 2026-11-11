-- Card options (docs/reading-engine/71 §4.4 item 1): per card, how it reads (length, view, words, plan), only for the
-- cards the person changed. No astrological content and no words of the person. Additive; an old row reads as '{}'.
ALTER TABLE "board_layout" ADD COLUMN IF NOT EXISTS "options" JSONB NOT NULL DEFAULT '{}';
