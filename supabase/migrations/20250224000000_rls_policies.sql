-- Enable RLS on all tables that hold user or sensitive data (defense-in-depth).
-- The backend uses Prisma with a single DB role; RLS applies if you ever use a different role (e.g. anon).

ALTER TABLE auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE kundlis ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_generated_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Add policies as needed for non–service-role connections (e.g. restrict kundlis by user_id).
