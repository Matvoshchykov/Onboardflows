-- Suggestions table: Stores user feedback and suggestions
CREATE TABLE IF NOT EXISTS suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message TEXT NOT NULL,
  experience_id TEXT, -- Optional: The Whop experience/company ID
  user_id TEXT, -- Optional: User identifier if available
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_suggestions_experience_id ON suggestions(experience_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_created_at ON suggestions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suggestions_user_id ON suggestions(user_id);

-- Row Level Security (RLS) policies
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations (insert for anyone, read/update/delete can be restricted later)
CREATE POLICY "Allow all operations on suggestions" ON suggestions FOR ALL USING (true);

