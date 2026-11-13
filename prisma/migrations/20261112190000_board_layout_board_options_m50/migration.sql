-- Board-wide settings (Self v3 redesign): the card option keys (face, tools, groupBy, groupsAs, start, length, view,
-- words, plan) plus confirm and motion, only the ones the person changed. No astrological content and no words of the
-- person. Additive; an old row reads as '{}'.
ALTER TABLE "board_layout" ADD COLUMN "board_options" JSONB NOT NULL DEFAULT '{}';
