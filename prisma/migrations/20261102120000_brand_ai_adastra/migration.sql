-- The product name is now AI AdAstra. The database copies of the decline replies and agent prompts override the code,
-- so they need the new name too. The system_prompts trigger bumps version and archives the new text.
UPDATE "declined_topics"
SET "reply" = replace("reply", 'AI Astra', 'AI AdAstra'), "updated_at" = CURRENT_TIMESTAMP, "updated_by" = 'migration:brand_ai_adastra'
WHERE "reply" LIKE '%AI Astra%';

UPDATE system_prompts
SET prompt = replace(prompt, 'AI Astra', 'AI AdAstra')
WHERE prompt LIKE '%AI Astra%';
