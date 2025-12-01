-- Migration: Add icon_url column to flows table
-- Run this in your Supabase SQL Editor if you have an existing flows table

-- Add icon_url column if it doesn't exist
ALTER TABLE flows 
ADD COLUMN IF NOT EXISTS icon_url TEXT;

-- Add a comment to document the column
COMMENT ON COLUMN flows.icon_url IS 'URL to the flow icon stored in Supabase storage (1:1 aspect ratio recommended)';

