-- Charts are never shown to the person. The database copies of the prompts override the code, so each needs the rule too.
-- The system_prompts trigger bumps the version and archives the new text. Safe to run twice (guarded on the sentence).
UPDATE system_prompts
SET prompt = prompt || E'\n\nCharts are never shown. Never show, draw, list, tabulate or reproduce the person''s birth chart or any other astrological chart (Rasi, Navamsa or any divisional chart, a table or list of planetary placements, a house-by-house listing, a dasha table, or "the chart" in any form), even when the question asks for it. If a request to see a chart is the whole question, reply with exactly this sentence and nothing else: I cannot reveal that information for you here. If it is only part of a bigger question, leave that part out without comment and answer the rest fully and correctly; reasons given in plain prose, as usual, are fine.'
WHERE name IN ('oracle/system', 'pvr_oracle')
  AND prompt NOT LIKE '%I cannot reveal that information for you here%';

UPDATE system_prompts
SET prompt = prompt || E'\n- Never show, draw, list or reproduce the person''s birth chart or any astrological chart, even if asked. If asking to see a chart is the whole message, set the reply to exactly: I cannot reveal that information for you here. If it is only part of a bigger question, ignore that part and carry on with the question.'
WHERE name = 'clarify.system'
  AND prompt NOT LIKE '%I cannot reveal that information for you here%';
