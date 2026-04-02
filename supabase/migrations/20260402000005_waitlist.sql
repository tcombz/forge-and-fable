-- Waitlist table for landing page interest form
CREATE TABLE IF NOT EXISTS waitlist (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  email      text NOT NULL,
  how_heard  text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Anon users can insert (submit interest) but cannot read
CREATE POLICY "waitlist_insert" ON waitlist FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "waitlist_insert_auth" ON waitlist FOR INSERT TO authenticated WITH CHECK (true);
-- Only service role can read the waitlist
