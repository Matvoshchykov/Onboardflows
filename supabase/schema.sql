-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Flows table: Stores all onboarding flows
CREATE TABLE IF NOT EXISTS flows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  active BOOLEAN DEFAULT false,
  flow_data JSONB NOT NULL, -- Stores entire flow structure (nodes, logic blocks, connections, etc.)
  icon_url TEXT, -- URL to the flow icon image (1:1 aspect ratio)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Flow sessions table: Tracks user sessions through flows
CREATE TABLE IF NOT EXISTS flow_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL, -- User identifier (can be email, UUID, etc.)
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  current_step_index INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT false
);

-- Flow responses table: Stores all answers from users
CREATE TABLE IF NOT EXISTS flow_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES flow_sessions(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL, -- The flow node ID where the question was asked
  question_type TEXT NOT NULL, -- multiple-choice, checkbox-multi, short-answer, etc.
  answer JSONB NOT NULL, -- Stores the answer (string, number, array, etc.)
  answered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Flow paths table: Tracks the exact path a user took through the flow
CREATE TABLE IF NOT EXISTS flow_paths (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES flow_sessions(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL, -- The flow node ID
  order_index INTEGER NOT NULL, -- Order in which nodes were visited (0, 1, 2, ...)
  visited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, node_id, order_index)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_flows_active ON flows(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_flows_updated_at ON flows(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_flow_sessions_user_id ON flow_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_flow_sessions_flow_id ON flow_sessions(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_sessions_completed ON flow_sessions(is_completed, completed_at);
CREATE INDEX IF NOT EXISTS idx_flow_responses_session_id ON flow_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_flow_responses_node_id ON flow_responses(node_id);
CREATE INDEX IF NOT EXISTS idx_flow_paths_session_id ON flow_paths(session_id);
CREATE INDEX IF NOT EXISTS idx_flow_paths_order ON flow_paths(session_id, order_index);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at on flows
CREATE TRIGGER update_flows_updated_at BEFORE UPDATE ON flows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_paths ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for authenticated users (adjust based on your auth setup)
-- For now, we'll allow all operations. You can restrict this based on your authentication needs.
CREATE POLICY "Allow all operations on flows" ON flows FOR ALL USING (true);
CREATE POLICY "Allow all operations on flow_sessions" ON flow_sessions FOR ALL USING (true);
CREATE POLICY "Allow all operations on flow_responses" ON flow_responses FOR ALL USING (true);
CREATE POLICY "Allow all operations on flow_paths" ON flow_paths FOR ALL USING (true);

-- Storage policies for the 'uploads' bucket
-- These policies allow public read access and authenticated write access
-- Note: Storage policies are created on the storage.objects table

-- Policy: Allow public read access to all files in uploads bucket
CREATE POLICY "Public read access for uploads bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'uploads');

-- Policy: Allow authenticated users to upload files
-- For public access, we'll allow anyone to upload (you can restrict this if needed)
CREATE POLICY "Public upload access for uploads bucket"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'uploads');

-- Policy: Allow authenticated users to update their own files
CREATE POLICY "Public update access for uploads bucket"
ON storage.objects FOR UPDATE
USING (bucket_id = 'uploads')
WITH CHECK (bucket_id = 'uploads');

-- Policy: Allow authenticated users to delete files
CREATE POLICY "Public delete access for uploads bucket"
ON storage.objects FOR DELETE
USING (bucket_id = 'uploads');

