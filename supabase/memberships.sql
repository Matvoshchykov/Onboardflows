-- User memberships table: Stores user payment and membership status
CREATE TABLE IF NOT EXISTS user_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  membership_active BOOLEAN DEFAULT false,
  payment_id TEXT, -- Store the receipt_id from Whop payment
  plan_type TEXT, -- 'premium-monthly' or 'premium-yearly'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, company_id) -- One membership per user per company
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_user_memberships_user_id ON user_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memberships_company_id ON user_memberships(company_id);
CREATE INDEX IF NOT EXISTS idx_user_memberships_active ON user_memberships(membership_active) WHERE membership_active = true;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_memberships_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at on user_memberships
CREATE TRIGGER update_user_memberships_updated_at BEFORE UPDATE ON user_memberships
  FOR EACH ROW EXECUTE FUNCTION update_memberships_updated_at();

-- Row Level Security (RLS) policies
ALTER TABLE user_memberships ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for authenticated users
CREATE POLICY "Allow all operations on user_memberships" ON user_memberships FOR ALL USING (true);

