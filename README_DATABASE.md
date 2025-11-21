# Supabase Database Integration

This app now uses Supabase for persistent storage of onboarding flows and user tracking.

## Setup Instructions

1. **Create a Supabase Project**
   - Go to https://supabase.com and create a new project
   - Note your project URL and anon key

2. **Set Environment Variables**
   - Create a `.env.local` file in the root directory
   - Add the following variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Run Database Schema**
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor
   - Copy and paste the contents of `supabase/schema.sql`
   - Execute the SQL to create all tables and indexes

## Database Schema

### Tables

1. **flows** - Stores all onboarding flows
   - `id` (UUID, Primary Key)
   - `title` (TEXT)
   - `active` (BOOLEAN) - Determines if flow is live for users
   - `flow_data` (JSONB) - Complete flow structure (nodes, logic blocks, connections)
   - `created_at`, `updated_at` (TIMESTAMP)

2. **flow_sessions** - Tracks user sessions through flows
   - `id` (UUID, Primary Key)
   - `user_id` (TEXT) - User identifier
   - `flow_id` (UUID, Foreign Key to flows)
   - `started_at`, `completed_at` (TIMESTAMP)
   - `current_step_index` (INTEGER)
   - `is_completed` (BOOLEAN)

3. **flow_responses** - Stores all user answers
   - `id` (UUID, Primary Key)
   - `session_id` (UUID, Foreign Key to flow_sessions)
   - `node_id` (TEXT) - The flow node where question was asked
   - `question_type` (TEXT) - Type of question (multiple-choice, etc.)
   - `answer` (JSONB) - The answer (string, number, array, etc.)
   - `answered_at` (TIMESTAMP)

4. **flow_paths** - Tracks exact path user took
   - `id` (UUID, Primary Key)
   - `session_id` (UUID, Foreign Key to flow_sessions)
   - `node_id` (TEXT) - Flow node ID
   - `order_index` (INTEGER) - Order in which nodes were visited
   - `visited_at` (TIMESTAMP)

## Features

- **Flow Storage**: Complete flow structure stored in JSONB for efficient retrieval
- **Active/Inactive Flows**: Only active flows collect user data
- **Session Tracking**: Each user session is tracked with start/completion times
- **Response Tracking**: All answers are stored with question type and node ID
- **Path Tracking**: Exact sequence of nodes visited is recorded
- **Efficient Queries**: Indexes on all foreign keys and frequently queried columns

## Usage

The database integration is automatic:
- Flows are saved when you update them in the builder
- Sessions start when users preview active flows
- Responses are saved when users answer questions
- Paths are tracked as users navigate
- Sessions are marked complete when flow ends

## Data Collection Rules

- **Active Flows**: Data is collected (sessions, responses, paths)
- **Inactive Flows**: No data collection occurs
- **Completion**: Tracked when user clicks "Next" on final step or "Complete"


